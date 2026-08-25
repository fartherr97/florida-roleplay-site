/**
 * Seed data for the Staff Hub, mirroring client/src/data/staffHubData.js so the
 * API serves realistic responses before Postgres is populated. Every hub route
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
  reminders: [],
  featuredMember: null,
  quickNotes: "",
};

export const portalLinks = {
  allStaff: [],
  administrators: [],
  seniorAdmins: [],
};

/* ------------------------------------------------------------------ *
 * Staff roster
 * ------------------------------------------------------------------ */

export const STAFF_TEAMS = [
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
export const roster = [];

/**
 * Trial moderators currently in training and the administrator signing off on
 * them. Rendered beside the roster, because "who is still on probation" is the
 * question the roster prompts most often.
 */
export const training = [];

/* ------------------------------------------------------------------ *
 * Staff dashboard
 * ------------------------------------------------------------------ */

export const dashboard = {
  totals: {
    activeStaff: 0,
    onLeave: 0,
    ticketsOpen: 0,
    ticketsClosed7d: 0,
    avgFirstResponse: null,
    vestHours7d: 0,
  },
  weeklyClaims: [],
  leaderboard: [],
};

/* ------------------------------------------------------------------ *
 * Trial Mod checklist
 * ------------------------------------------------------------------ */

export const checklist = [];

/* ------------------------------------------------------------------ *
 * Staff Disciplinary Action database
 * ------------------------------------------------------------------ */

export const disciplinaryActions = [];

/* ------------------------------------------------------------------ *
 * Exam backend
 * ------------------------------------------------------------------ */

/** The three staff exams, in promotion order. */
export const EXAMS = [];

/** Score thresholds. Below reviewMin is a fail; the band in between is a review. */
export const examSettings = {
  trial: { passScore: 27, reviewMin: 25, reviewMax: 26, maxScore: 30 },
  senior: { passScore: 9, reviewMin: 7, reviewMax: 8, maxScore: 10 },
  admin: { passScore: 18, reviewMin: 16, reviewMax: 17, maxScore: 20 },
};

export const attempts = [];

/** Per-question breakdown, keyed by attempt. Only graded attempts carry one. */
export const attemptQuestions = {};

export const auditLog = [];

export const questionCatalog = [];
