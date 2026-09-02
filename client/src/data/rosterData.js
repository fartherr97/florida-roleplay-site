/**
 * The community roster and the Discord role map behind it.
 *
 * This file is the single source of truth for "which Discord role means which
 * department and rank". The Discord bot does not hardcode any of it — it reads
 * the map from `GET /api/roster/role-map` and posts role changes back to
 * `POST /api/roster/sync`, which is what keeps the roster, the site and Discord
 * display names in step. Mirrored in server/src/rosterSeed.js.
 *
 * TODO: replace every `roleId` below with the real Discord role snowflake before
 * pointing the bot at a live guild. The keys and ranks are already correct; only
 * the ids are placeholders.
 */

/* ------------------------------------------------------------------ *
 * Divisions and departments
 * ------------------------------------------------------------------ */

export const DIVISIONS = [
  { id: "civilian", label: "Civilian", tone: "slate" },
  { id: "law", label: "Law Enforcement", tone: "brand" },
  { id: "federal", label: "Federal", tone: "amber" },
  { id: "staff", label: "Staff", tone: "primary" },
  { id: "management", label: "Management", tone: "green" },
];

export const DEPARTMENTS = [
  { id: "civilian", label: "Civilian", abbr: "CIV", division: "civilian", tone: "slate" },
  { id: "fhp", label: "Florida Highway Patrol", abbr: "FHP", division: "law", tone: "brand" },
  { id: "bso", label: "Broward County Sheriff's Office", abbr: "BSO", division: "law", tone: "green" },
  { id: "mpd", label: "Miami Police Department", abbr: "MPD", division: "law", tone: "brand" },
  { id: "staff", label: "Staff Team", abbr: "STAFF", division: "staff", tone: "primary" },
  { id: "management", label: "Management", abbr: "MGMT", division: "management", tone: "green" },
];

/* ------------------------------------------------------------------ *
 * Discord role map
 * ------------------------------------------------------------------ *
 *
 * Each entry maps one Discord role onto a department and rank.
 *
 * `order` breaks ties: a member holding several mapped roles is rostered under
 * the highest order, so promoting someone does not need the old role removed
 * first — and staff ranks outrank department ranks, so a Sr. Admin who also
 * troops for FHP is rostered as staff.
 *
 * `rank` is the short form that appears in a name ("Sr. Admin", "Prob. FF");
 * `rankFull` is the long label the roster table shows. `displayTemplate` is what
 * the bot applies as the Discord nickname, following the community convention
 * `{callsign} | {rank} | {surname}` — for example "122 | Sr. Admin | Jones".
 * `{dept}`, `{first}`, `{initial}`, `{name}` and `{rankFull}` are also available.
 */
export const ROLE_MAP = [
  { roleId: "100000000000000001", key: "cert_civ_1", department: "civilian", rank: "Cert. Civ. I", rankFull: "Certified Civilian I", order: 10, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000002", key: "cert_civ_2", department: "civilian", rank: "Cert. Civ. II", rankFull: "Certified Civilian II", order: 20, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000003", key: "cert_civ_3", department: "civilian", rank: "Cert. Civ. III", rankFull: "Certified Civilian III", order: 30, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000004", key: "fhp_trooper", department: "fhp", rank: "Trooper", rankFull: "Trooper", order: 100, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000005", key: "fhp_senior_trooper", department: "fhp", rank: "Sr. Trooper", rankFull: "Senior Trooper", order: 105, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000006", key: "fhp_corporal", department: "fhp", rank: "Cpl.", rankFull: "Corporal", order: 110, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000007", key: "fhp_sergeant", department: "fhp", rank: "Sgt.", rankFull: "Sergeant", order: 115, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000008", key: "fhp_lieutenant", department: "fhp", rank: "Lt.", rankFull: "Lieutenant", order: 120, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000009", key: "fhp_captain", department: "fhp", rank: "Capt.", rankFull: "Captain", order: 125, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000010", key: "fhp_colonel", department: "fhp", rank: "Col.", rankFull: "Colonel", order: 130, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000011", key: "bso_deputy", department: "bso", rank: "Deputy", rankFull: "Deputy", order: 100, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000012", key: "bso_master_deputy", department: "bso", rank: "M. Deputy", rankFull: "Master Deputy", order: 105, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000013", key: "bso_corporal", department: "bso", rank: "Cpl.", rankFull: "Corporal", order: 110, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000014", key: "bso_sergeant", department: "bso", rank: "Sgt.", rankFull: "Sergeant", order: 115, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000015", key: "bso_lieutenant", department: "bso", rank: "Lt.", rankFull: "Lieutenant", order: 120, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000016", key: "bso_major", department: "bso", rank: "Maj.", rankFull: "Major", order: 125, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000017", key: "bso_sheriff", department: "bso", rank: "Sheriff", rankFull: "Sheriff", order: 130, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000018", key: "mpd_officer", department: "mpd", rank: "Officer", rankFull: "Officer", order: 100, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000019", key: "mpd_senior_officer", department: "mpd", rank: "Sr. Officer", rankFull: "Senior Officer", order: 105, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000020", key: "mpd_corporal", department: "mpd", rank: "Cpl.", rankFull: "Corporal", order: 110, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000021", key: "mpd_sergeant", department: "mpd", rank: "Sgt.", rankFull: "Sergeant", order: 115, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000022", key: "mpd_lieutenant", department: "mpd", rank: "Lt.", rankFull: "Lieutenant", order: 120, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000023", key: "mpd_captain", department: "mpd", rank: "Capt.", rankFull: "Captain", order: 125, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000024", key: "mpd_chief", department: "mpd", rank: "Chief", rankFull: "Chief of Police", order: 130, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000036", key: "trial_mod", department: "staff", rank: "Trial Mod", rankFull: "Trial Moderator", order: 200, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000037", key: "mod", department: "staff", rank: "Mod", rankFull: "Moderator", order: 210, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000038", key: "senior_mod", department: "staff", rank: "Sr. Mod", rankFull: "Senior Moderator", order: 220, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000039", key: "junior_admin", department: "staff", rank: "Jr. Admin", rankFull: "Junior Administrator", order: 230, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000040", key: "admin", department: "staff", rank: "Admin", rankFull: "Administrator", order: 240, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000041", key: "senior_admin", department: "staff", rank: "Sr. Admin", rankFull: "Senior Administrator", order: 250, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000042", key: "head_admin", department: "staff", rank: "Head Admin", rankFull: "Head Administrator", order: 260, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000043", key: "directorship", department: "management", rank: "Director", rankFull: "Directorship", order: 300, displayTemplate: "{callsign} | {rank} | {surname}" },
];

/**
 * Discord roles the community uses that are not a rostered rank: membership,
 * whitelisting and status tags. They are mapped on the same page as the ranks —
 * "everything tied to a Discord role" means these too.
 */
export const SPECIAL_ROLES = [
  // TODO: replace every roleId with the real Discord snowflake.
  { roleId: "100000000000000801", key: "member", kind: "base", label: "Member", detail: "Anyone in the Discord server." },
  { roleId: "100000000000000802", key: "whitelisted", kind: "base", label: "Whitelisted", detail: "Approved onto the game server." },
  { roleId: "100000000000000803", key: "ownership", kind: "tier", label: "Ownership", detail: "Holds every permission. Deliberately never rostered — the people who own the community are not a seat on a team." },
  { roleId: "100000000000000900", key: "loa", kind: "tag", label: "LOA", detail: "Applied while a member is on leave; removed by the expiry sweep." },
];

/* ------------------------------------------------------------------ *
 * Activity status
 * ------------------------------------------------------------------ *
 *
 * LOA is special: it carries a return date, and the bot mirrors it with a
 * Discord tag it removes when that date passes. Everything else is a plain
 * label someone with `roster.edit_status` can set.
 */
export const ACTIVITY_STATUSES = [
  { id: "Active", label: "Active", tone: "green", color: "#10b981", detail: "Playing and taking calls as normal." },
  { id: "Semi-Active", label: "Semi-Active", tone: "brand", color: "#3b82f6", detail: "Around, but not meeting full activity requirements." },
  { id: "Training", label: "Training", tone: "primary", color: "#f2800d", detail: "In their probationary period, shadowing a supervisor." },
  { id: "LOA", label: "LOA", tone: "amber", color: "#f59e0b", detail: "On leave with an agreed return date.", requiresDate: true },
  { id: "Inactive", label: "Inactive", tone: "slate", color: "#94a3b8", detail: "Not currently playing. Subject to removal after 30 days." },
  { id: "Suspended", label: "Suspended", tone: "rose", color: "#f43f5e", detail: "Access withheld pending a staff decision." },
];

/** The colour a status renders as in count strips and statistics bars. */
export function statusColor(id) {
  return ACTIVITY_STATUSES.find((status) => status.id === id)?.color ?? "#94a3b8";
}

/**
 * The Discord role the bot applies while someone is on leave. Its snowflake is
 * editable on the role mapping page like every other role; this is the fallback
 * used before anything has been mapped.
 */
export const LOA_ROLE = {
  roleId: "100000000000000900",
  key: "loa",
  label: "LOA",
};

/* ------------------------------------------------------------------ *
 * Roster entries
 * ------------------------------------------------------------------ */

export const roster = [];

/** Most recent bot activity, newest first. */
export const syncLog = [];
