/**
 * Roster helpers shared by the site and mirrored on the server. The nickname
 * builder in particular is the contract the Discord bot applies as a member's
 * server nickname, so keep this and server/src/lib/roster.js identical.
 */

/** Splits a character name into the parts a display template can reference. */
export function nameParts(characterName = "") {
  const parts = String(characterName).trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  // A one-word character name has no surname to abbreviate against, so it acts
  // as the surname and the initial drops out rather than rendering "Deputy C.".
  const hasSurname = parts.length > 1;
  return {
    first,
    surname: hasSurname ? parts[parts.length - 1] : first,
    initial: hasSurname ? first.charAt(0).toUpperCase() : "",
    full: parts.join(" "),
  };
}

/**
 * Renders a display template against a roster entry. Unknown placeholders
 * collapse to nothing rather than leaking `{braces}` into a nickname, and the
 * result is tidied so dropped values leave no orphaned punctuation or brackets.
 */
export function renderDisplayName(template, entry, department) {
  const { first, surname, initial, full } = nameParts(entry?.characterName);
  const values = {
    // `rank` is the short form that goes in a name — "Sr. Admin", "Mod",
    // "Cert. Civ. II" — while `rankFull` is the long label the roster table
    // shows. They are the same for most department ranks.
    rank: entry?.rank ?? "",
    rankFull: entry?.rankFull ?? entry?.rank ?? "",
    dept: department?.abbr ?? "",
    department: department?.label ?? "",
    callsign: entry?.callsign ?? "",
    first,
    surname,
    initial,
    name: full,
  };

  return String(template ?? "{first} {surname}")
    .replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "")
    .replace(/\[\s*\]|\(\s*\)/g, "") // brackets left empty by a missing dept
    .replace(/(^|\s)\.(?=\s|$)/g, "$1") // a lone "." left by a missing initial
    .replace(/\s*\|\s*(\|\s*)+/g, " | ") // separators either side of a dropped value
    .replace(/\s*·\s*(·\s*)+/g, " · ")
    .replace(/(^[\s|·]+|[\s|·]+$)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Picks the mapped role a member should be rostered under. Highest `order`
 * wins, so a promotion takes effect without removing the previous role first.
 */
export function resolveRole(roleIds = [], roleMap = []) {
  const held = new Set(roleIds.map(String));
  return (
    roleMap
      .filter((entry) => held.has(String(entry.roleId)))
      .sort((a, b) => b.order - a.order)[0] ?? null
  );
}

/** Discord caps server nicknames at 32 characters. */
export const NICKNAME_MAX = 32;

/**
 * Builds the nickname the bot should set, falling back to progressively shorter
 * forms until one fits Discord's limit.
 */
export function buildNickname(entry, department, template) {
  // Community convention is "{callsign} | {rank} | {surname}", e.g.
  // "122 | Sr. Admin | Jones". If that does not fit Discord's 32-character
  // nickname limit, the callsign goes first and the rank second — the person's
  // name is the last thing to drop, since a nickname nobody can be identified by
  // defeats the point.
  const candidates = [
    template,
    "{rank} | {surname}",
    "{callsign} | {surname}",
    "{surname}",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const rendered = renderDisplayName(candidate, entry, department);
    if (rendered && rendered.length <= NICKNAME_MAX) return rendered;
  }

  // Every form was still too long — clip the first one on a word boundary.
  const fallback = renderDisplayName(candidates[0], entry, department);
  const clipped = fallback.slice(0, NICKNAME_MAX);
  const lastSpace = clipped.lastIndexOf(" ");
  return (lastSpace > 12 ? clipped.slice(0, lastSpace) : clipped).trim();
}
