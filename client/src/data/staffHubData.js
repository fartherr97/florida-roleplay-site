/**
 * Mock content for the Staff Hub. Mirrors server/src/staffHubSeed.js so the hub
 * renders fully before (and without) a database, exactly like the public site.
 *
 * The shapes follow the community's existing staff hub: a portal home with
 * reminders and a featured member, rank-scoped link collections, and an exam
 * backend built around three staff exams (Trial Mod, Sr. Mod, Admin)
 * whose scores can be manually overridden with an audit trail.
 */

/* ------------------------------------------------------------------ *
 * Portal home
 * ------------------------------------------------------------------ */

export const portal = {
  reminders: [
    "Claim your tickets before working them — double-handled tickets are the top cause of conflicting rulings.",
    "Vest hours reset on the 1st. Trial Mods need eight logged hours before their review.",
    "Any ban over seven days needs a Sr. Admin's sign-off before you issue it.",
  ],
  featuredMember: {
    name: "Jamie Okonkwo",
    rank: "Sr. Mod",
    note: "Cleared the weekend backlog single-handedly and rewrote the pursuit-policy macro the whole team now uses.",
    claims: "212",
    vestHours: "46",
  },
  quickNotes:
    "Season 3 whitelist wave opens the first weekend of next month — expect roughly double the usual application volume.\n\nThe MDT evidence bug is fixed in v2.14.1. If a member reports duplicate lockers, ask them to reconnect before escalating.\n\nReminder: staff DMs are not a support channel. Redirect to a ticket every time, politely.",
};

export const portalLinks = {
  allStaff: [
    { title: "Staff Handbook", url: "https://example.com/flrp/staff-handbook" },
    { title: "Ticket Response Templates", url: "https://example.com/flrp/templates" },
    { title: "Sanction Guidelines", url: "https://example.com/flrp/sanctions" },
    { title: "Evidence Retention Policy", url: "https://example.com/flrp/evidence" },
    { title: "Shift Sign-Up Sheet", url: "https://example.com/flrp/shifts" },
    { title: "Rule Change Log", url: "https://example.com/flrp/rule-changes" },
  ],
  administrators: [
    { title: "Ban Appeal Review Queue", url: "https://example.com/flrp/appeals" },
    { title: "Escalation Playbook", url: "https://example.com/flrp/escalation" },
    { title: "Server Log Search", url: "https://example.com/flrp/logs" },
    { title: "Trial Mod Evaluations", url: "https://example.com/flrp/evaluations" },
  ],
  seniorAdmins: [
    { title: "Staff Payroll & Perks", url: "https://example.com/flrp/perks" },
    { title: "Department Head Sync Notes", url: "https://example.com/flrp/dept-sync" },
    { title: "Permanent Ban Register", url: "https://example.com/flrp/perm-bans" },
    { title: "Staff Recruitment Pipeline", url: "https://example.com/flrp/pipeline" },
  ],
};

/* ------------------------------------------------------------------ *
 * Staff roster
 * ------------------------------------------------------------------ */

export const STAFF_TEAMS = [
  { id: "ownership", label: "Ownership", color: "#e879f9", rankIds: ["ownership"] },
  { id: "directorship", label: "Directorship", color: "#f59e0b", rankIds: ["directorship"] },
  { id: "head-admin", label: "Head Administration Team", color: "#22d3ee", rankIds: ["head_admin"] },
  { id: "senior-admin", label: "Senior Administration Team", color: "#f43f5e", rankIds: ["senior_admin"] },
  { id: "admin", label: "Administration Team", color: "#f2800d", rankIds: ["admin"] },
  { id: "junior-admin", label: "Junior Administration Team", color: "#8b5cf6", rankIds: ["junior_admin"] },
  { id: "senior-mod", label: "Senior Moderation Team", color: "#10b981", rankIds: ["senior_mod"] },
  { id: "mod", label: "Moderation Team", color: "#3b82f6", rankIds: ["mod"] },
  { id: "trial-mod", label: "Trial Moderation Team", color: "#64748b", rankIds: ["trial_mod"] },
];

/**
 * The staff roster.
 *
 * Callsigns, names and Discord ids deliberately match the same people in
 * src/data/rosterData.js — the community roster is where the Discord bot writes,
 * and this is the operational view of the staff slice of it, carrying the fields
 * that only matter internally (position, hire date, last rank move, notes).
 *
 * A `vacant` entry is a position the team is structured around but nobody holds.
 * Rendering the gap is the point: an empty Assistant Staff Manager slot is
 * information, and dropping it would hide it.
 */
export const roster = [
  { id: "r-1", callsign: "101", name: "Marcus Reyes", handle: "reyes", discordId: "402118844500000900", rank: "Head Admin", rankId: "head_admin", team: "head-admin", position: "Head Administrator", positionNote: "Administrative Head", hired: "2024-03-04", lastMove: "2026-05-26", claims: 88, vestHours: 21, status: "Active", online: true, notes: "" },
  { id: "r-2", callsign: "102", name: "Dana Whitfield", handle: "dwhitfield", discordId: "402118844500000901", rank: "Head Admin", rankId: "head_admin", team: "head-admin", position: "Head Administrator", positionNote: "Operations Head", hired: "2024-05-19", lastMove: "2026-05-28", claims: 74, vestHours: 18, status: "Active", online: false, notes: "" },
  { id: "r-3", callsign: "122", name: "Alex Duarte", handle: "aduarte", discordId: "402118844500000902", rank: "Sr. Admin", rankId: "senior_admin", team: "senior-admin", position: "Senior Administrator", positionNote: "Administrative Coordinator", hired: "2024-06-02", lastMove: "2026-03-29", claims: 341, vestHours: 96, status: "Active", online: true, notes: "" },
  { id: "r-4", callsign: "124", name: "Priya Raman", handle: "praman", discordId: "402118844500000903", rank: "Sr. Admin", rankId: "senior_admin", team: "senior-admin", position: "Senior Administrator", positionNote: "Development Liaison", hired: "2024-07-11", lastMove: "2026-02-14", claims: 129, vestHours: 34, status: "Semi-Active", online: false, notes: "Reduced hours through the semester." },
  { id: "r-5", callsign: "126", name: "Ines Okafor", handle: "iokafor", discordId: "402118844500000904", rank: "Sr. Admin", rankId: "senior_admin", team: "senior-admin", position: "Senior Administrator", positionNote: "Recruitment", hired: "2024-08-30", lastMove: "2026-04-02", claims: 203, vestHours: 58, status: "Active", online: false, notes: "" },
  { id: "r-6", callsign: "140", name: "Sam Bennett", handle: "sbennett", discordId: "402118844500000905", rank: "Admin", rankId: "admin", team: "admin", position: "Administrator", positionNote: "Support", hired: "2024-09-23", lastMove: "2026-01-19", claims: 268, vestHours: 71, status: "Active", online: true, notes: "" },
  { id: "r-7", callsign: "142", name: "Noor Haddad", handle: "nhaddad", discordId: "402118844500000906", rank: "Admin", rankId: "admin", team: "admin", position: "Administrator", positionNote: "Appeals", hired: "2024-11-08", lastMove: "2026-01-19", claims: 254, vestHours: 68, status: "Active", online: false, notes: "" },
  { id: "r-8", callsign: "144", name: "Theo Marchetti", handle: "tmarchetti", discordId: "402118844500000907", rank: "Admin", rankId: "admin", team: "admin", position: "Administrator", positionNote: "Evaluations", hired: "2025-01-05", lastMove: "2026-06-11", claims: 176, vestHours: 49, status: "LOA", loaUntil: "2026-09-30", online: false, notes: "Back on the 30th." },
  { id: "r-9", callsign: "151", name: "Rowan Estes", handle: "restes", discordId: "402118844500000908", rank: "Jr. Admin", rankId: "junior_admin", team: "junior-admin", position: "Junior Administrator", positionNote: "", hired: "2025-02-11", lastMove: "2026-06-11", claims: 141, vestHours: 38, status: "Active", online: false, notes: "" },
  { id: "r-10", callsign: "153", name: "Mira Solberg", handle: "msolberg", discordId: "402118844500000909", rank: "Jr. Admin", rankId: "junior_admin", team: "junior-admin", position: "Junior Administrator", positionNote: "", hired: "2025-03-19", lastMove: "2026-07-04", claims: 122, vestHours: 31, status: "Active", online: true, notes: "" },
  { id: "r-11", callsign: "160", name: "Jamie Okonkwo", handle: "jokonkwo", discordId: "402118844500000910", rank: "Sr. Mod", rankId: "senior_mod", team: "senior-mod", position: "Senior Moderator", positionNote: "", hired: "2025-01-16", lastMove: "2026-04-21", claims: 212, vestHours: 46, status: "Active", online: false, notes: "" },
  { id: "r-12", callsign: "162", name: "Ellis Prator", handle: "eprator", discordId: "402118844500000911", rank: "Sr. Mod", rankId: "senior_mod", team: "senior-mod", position: "Senior Moderator", positionNote: "", hired: "2025-02-27", lastMove: "2026-04-21", claims: 197, vestHours: 41, status: "Active", online: false, notes: "" },
  { id: "r-13", callsign: "167", name: "Jacob Reyna", handle: "jreyna", discordId: "402118844500000912", rank: "Mod", rankId: "mod", team: "mod", position: "Moderator", positionNote: "", hired: "2025-03-22", lastMove: "2026-08-22", claims: 158, vestHours: 37, status: "Active", online: true, notes: "" },
  { id: "r-14", callsign: "169", name: "Kai Lindqvist", handle: "klindqvist", discordId: "402118844500000913", rank: "Mod", rankId: "mod", team: "mod", position: "Moderator", positionNote: "", hired: "2025-04-30", lastMove: "2026-05-30", claims: 143, vestHours: 33, status: "Active", online: false, notes: "" },
  { id: "r-15", callsign: "171", name: "Rosa Delgado", handle: "rdelgado", discordId: "402118844500000914", rank: "Mod", rankId: "mod", team: "mod", position: "Moderator", positionNote: "", hired: "2025-06-14", lastMove: "2026-05-30", claims: 118, vestHours: 29, status: "Active", online: false, notes: "" },
  { id: "r-16", callsign: "173", name: "Toby Marsh", handle: "tmarsh", discordId: "402118844500000915", rank: "Mod", rankId: "mod", team: "mod", position: "Moderator", positionNote: "", hired: "2025-08-01", lastMove: "2026-06-27", claims: 96, vestHours: 24, status: "Inactive", online: false, notes: "No sessions logged since June." },
  { id: "r-17", callsign: "181", name: "Wren Castellano", handle: "wcastellano", discordId: "402118844500000916", rank: "Trial Mod", rankId: "trial_mod", team: "trial-mod", position: "Trial Moderator", positionNote: "", hired: "2026-06-20", lastMove: "2026-06-20", claims: 41, vestHours: 12, status: "Active", online: false, notes: "Off probation: 09/20/2026" },
  { id: "r-18", callsign: "183", name: "Iggy Salas", handle: "isalas", discordId: "402118844500000917", rank: "Trial Mod", rankId: "trial_mod", team: "trial-mod", position: "Trial Moderator", positionNote: "", hired: "2026-07-09", lastMove: "2026-07-09", claims: 28, vestHours: 9, status: "Active", online: false, notes: "Off probation: 10/09/2026" },
  { id: "r-19", callsign: "185", name: "Bex Ferreira", handle: "bferreira", discordId: "402118844500000918", rank: "Trial Mod", rankId: "trial_mod", team: "trial-mod", position: "Trial Moderator", positionNote: "", hired: "2026-08-02", lastMove: "2026-08-02", claims: 12, vestHours: 4, status: "Training", online: true, notes: "Shadowing 160." },

  // Structured positions nobody currently holds.
  { id: "v-1", vacant: true, callsign: "111", team: "senior-admin", position: "Senior Administrator", positionNote: "Community Oversight", notes: "Position unoccupied" },
  { id: "v-2", vacant: true, callsign: "155", team: "junior-admin", position: "Junior Administrator", positionNote: "", notes: "Position unoccupied" },
];

/**
 * Trial moderators currently in training and the administrator signing off on
 * them. Rendered beside the roster, because "who is still on probation" is the
 * question the roster prompts most often.
 */
export const training = [
  { id: "t-1", trainee: "Bex Ferreira", admin: "Jamie Okonkwo", since: "2026-08-02" },
  { id: "t-2", trainee: "Iggy Salas", admin: "Ellis Prator", since: "2026-07-09" },
  { id: "t-3", trainee: "Wren Castellano", admin: "Sam Bennett", since: "2026-06-20" },
  { id: "t-4", trainee: "Mira Solberg", admin: "Alex Duarte", since: "2026-07-04" },
];

/* ------------------------------------------------------------------ *
 * Staff dashboard
 * ------------------------------------------------------------------ */

export const dashboard = {
  totals: {
    activeStaff: 13,
    onLeave: 1,
    ticketsOpen: 9,
    ticketsClosed7d: 214,
    avgFirstResponse: "4m 20s",
    vestHours7d: 178,
  },
  // Tickets closed per day over the last week, oldest first.
  weeklyClaims: [
    { day: "Mon", claims: 26 },
    { day: "Tue", claims: 31 },
    { day: "Wed", claims: 24 },
    { day: "Thu", claims: 38 },
    { day: "Fri", claims: 45 },
    { day: "Sat", claims: 33 },
    { day: "Sun", claims: 17 },
  ],
  leaderboard: [
    { name: "Alex Duarte", claims: 52, vestHours: 14 },
    { name: "Sam Bennett", claims: 44, vestHours: 12 },
    { name: "Noor Haddad", claims: 39, vestHours: 11 },
    { name: "Jamie Okonkwo", claims: 35, vestHours: 10 },
    { name: "Ellis Prator", claims: 27, vestHours: 8 },
  ],
};

/* ------------------------------------------------------------------ *
 * Trial Mod checklist
 * ------------------------------------------------------------------ */

export const checklist = [
  {
    id: "onboarding",
    title: "Onboarding",
    description: "Complete in the first week.",
    items: [
      { id: "ck-1", label: "Read the Staff Handbook end to end", required: true },
      { id: "ck-2", label: "Staff roles assigned in Discord and verified in-game", required: true },
      { id: "ck-3", label: "Introduced in the staff channel", required: false },
      { id: "ck-4", label: "MDT and staff-menu access confirmed", required: true },
    ],
  },
  {
    id: "shadowing",
    title: "Shadowing",
    description: "Observe before you act. Minimum three sessions.",
    items: [
      { id: "ck-5", label: "Shadowed three ticket resolutions with a Mod+", required: true },
      { id: "ck-6", label: "Observed one ban appeal from start to decision", required: true },
      { id: "ck-7", label: "Watched a pursuit-policy dispute handled live", required: false },
    ],
  },
  {
    id: "solo",
    title: "Solo work",
    description: "Handled independently, reviewed afterwards.",
    items: [
      { id: "ck-8", label: "Resolved ten tickets solo", required: true },
      { id: "ck-9", label: "Issued a sanction correctly logged with evidence", required: true },
      { id: "ck-10", label: "Logged eight vest hours", required: true },
      { id: "ck-11", label: "Handled an in-scene dispute without pausing roleplay", required: false },
    ],
  },
  {
    id: "review",
    title: "Review",
    description: "Sign-off before full Mod.",
    items: [
      { id: "ck-12", label: "Passed the Trial Mod exam", required: true },
      { id: "ck-13", label: "Evaluation completed by an Admin", required: true },
      { id: "ck-14", label: "No active infractions on the staff record", required: true },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Staff Disciplinary Action database
 * ------------------------------------------------------------------ */

export const disciplinaryActions = [
  { id: "da-2026-041", staffName: "Toby Marsh", rank: "Mod", type: "Written Warning", tone: "amber", issuedBy: "Alex Duarte", issuedAt: "2026-08-12", status: "Active", summary: "Issued a 14-day ban without the required Sr. Admin sign-off. Ban reduced on appeal." },
  { id: "da-2026-038", staffName: "Rosa Delgado", rank: "Mod", type: "Verbal Warning", tone: "slate", issuedBy: "Sam Bennett", issuedAt: "2026-07-28", status: "Expired", summary: "Handled a ticket involving a friend rather than reassigning it. Coached on conflict of interest." },
  { id: "da-2026-033", staffName: "Iggy Salas", rank: "Trial Mod", type: "Coaching Note", tone: "brand", issuedBy: "Noor Haddad", issuedAt: "2026-07-04", status: "Closed", summary: "Closed two tickets without recording evidence links. Re-trained on the retention policy." },
  { id: "da-2026-027", staffName: "Kai Lindqvist", rank: "Mod", type: "Written Warning", tone: "amber", issuedBy: "Alex Duarte", issuedAt: "2026-06-15", status: "Expired", summary: "Argued with a member in a public channel instead of moving to a ticket." },
  { id: "da-2026-019", staffName: "Former Staff — M. Boyle", rank: "Trial Mod", type: "Removal", tone: "rose", issuedBy: "Marcus Reyes", issuedAt: "2026-05-02", status: "Final", summary: "Used staff tooling to gain an in-character advantage. Removed and blacklisted from future applications." },
];

/* ------------------------------------------------------------------ *
 * Exam backend
 * ------------------------------------------------------------------ */

/** The three staff exams, in promotion order. */
export const EXAMS = [
  { key: "trial", label: "Trial Mod Exam", short: "Trial Mod" },
  { key: "senior", label: "Sr. Mod Exam", short: "Sr. Mod" },
  { key: "admin", label: "Admin Exam", short: "Admin" },
];

/** Score thresholds. Below reviewMin is a fail; the band in between is a review. */
export const examSettings = {
  trial: { passScore: 27, reviewMin: 25, reviewMax: 26, maxScore: 30 },
  senior: { passScore: 9, reviewMin: 7, reviewMax: 8, maxScore: 10 },
  admin: { passScore: 18, reviewMin: 16, reviewMax: 17, maxScore: 20 },
};

export const attempts = [
  { attemptId: "trial:2", name: "Bex Ferreira", discordId: "402118844500000000", examType: "trial", submittedAt: "2026-08-21T19:42:00Z", score: "28/30", status: "Pass", originalScore: "28/30", originalStatus: "Pass", override: null },
  { attemptId: "senior:2", name: "Kai Lindqvist", discordId: "402118844500000004", examType: "senior", submittedAt: "2026-08-20T22:05:00Z", score: "8/10", status: "Pass", originalScore: "8/10", originalStatus: "Needs Review", override: { overrideScore: "8/10", overrideStatus: "Pass", reviewer: "Alex Duarte", reason: "Q6 was ambiguously worded; answer accepted on review.", timestamp: "2026-08-21T09:12:00Z" } },
  { attemptId: "trial:3", name: "Iggy Salas", discordId: "402118844500000001", examType: "trial", submittedAt: "2026-08-19T18:30:00Z", score: "25/30", status: "Needs Review", originalScore: "25/30", originalStatus: "Needs Review", override: null },
  { attemptId: "admin:2", name: "Ellis Prator", discordId: "402118844500000005", examType: "admin", submittedAt: "2026-08-18T20:15:00Z", score: "19/20", status: "Pass", originalScore: "19/20", originalStatus: "Pass", override: null },
  { attemptId: "trial:4", name: "Wren Castellano", discordId: "402118844500000002", examType: "trial", submittedAt: "2026-08-16T17:02:00Z", score: "29/30", status: "Pass", originalScore: "29/30", originalStatus: "Pass", override: null },
  { attemptId: "senior:3", name: "Rosa Delgado", discordId: "402118844500000006", examType: "senior", submittedAt: "2026-08-14T21:44:00Z", score: "6/10", status: "Fail", originalScore: "6/10", originalStatus: "Fail", override: null },
  { attemptId: "trial:5", name: "Iggy Salas", discordId: "402118844500000001", examType: "trial", submittedAt: "2026-08-02T19:20:00Z", score: "22/30", status: "Fail", originalScore: "22/30", originalStatus: "Fail", override: null },
  { attemptId: "admin:3", name: "Jamie Okonkwo", discordId: "402118844500000003", examType: "admin", submittedAt: "2026-07-30T23:10:00Z", score: "17/20", status: "Pass", originalScore: "17/20", originalStatus: "Needs Review", override: { overrideScore: "17/20", overrideStatus: "Pass", reviewer: "Marcus Reyes", reason: "Strong written answers on the escalation scenario; promoted on merit.", timestamp: "2026-07-31T14:03:00Z" } },
  { attemptId: "senior:4", name: "Toby Marsh", discordId: "402118844500000007", examType: "senior", submittedAt: "2026-07-22T18:55:00Z", score: "9/10", status: "Pass", originalScore: "9/10", originalStatus: "Pass", override: null },
  { attemptId: "trial:6", name: "Bex Ferreira", discordId: "402118844500000000", examType: "trial", submittedAt: "2026-07-11T20:38:00Z", score: "24/30", status: "Fail", originalScore: "24/30", originalStatus: "Fail", override: null },
];

/** Per-question breakdown, keyed by attempt. Only graded attempts carry one. */
export const attemptQuestions = {
  "trial:3": [
    { questionNumber: "1", questionText: "A player is shot with no prior interaction. Which rule applies and what is the sanction?", answer: "Rule 2.2 — RDM. Removal from the session and a logged sanction.", correctAnswer: "Rule 2.2 — RDM", points: "2", awarded: "2" },
    { questionNumber: "2", questionText: "Define metagaming in your own words.", answer: "Using info your character shouldn't have, like stream chat or Discord.", correctAnswer: "Out-of-character information influencing in-character decisions", points: "2", awarded: "2" },
    { questionNumber: "3", questionText: "How many players may take part in a single criminal act?", answer: "Eight", correctAnswer: "Six", points: "2", awarded: "0" },
    { questionNumber: "4", questionText: "When does the New Life Rule take effect?", answer: "After a character is downed and respawns.", correctAnswer: "After a character is downed and respawns", points: "2", awarded: "2" },
    { questionNumber: "5", questionText: "A member argues with you mid-scene. What do you do?", answer: "Ask them to open a ticket and continue the scene.", correctAnswer: "Redirect to a ticket; do not argue in scene", points: "3", awarded: "3" },
  ],
};

export const auditLog = [
  { id: "al-5", attemptId: "senior:2", staffName: "Kai Lindqvist", examType: "senior", originalScore: "8/10", overrideScore: "8/10", originalStatus: "Needs Review", overrideStatus: "Pass", reviewer: "Alex Duarte", reason: "Q6 was ambiguously worded; answer accepted on review.", timestamp: "2026-08-21T09:12:00Z" },
  { id: "al-4", attemptId: "admin:3", staffName: "Jamie Okonkwo", examType: "admin", originalScore: "17/20", overrideScore: "17/20", originalStatus: "Needs Review", overrideStatus: "Pass", reviewer: "Marcus Reyes", reason: "Strong written answers on the escalation scenario; promoted on merit.", timestamp: "2026-07-31T14:03:00Z" },
  { id: "al-3", attemptId: "trial:5", staffName: "Iggy Salas", examType: "trial", originalScore: "22/30", overrideScore: "22/30", originalStatus: "Fail", overrideStatus: "Fail", reviewer: "Noor Haddad", reason: "Re-checked after a grading query. Original result stands.", timestamp: "2026-08-03T11:27:00Z" },
  { id: "al-2", attemptId: "senior:3", staffName: "Rosa Delgado", examType: "senior", originalScore: "6/10", overrideScore: "6/10", originalStatus: "Fail", overrideStatus: "Fail", reviewer: "Sam Bennett", reason: "Appeal reviewed and declined; retake available in 30 days.", timestamp: "2026-08-15T16:40:00Z" },
  { id: "al-1", attemptId: "trial:6", staffName: "Bex Ferreira", examType: "trial", originalScore: "24/30", overrideScore: "24/30", originalStatus: "Fail", overrideStatus: "Fail", reviewer: "Alex Duarte", reason: "Confirmed grading. Retake scheduled.", timestamp: "2026-07-12T10:05:00Z" },
];

export const questionCatalog = [
  { rowNumber: 2, examType: "trial", questionId: "T-01", questionNumber: "1", questionText: "A player is shot with no prior interaction. Which rule applies and what is the sanction?", questionType: "Short answer", points: "2", correctAnswer: "Rule 2.2 — RDM" },
  { rowNumber: 3, examType: "trial", questionId: "T-02", questionNumber: "2", questionText: "Define metagaming in your own words.", questionType: "Short answer", points: "2", correctAnswer: "Out-of-character information influencing in-character decisions" },
  { rowNumber: 4, examType: "trial", questionId: "T-03", questionNumber: "3", questionText: "How many players may take part in a single criminal act?", questionType: "Multiple choice", points: "2", correctAnswer: "Six" },
  { rowNumber: 5, examType: "trial", questionId: "T-04", questionNumber: "4", questionText: "When does the New Life Rule take effect?", questionType: "Short answer", points: "2", correctAnswer: "After a character is downed and respawns" },
  { rowNumber: 6, examType: "senior", questionId: "S-01", questionNumber: "1", questionText: "When must a pursuit be terminated under the pursuit policy?", questionType: "Short answer", points: "2", correctAnswer: "When risk to the public outweighs the offence" },
  { rowNumber: 7, examType: "senior", questionId: "S-02", questionNumber: "2", questionText: "Who signs off a ban longer than seven days?", questionType: "Multiple choice", points: "1", correctAnswer: "A Sr. Admin" },
  { rowNumber: 8, examType: "admin", questionId: "A-01", questionNumber: "1", questionText: "Outline the escalation path for a staff complaint against an Admin.", questionType: "Long answer", points: "4", correctAnswer: "Route to Sr. Admin, then Head Admin if unresolved" },
  { rowNumber: 9, examType: "admin", questionId: "A-02", questionNumber: "2", questionText: "How long is evidence retained before deletion?", questionType: "Multiple choice", points: "2", correctAnswer: "90 days" },
];
