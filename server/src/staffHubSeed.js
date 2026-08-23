/**
 * Seed data for the Staff Hub, mirroring client/src/data/staffHubData.js so the
 * API serves realistic responses before MariaDB is populated. Every hub route
 * falls back to these shapes, which is what lets the whole hub work end-to-end
 * with no database running.
 *
 * NOTE: this file is intentionally a copy of the client's hub mock data. If you
 * change a shape in one, change it in the other.
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

export const roster = [
  { id: "r-1", name: "Marcus Reyes", handle: "reyes", rank: "Head Admin", rankId: "head_admin", team: "Management", joined: "2024-03-04", claims: 88, vestHours: 21, status: "Active" },
  { id: "r-2", name: "Dana Whitfield", handle: "dwhitfield", rank: "Head Admin", rankId: "head_admin", team: "Management", joined: "2024-05-19", claims: 74, vestHours: 18, status: "Active" },
  { id: "r-3", name: "Alex Duarte", handle: "aduarte", rank: "Sr. Admin", rankId: "senior_admin", team: "Staff Team", joined: "2024-06-02", claims: 341, vestHours: 96, status: "Active" },
  { id: "r-4", name: "Priya Raman", handle: "praman", rank: "Sr. Admin", rankId: "senior_admin", team: "Development", joined: "2024-07-11", claims: 129, vestHours: 34, status: "Active" },
  { id: "r-5", name: "Sam Bennett", handle: "sbennett", rank: "Admin", rankId: "admin", team: "Support", joined: "2024-09-23", claims: 268, vestHours: 71, status: "Active" },
  { id: "r-6", name: "Noor Haddad", handle: "nhaddad", rank: "Admin", rankId: "admin", team: "Staff Team", joined: "2024-11-08", claims: 254, vestHours: 68, status: "Active" },
  { id: "r-7", name: "Jamie Okonkwo", handle: "jokonkwo", rank: "Sr. Mod", rankId: "senior_mod", team: "Staff Team", joined: "2025-01-16", claims: 212, vestHours: 46, status: "Active" },
  { id: "r-8", name: "Ellis Prator", handle: "eprator", rank: "Sr. Mod", rankId: "senior_mod", team: "Staff Team", joined: "2025-02-27", claims: 197, vestHours: 41, status: "Active" },
  { id: "r-9", name: "Kai Lindqvist", handle: "klindqvist", rank: "Mod", rankId: "mod", team: "Staff Team", joined: "2025-04-30", claims: 143, vestHours: 33, status: "Active" },
  { id: "r-10", name: "Rosa Delgado", handle: "rdelgado", rank: "Mod", rankId: "mod", team: "Support", joined: "2025-06-14", claims: 118, vestHours: 29, status: "Active" },
  { id: "r-11", name: "Toby Marsh", handle: "tmarsh", rank: "Mod", rankId: "mod", team: "Staff Team", joined: "2025-08-01", claims: 96, vestHours: 24, status: "Leave" },
  { id: "r-12", name: "Wren Castellano", handle: "wcastellano", rank: "Trial Mod", rankId: "trial_mod", team: "Staff Team", joined: "2026-06-20", claims: 41, vestHours: 12, status: "Active" },
  { id: "r-13", name: "Iggy Salas", handle: "isalas", rank: "Trial Mod", rankId: "trial_mod", team: "Staff Team", joined: "2026-07-09", claims: 28, vestHours: 9, status: "Active" },
  { id: "r-14", name: "Bex Ferreira", handle: "bferreira", rank: "Trial Mod", rankId: "trial_mod", team: "Support", joined: "2026-08-02", claims: 12, vestHours: 4, status: "Active" },
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
