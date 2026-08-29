/**
 * The Staff Admin Log — an internal record kept ON staff members.
 *
 * This is deliberately NOT the disciplinary database. A background check
 * (lib/discipline.js) is a record about a community member that follows them and
 * that `/bgcheck` renders; this is the staff team's own private ledger of who
 * resigned, who is on an LOA, who was struck or terminated. Nothing here reaches
 * a background check, and only Senior Admins and up can read or write it.
 *
 * The one behaviour that matters: a TERMINATION archives the member's info. When
 * a staff member is terminated their roster row is usually cleared, so the log
 * snapshots what we knew about them at that moment — otherwise a former staff
 * member's record would be a name with no context a month later.
 *
 * Everything here is pure. Mirrored from client/src/lib/staffLog.js.
 */

/** The kinds of entry, each with the colour its badge renders in. `terminal`
 *  marks the ones that end someone's time on the team and archive their info. */
export const STAFF_LOG_TYPES = [
  { id: "resignation", label: "Resignation", color: "#f97316" },
  { id: "loa", label: "LOA", color: "#f59e0b" },
  { id: "loa_return", label: "LOA Return", color: "#22c55e" },
  { id: "warning", label: "Warning", color: "#eab308" },
  { id: "strike", label: "Strike", color: "#f43f5e" },
  { id: "suspension", label: "Suspension", color: "#a855f7" },
  { id: "demotion", label: "Demotion", color: "#ec4899" },
  { id: "termination", label: "Termination", color: "#ef4444", terminal: true },
  { id: "blacklist", label: "Blacklist", color: "#dc2626", terminal: true },
  { id: "reinstatement", label: "Reinstatement", color: "#14b8a6" },
  { id: "note", label: "Note", color: "#64748b" },
];

export const STAFF_LOG_TYPE_MAP = Object.fromEntries(STAFF_LOG_TYPES.map((t) => [t.id, t]));

export function logTypeLabel(id) {
  return STAFF_LOG_TYPE_MAP[id]?.label ?? id ?? "—";
}

export function logTypeColor(id) {
  return STAFF_LOG_TYPE_MAP[id]?.color ?? "#64748b";
}

/** Whether logging this type ends the member's time on the team and archives them. */
export function isTerminalType(id) {
  return STAFF_LOG_TYPE_MAP[id]?.terminal === true;
}

export const SNOWFLAKE = /^\d{17,20}$/;

const str = (v, max = 1000) => (typeof v === "string" ? v.slice(0, max) : "");
const dateOnly = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

/** A stored row is never trusted — this is what makes it safe to render. */
export function normalizeStaffLog(raw) {
  return {
    id: raw?.id ?? null,
    type: STAFF_LOG_TYPE_MAP[raw?.type] ? raw.type : "note",
    targetName: str(raw?.targetName, 128),
    targetDiscordId: SNOWFLAKE.test(String(raw?.targetDiscordId ?? "")) ? String(raw.targetDiscordId) : "",
    targetRank: str(raw?.targetRank, 64),
    note: str(raw?.note, 2000),
    effectiveAt: dateOnly(raw?.effectiveAt),
    expiresAt: dateOnly(raw?.expiresAt),
    loggedByName: str(raw?.loggedByName, 128),
    loggedByDiscordId: SNOWFLAKE.test(String(raw?.loggedByDiscordId ?? "")) ? String(raw.loggedByDiscordId) : "",
    archived: raw?.archived === true,
    archiveSnapshot: raw?.archiveSnapshot ?? null,
    createdAt: raw?.createdAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
  };
}

/** What is wrong with one somebody is filing, keyed by field. */
export function validateStaffLog(draft) {
  const errors = {};
  if (!STAFF_LOG_TYPE_MAP[draft?.type]) errors.type = "Pick an entry type.";
  if (!String(draft?.targetName ?? "").trim()) errors.targetName = "Who is this about?";
  if (!SNOWFLAKE.test(String(draft?.targetDiscordId ?? "").trim())) {
    errors.targetDiscordId = "A Discord ID is 17 to 20 digits.";
  }
  return { errors, ok: Object.keys(errors).length === 0 };
}

/**
 * Fold one member's entries into a profile — the internal "background" this hub
 * shows for a (often former) staff member: their whole history, counts by type,
 * and whether they are archived, with the snapshot taken at termination.
 */
export function profileFor(entries, { discordId } = {}) {
  const mine = (entries ?? [])
    .map(normalizeStaffLog)
    .filter((e) => e.targetDiscordId === String(discordId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const counts = {};
  for (const e of mine) counts[e.type] = (counts[e.type] ?? 0) + 1;

  const terminal = mine.find((e) => isTerminalType(e.type));
  const latestName = mine.find((e) => e.targetName)?.targetName ?? null;
  const latestRank = mine.find((e) => e.targetRank)?.targetRank ?? null;

  return {
    discordId: String(discordId),
    name: latestName,
    rank: latestRank,
    total: mine.length,
    counts,
    archived: Boolean(terminal),
    snapshot: terminal?.archiveSnapshot ?? null,
    entries: mine,
  };
}
