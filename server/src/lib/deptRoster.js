/**
 * Projecting the community roster onto a department site.
 *
 * A department's config says how personnel are *presented* — which categories
 * exist, what colour each band is, which columns show. Who is actually in the
 * department comes from the community roster, which the Discord bot already
 * maintains through the sync API. This module is the join between the two.
 *
 * The bridge is the Discord role map: every roster entry carries the rank the
 * bot resolved it to, and every category names the role keys that belong in it.
 * So promoting someone in Discord moves them between bands on their department
 * site with nothing else to update.
 *
 * An exact copy of client/src/lib/deptRoster.js — see the note in
 * server/src/lib/departmentConfig.js about why these are duplicated.
 */

/** Role-map entries for one department, richest rank first. */
export function ranksForDepartment(roleMap, departmentId) {
  return (roleMap || [])
    .filter((role) => role.department === departmentId)
    .sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
}

/**
 * Which role key a roster entry corresponds to. Entries store the rank label
 * rather than the role key (that is what the bot writes and what the roster
 * table shows), so match on the department plus either form of the rank.
 */
export function roleKeyFor(entry, roleMap) {
  // The roster projection carries the key of the exact rank it resolved for this
  // member; trust it over re-matching a label, which drifts when two roles share
  // one. Only fall back to a label match for legacy/manual rows that lack it.
  if (entry.roleKey) return entry.roleKey;
  const candidates = (roleMap || []).filter((role) => role.department === entry.department);
  // Drop a leading "MPD | " department prefix so a stored "Captain" still lines
  // up with a map label of "MPD | Captain".
  const norm = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/^[a-z0-9]+\s*\|\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
  const match =
    candidates.find((role) => role.rank === entry.rank) ??
    candidates.find((role) => role.rankFull === entry.rankFull) ??
    candidates.find((role) => norm(role.rank) === norm(entry.rank)) ??
    candidates.find((role) => norm(role.rankFull) === norm(entry.rankFull));
  return match?.key ?? null;
}

/**
 * Bucket a department's members into a subdivision's categories.
 *
 * Anyone whose rank no category claims lands in a trailing "Unassigned" band
 * rather than disappearing — a rank added to the role map before the category
 * that should hold it is a routine state, and silently dropping those people
 * would look like the roster was broken.
 */
export function projectSubdivision(subdivision, members, roleMap, rankOrder = null, options = {}) {
  const withRole = members.map((entry) => {
    const roleKey = roleKeyFor(entry, roleMap);
    const base = (roleMap || []).find((role) => role.key === roleKey)?.order ?? 0;
    // A department can override rank seniority locally (config.roster.rankOrder,
    // set from the roster's Rank order control) without touching the site-wide
    // role map; that override wins over the mapped order when present.
    const order = rankOrder && roleKey != null && roleKey in rankOrder ? rankOrder[roleKey] : base;
    return { ...entry, roleKey, order };
  });

  // Placement is manual: a member sits in the band command placed them in
  // (member.categoryId), full stop. Nothing is inferred from their rank — that
  // inference drifted with every label change and stranded people, so the rank
  // now only decides the order *within* a band.
  const categories = (subdivision.categories || []).map((category) => ({
    ...category,
    members: sortMembers(withRole.filter((entry) => entry.categoryId === category.id)),
  }));

  // On the main roster, everyone not placed into any band in the department
  // waits in "Unassigned" until command places them.
  if (options.unassignedBand) {
    const known =
      options.knownCategoryIds ?? new Set((subdivision.categories || []).map((c) => c.id));
    const leftover = withRole.filter((entry) => !entry.categoryId || !known.has(entry.categoryId));
    if (leftover.length > 0) {
      categories.push({
        id: "cat-unassigned",
        name: "Unassigned",
        color: "#64748b",
        unassigned: true,
        members: sortMembers(leftover),
      });
    }
  }
  return categories;
}

/** Seniority first, then callsign, then name — the order a roster is read in. */
function sortMembers(rows) {
  return [...rows].sort(
    (a, b) =>
      (b.order ?? 0) - (a.order ?? 0) ||
      String(a.callsign || "").localeCompare(String(b.callsign || ""), undefined, {
        numeric: true,
      }) ||
      String(a.characterName || "").localeCompare(String(b.characterName || "")),
  );
}

/**
 * The full projection for a department: every subdivision with its categories
 * filled in. A subdivision naming `roleKeys` takes only those ranks; the main
 * roster takes everyone in the department.
 */
export function projectRoster(config, roster, roleMap) {
  const members = (roster || []).filter((entry) => entry.department === config.id);
  const rankOrder = config.roster?.rankOrder || null;
  const subdivisions = config.roster?.subdivisions || [];
  const knownCategoryIds = new Set(subdivisions.flatMap((s) => (s.categories || []).map((c) => c.id)));
  const mainId = (subdivisions.find((s) => s.main) ?? subdivisions[0])?.id;
  return subdivisions.map((subdivision) => {
    const own = new Set((subdivision.categories || []).map((c) => c.id));
    const isMain = subdivision.id === mainId;
    // The main roster holds its own bands plus everyone not yet placed anywhere;
    // a unit roster (say, SWAT) shows only the members placed into its own bands.
    const scoped = isMain
      ? members.filter(
          (entry) =>
            !entry.categoryId || own.has(entry.categoryId) || !knownCategoryIds.has(entry.categoryId),
        )
      : members.filter((entry) => own.has(entry.categoryId));
    return {
      ...subdivision,
      categories: projectSubdivision(subdivision, scoped, roleMap, rankOrder, {
        unassignedBand: isMain,
        knownCategoryIds,
      }),
      total: scoped.length,
    };
  });
}

/**
 * Compute one configured stat over a subdivision. `mode` mirrors the reference
 * implementation's roster metrics: a headcount, a count by activity status, or a
 * count of one category.
 */
export function statValue(item, subdivision) {
  const all = (subdivision.categories || []).flatMap((category) => category.members);
  switch (item.mode) {
    case "status":
      return all.filter((member) => member.status === item.statusValue).length;
    case "category":
      return (
        subdivision.categories.find((category) => category.id === item.categoryId)?.members
          .length ?? 0
      );
    case "manual":
      return item.value ?? 0;
    default:
      return all.length;
  }
}

/**
 * The chain of command, as tiers. Categories are already ordered command-first
 * in every config, so the tree is the category order with each band's members
 * sorted by seniority — no second structure to keep in step with the roster.
 */
export function chainFor(subdivision) {
  return (subdivision?.categories || [])
    .filter((category) => !category.unassigned && category.members.length > 0)
    .map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      insigniaUrl: category.insigniaUrl,
      members: category.members,
    }));
}
