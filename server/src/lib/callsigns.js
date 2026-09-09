/**
 * Division-aware callsign assignment.
 *
 * A department's roster is arranged into divisions (subdivisions). Each division
 * can carry its own callsign range — a `[min, max]` number span with an optional
 * text prefix — set from the Roster builder. When a member is placed in a
 * division, they are handed the lowest free number in that division's range, so
 * giving someone a rank that lands them in a division mints the top available
 * callsign for it. Seniors (by rank order) get first pick of the low numbers.
 *
 * Resolution order for which range a member draws from:
 *   1. the most specific division they belong to — a non-main division whose
 *      role keys include one of theirs and that has a configured range;
 *   2. otherwise the main roster's range, if it has one;
 *   3. otherwise the department-wide range (the legacy single range), if set.
 * A member already carrying a callsign in their Discord nickname keeps it and
 * reserves that number; a member who resolves to no range gets none.
 *
 * This module is pure — no database. rosterSync feeds it the members and the
 * normalized config and persists what it returns.
 */

/** The digits inside a callsign token ("S-14" → 14, "901" → 901), or NaN. */
export function callsignNumber(value) {
  const m = String(value ?? "").match(/\d+/);
  return m ? Number(m[0]) : NaN;
}

const rangeConfigured = (r) =>
  r && r.auto !== false && Number(r.min) > 0 && Number(r.max) >= Number(r.min);

/** All role keys a division claims — its own plus every band's. */
function divisionRoleKeys(sub) {
  const keys = new Set((Array.isArray(sub.roleKeys) ? sub.roleKeys : []).map(String));
  for (const cat of sub.categories ?? []) {
    for (const k of cat.roleKeys ?? []) keys.add(String(k));
  }
  return keys;
}

/**
 * Turn a department config into the ordered list of division ranges used for
 * assignment: each entry is `{ id, main, roleKeys:Set, min, max, prefix }`, only
 * for divisions that actually carry a configured range, plus a synthetic
 * department-wide entry (id `__dept__`) when the legacy range is set.
 */
export function divisionRanges(deptConfig) {
  const subs = deptConfig?.roster?.subdivisions ?? [];
  const mainId = subs.find((s) => s.main)?.id ?? subs[0]?.id ?? null;
  const out = [];
  for (const sub of subs) {
    if (!rangeConfigured(sub.callsigns)) continue;
    out.push({
      id: sub.id,
      main: sub.id === mainId,
      roleKeys: divisionRoleKeys(sub),
      min: Math.trunc(sub.callsigns.min),
      max: Math.trunc(sub.callsigns.max),
      prefix: String(sub.callsigns.prefix ?? ""),
    });
  }
  const deptFallback = deptConfig?.roster?.callsigns;
  if (rangeConfigured(deptFallback)) {
    out.push({
      id: "__dept__",
      main: false,
      dept: true,
      roleKeys: new Set(),
      min: Math.trunc(deptFallback.min),
      max: Math.trunc(deptFallback.max),
      prefix: "",
    });
  }
  return out;
}

/** The range a member draws their callsign from, or null. */
function rangeForMember(member, ranges) {
  const keys = member.roleKeys ?? [];
  const hits = (set) => keys.some((k) => set.has(String(k)));
  // A specialised (non-main, non-dept) division the member belongs to wins.
  for (const r of ranges) {
    if (r.main || r.dept) continue;
    if (r.roleKeys.size && hits(r.roleKeys)) return r;
  }
  // Then the main roster's own range.
  const main = ranges.find((r) => r.main);
  if (main) return main;
  // Then the legacy department-wide range.
  return ranges.find((r) => r.dept) ?? null;
}

/**
 * Decide every member's callsign. Returns a Map of discordId → callsign string
 * for those who should hold one; members not in the map hold none (their stored
 * number, if any, should be cleared).
 *
 * @param members  [{ discordId, nickCallsign, roleKeys:[], order }]
 * @param deptConfig  normalized department config
 * @param existing  Map(discordId → current callsign string)
 */
export function planCallsigns(members, deptConfig, existing = new Map()) {
  const ranges = divisionRanges(deptConfig);
  const result = new Map();
  if (!ranges.length) return result;

  // Group members by the range they resolve to.
  const buckets = new Map(); // rangeId → { range, list }
  for (const m of members) {
    const r = rangeForMember(m, ranges);
    if (!r) continue;
    if (!buckets.has(r.id)) buckets.set(r.id, { range: r, list: [] });
    buckets.get(r.id).list.push(m);
  }

  const bySeniority = (a, b) => (b.order ?? 0) - (a.order ?? 0);

  for (const { range, list } of buckets.values()) {
    const occupied = new Set();
    // Nickname callsigns reserve their number (the member keeps it, unstored).
    for (const m of list) {
      const n = callsignNumber(m.nickCallsign);
      if (Number.isFinite(n) && n >= range.min && n <= range.max) occupied.add(n);
    }
    const ordered = [...list].sort(bySeniority);
    // Keep a valid, unclaimed number the member already has.
    for (const m of ordered) {
      if (m.nickCallsign) continue;
      const n = callsignNumber(existing.get(m.discordId));
      if (Number.isFinite(n) && n >= range.min && n <= range.max && !occupied.has(n)) {
        result.set(m.discordId, `${range.prefix}${n}`);
        occupied.add(n);
      }
    }
    // Hand the lowest free number to everyone still without one, seniors first.
    let cursor = range.min;
    for (const m of ordered) {
      if (m.nickCallsign || result.has(m.discordId)) continue;
      while (cursor <= range.max && occupied.has(cursor)) cursor += 1;
      if (cursor > range.max) break; // range exhausted — the rest go unnumbered
      result.set(m.discordId, `${range.prefix}${cursor}`);
      occupied.add(cursor);
      cursor += 1;
    }
  }

  return result;
}
