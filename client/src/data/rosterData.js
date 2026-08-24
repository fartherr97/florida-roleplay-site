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
  { id: "fire", label: "Fire & EMS", tone: "rose" },
  { id: "federal", label: "Federal", tone: "amber" },
  { id: "staff", label: "Staff", tone: "primary" },
  { id: "management", label: "Management", tone: "green" },
];

export const DEPARTMENTS = [
  { id: "civilian", label: "Civilian", abbr: "CIV", division: "civilian", tone: "slate" },
  { id: "fhp", label: "Florida Highway Patrol", abbr: "FHP", division: "law", tone: "brand" },
  { id: "hcso", label: "Hillsborough County Sheriff's Office", abbr: "HCSO", division: "law", tone: "green" },
  { id: "tpd", label: "Tampa Police Department", abbr: "TPD", division: "law", tone: "brand" },
  { id: "hcfr", label: "Hillsborough County Fire Rescue", abbr: "HCFR", division: "fire", tone: "rose" },
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
  { roleId: "100000000000000011", key: "hcso_deputy", department: "hcso", rank: "Deputy", rankFull: "Deputy", order: 100, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000012", key: "hcso_master_deputy", department: "hcso", rank: "M. Deputy", rankFull: "Master Deputy", order: 105, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000013", key: "hcso_corporal", department: "hcso", rank: "Cpl.", rankFull: "Corporal", order: 110, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000014", key: "hcso_sergeant", department: "hcso", rank: "Sgt.", rankFull: "Sergeant", order: 115, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000015", key: "hcso_lieutenant", department: "hcso", rank: "Lt.", rankFull: "Lieutenant", order: 120, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000016", key: "hcso_major", department: "hcso", rank: "Maj.", rankFull: "Major", order: 125, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000017", key: "hcso_sheriff", department: "hcso", rank: "Sheriff", rankFull: "Sheriff", order: 130, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000018", key: "tpd_officer", department: "tpd", rank: "Officer", rankFull: "Officer", order: 100, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000019", key: "tpd_senior_officer", department: "tpd", rank: "Sr. Officer", rankFull: "Senior Officer", order: 105, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000020", key: "tpd_corporal", department: "tpd", rank: "Cpl.", rankFull: "Corporal", order: 110, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000021", key: "tpd_sergeant", department: "tpd", rank: "Sgt.", rankFull: "Sergeant", order: 115, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000022", key: "tpd_lieutenant", department: "tpd", rank: "Lt.", rankFull: "Lieutenant", order: 120, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000023", key: "tpd_captain", department: "tpd", rank: "Capt.", rankFull: "Captain", order: 125, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000024", key: "tpd_chief", department: "tpd", rank: "Chief", rankFull: "Chief of Police", order: 130, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000025", key: "hcfr_probationary", department: "hcfr", rank: "Prob. FF", rankFull: "Probationary Firefighter", order: 95, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000026", key: "hcfr_firefighter", department: "hcfr", rank: "FF", rankFull: "Firefighter", order: 100, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000027", key: "hcfr_paramedic", department: "hcfr", rank: "FF/PM", rankFull: "Firefighter/Paramedic", order: 105, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000028", key: "hcfr_engineer", department: "hcfr", rank: "Engineer", rankFull: "Driver Engineer", order: 110, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000029", key: "hcfr_lieutenant", department: "hcfr", rank: "Lt.", rankFull: "Lieutenant", order: 115, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000030", key: "hcfr_battalion_chief", department: "hcfr", rank: "Batt. Chief", rankFull: "Battalion Chief", order: 125, displayTemplate: "{callsign} | {rank} | {surname}" },
  { roleId: "100000000000000031", key: "hcfr_fire_chief", department: "hcfr", rank: "Fire Chief", rankFull: "Fire Chief", order: 130, displayTemplate: "{callsign} | {rank} | {surname}" },
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

export const roster = [
  { id: "rm-1", discordId: "402118844500000900", characterName: "Marcus Reyes", displayName: "101 | Head Admin | Reyes", department: "staff", rank: "Head Admin", rankFull: "Head Administrator", callsign: "101", status: "Active", joinedAt: "2024-03-04", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-2", discordId: "402118844500000901", characterName: "Dana Whitfield", displayName: "102 | Head Admin | Whitfield", department: "staff", rank: "Head Admin", rankFull: "Head Administrator", callsign: "102", status: "Active", joinedAt: "2024-05-19", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-3", discordId: "402118844500000902", characterName: "Alex Duarte", displayName: "122 | Sr. Admin | Duarte", department: "staff", rank: "Sr. Admin", rankFull: "Senior Administrator", callsign: "122", status: "Active", joinedAt: "2024-06-02", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-4", discordId: "402118844500000903", characterName: "Priya Raman", displayName: "124 | Sr. Admin | Raman", department: "staff", rank: "Sr. Admin", rankFull: "Senior Administrator", callsign: "124", status: "Active", joinedAt: "2024-07-11", syncedAt: "2026-08-21T09:12:00Z", source: "discord-sync" },
  { id: "rm-5", discordId: "402118844500000904", characterName: "Sam Bennett", displayName: "140 | Admin | Bennett", department: "staff", rank: "Admin", rankFull: "Administrator", callsign: "140", status: "Active", joinedAt: "2024-09-23", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-6", discordId: "402118844500000905", characterName: "Noor Haddad", displayName: "151 | Jr. Admin | Haddad", department: "staff", rank: "Jr. Admin", rankFull: "Junior Administrator", callsign: "151", status: "Active", joinedAt: "2024-11-08", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-7", discordId: "402118844500000906", characterName: "Jamie Okonkwo", displayName: "160 | Sr. Mod | Okonkwo", department: "staff", rank: "Sr. Mod", rankFull: "Senior Moderator", callsign: "160", status: "Active", joinedAt: "2025-01-16", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-8", discordId: "402118844500000907", characterName: "Jacob Reyna", displayName: "167 | Mod | Reyna", department: "staff", rank: "Mod", rankFull: "Moderator", callsign: "167", status: "Active", joinedAt: "2025-03-22", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-9", discordId: "402118844500000908", characterName: "Wren Castellano", displayName: "181 | Trial Mod | Castellano", department: "staff", rank: "Trial Mod", rankFull: "Trial Moderator", callsign: "181", status: "Active", joinedAt: "2026-06-20", syncedAt: "2026-08-20T14:31:00Z", source: "discord-sync" },
  { id: "rm-10", discordId: "402118844500000910", characterName: "Rex Vance", displayName: "1-A-1 | Col. | Vance", department: "fhp", rank: "Col.", rankFull: "Colonel", callsign: "1-A-1", status: "Active", joinedAt: "2024-08-14", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-11", discordId: "402118844500000911", characterName: "Nadia Kowalski", displayName: "1-L-4 | Lt. | Kowalski", department: "fhp", rank: "Lt.", rankFull: "Lieutenant", callsign: "1-L-4", status: "Active", joinedAt: "2025-03-09", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-12", discordId: "402118844500000912", characterName: "Owen Brady", displayName: "1-T-18 | Sr. Trooper | Brady", department: "fhp", rank: "Sr. Trooper", rankFull: "Senior Trooper", callsign: "1-T-18", status: "Active", joinedAt: "2025-07-22", syncedAt: "2026-08-19T21:50:00Z", source: "discord-sync" },
  { id: "rm-13", discordId: "402118844500000913", characterName: "Sofia Delacroix", displayName: "1-T-31 | Trooper | Delacroix", department: "fhp", rank: "Trooper", rankFull: "Trooper", callsign: "1-T-31", status: "Active", joinedAt: "2026-04-30", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-14", discordId: "402118844500000920", characterName: "Lena Moreau", displayName: "2-S-1 | Sheriff | Moreau", department: "hcso", rank: "Sheriff", rankFull: "Sheriff", callsign: "2-S-1", status: "Active", joinedAt: "2024-09-01", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-15", discordId: "402118844500000921", characterName: "Gus Pham", displayName: "2-G-7 | Sgt. | Pham", department: "hcso", rank: "Sgt.", rankFull: "Sergeant", callsign: "2-G-7", status: "Active", joinedAt: "2025-05-16", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-16", discordId: "402118844500000922", characterName: "Marisol Vega", displayName: "2-D-22 | M. Deputy | Vega", department: "hcso", rank: "M. Deputy", rankFull: "Master Deputy", callsign: "2-D-22", status: "Active", joinedAt: "2025-10-04", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-17", discordId: "402118844500000923", characterName: "Toby Marsh", displayName: "2-D-40 | Deputy | Marsh", department: "hcso", rank: "Deputy", rankFull: "Deputy", callsign: "2-D-40", status: "LOA", loaUntil: "2026-09-15", joinedAt: "2025-08-01", syncedAt: "2026-08-12T10:07:00Z", source: "manual" },
  { id: "rm-18", discordId: "402118844500000930", characterName: "Teo Alvarez", displayName: "3-C-1 | Chief | Alvarez", department: "tpd", rank: "Chief", rankFull: "Chief of Police", callsign: "3-C-1", status: "Active", joinedAt: "2024-10-12", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-19", discordId: "402118844500000931", characterName: "Bianca Ruiz", displayName: "3-K-2 | Capt. | Ruiz", department: "tpd", rank: "Capt.", rankFull: "Captain", callsign: "3-K-2", status: "Active", joinedAt: "2025-02-11", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-20", discordId: "402118844500000932", characterName: "Kai Lindqvist", displayName: "3-O-15 | Cpl. | Lindqvist", department: "tpd", rank: "Cpl.", rankFull: "Corporal", callsign: "3-O-15", status: "Active", joinedAt: "2025-04-30", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-21", discordId: "402118844500000933", characterName: "Ivy Sørensen", displayName: "3-O-38 | Officer | Sørensen", department: "tpd", rank: "Officer", rankFull: "Officer", callsign: "3-O-38", status: "Active", joinedAt: "2026-05-19", syncedAt: "2026-08-21T16:22:00Z", source: "discord-sync" },
  { id: "rm-22", discordId: "402118844500000940", characterName: "Mick Doyle", displayName: "4-C-1 | Fire Chief | Doyle", department: "hcfr", rank: "Fire Chief", rankFull: "Fire Chief", callsign: "4-C-1", status: "Active", joinedAt: "2024-11-20", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-23", discordId: "402118844500000941", characterName: "Elena Marquez", displayName: "4-R-3 | FF/PM | Marquez", department: "hcfr", rank: "FF/PM", rankFull: "Firefighter/Paramedic", callsign: "4-R-3", status: "Active", joinedAt: "2025-11-03", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-24", discordId: "402118844500000942", characterName: "Hal Brennan", displayName: "4-E-12 | Engineer | Brennan", department: "hcfr", rank: "Engineer", rankFull: "Driver Engineer", callsign: "4-E-12", status: "Active", joinedAt: "2025-06-27", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-25", discordId: "402118844500000943", characterName: "Bex Ferreira", displayName: "4-P-9 | Prob. FF | Ferreira", department: "hcfr", rank: "Prob. FF", rankFull: "Probationary Firefighter", callsign: "4-P-9", status: "Active", joinedAt: "2026-08-02", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-28", discordId: "402118844500000960", characterName: "Deshawn Carter", displayName: "Cert. Civ. III | Carter", department: "civilian", rank: "Cert. Civ. III", rankFull: "Certified Civilian III", callsign: "", status: "Active", joinedAt: "2026-02-18", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-29", discordId: "402118844500000961", characterName: "Ted Okafor", displayName: "Cert. Civ. II | Okafor", department: "civilian", rank: "Cert. Civ. II", rankFull: "Certified Civilian II", callsign: "", status: "Active", joinedAt: "2025-09-14", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-30", discordId: "402118844500000962", characterName: "Priya Sandoval", displayName: "Cert. Civ. II | Sandoval", department: "civilian", rank: "Cert. Civ. II", rankFull: "Certified Civilian II", callsign: "", status: "Active", joinedAt: "2025-12-01", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-31", discordId: "402118844500000963", characterName: "Rosa Delgado", displayName: "Cert. Civ. I | Delgado", department: "civilian", rank: "Cert. Civ. I", rankFull: "Certified Civilian I", callsign: "", status: "Active", joinedAt: "2025-06-14", syncedAt: "2026-08-22T18:04:00Z", source: "discord-sync" },
  { id: "rm-32", discordId: "402118844500000964", characterName: "Iggy Salas", displayName: "Cert. Civ. I | Salas", department: "civilian", rank: "Cert. Civ. I", rankFull: "Certified Civilian I", callsign: "", status: "Inactive", joinedAt: "2026-07-09", syncedAt: "2026-08-05T12:44:00Z", source: "discord-sync" },
];

/** Most recent bot activity, newest first. */
export const syncLog = [
  { id: "sl-6", discordId: "402118844500000907", characterName: "Jacob Reyna", action: "updated", detail: "Promoted to Mod — nickname set to 167 | Mod | Reyna.", actor: "roster-bot", at: "2026-08-22T18:04:00Z" },
  { id: "sl-5", discordId: "402118844500000913", characterName: "Sofia Delacroix", action: "updated", detail: "FHP Trooper role granted — nickname set to 1-T-31 | Trooper | Delacroix.", actor: "roster-bot", at: "2026-08-22T18:02:00Z" },
  { id: "sl-4", discordId: "402118844500000943", characterName: "Bex Ferreira", action: "added", detail: "HCFR Probationary Firefighter role granted.", actor: "roster-bot", at: "2026-08-22T17:58:00Z" },
  { id: "sl-3", discordId: "402118844500000933", characterName: "Ivy Sørensen", action: "updated", detail: "Callsign changed to 3-O-38.", actor: "roster-bot", at: "2026-08-21T16:22:00Z" },
  { id: "sl-2", discordId: "402118844500000964", characterName: "Iggy Salas", action: "flagged", detail: "No mapped roles for 30 days — marked inactive.", actor: "roster-bot", at: "2026-08-05T12:44:00Z" },
  { id: "sl-1", discordId: "402118844500000970", characterName: "M. Boyle", action: "removed", detail: "All department roles removed following staff removal.", actor: "roster-bot", at: "2026-05-02T20:11:00Z" },
];
