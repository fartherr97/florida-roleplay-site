// ─────────────────────────────────────────────────────────────────────────────
// Transfer Portal — configuration
//
// This is the Config block of the original ES Transfer Portal
// (github.com/fartherr97/es-transfer-portal, app/page.jsx), lifted out into its
// own module and pointed at Florida Roleplay's departments and ranks.
//
// The shapes are the originals: DEPTS is keyed by abbreviation and carries a
// name, a logo and a brand hex; RANKS is keyed the same way with an ordered
// list of rank labels. Everything downstream — DeptBadge, DeptSelector, the
// process modal, analytics, the webhook settings cards — indexes into these, so
// adding a department is still a one-line change here.
//
// One thing differs from SSRP, and it is forced:
//
//   • `logo` is empty. SSRP serves per-department images from cdn.ssrp.us; this
//     community has no equivalent yet, so DeptLogo falls back to the
//     abbreviation on a tile in the department's colour. Fill a `logo` in and
//     every slot picks it up with no other change.
//
// Ranks are read off the community's own ROLE_MAP rather than typed out again,
// so a rank added in the Discord role mapping appears in the transfer form
// without a second edit here.
// ─────────────────────────────────────────────────────────────────────────────

import { DEPARTMENTS, ROLE_MAP } from "../../data/rosterData";

/** The departments a member can transfer between — emergency services only. */
const TRANSFER_DEPT_IDS = ["fhp", "hcso", "tpd", "hcfr"];

/**
 * Each department's brand hex.
 *
 * The original stores a colour per department and derives every chip, glow and
 * bar from it. Florida Roleplay stores a tone name instead, so this is the one
 * place the two vocabularies meet.
 */
const DEPT_COLORS = {
  fhp: "#60a5fa",
  hcso: "#1f8b4c",
  tpd: "#2e69f1",
  hcfr: "#e74c3c",
};

/**
 * The line under the abbreviation on a department tile.
 *
 * The original derives this from the full name with two string replacements.
 * That works for SSRP's names and not for these: "Florida Highway Patrol" and
 * "Hillsborough County Sheriff's Office" both truncate mid-word on a tile,
 * which reads as broken rather than as abbreviated.
 */
const DEPT_SHORT = {
  fhp: "Highway Patrol",
  hcso: "Sheriff's Office",
  tpd: "Police Dept",
  hcfr: "Fire Rescue",
};

/** DEPTS — keyed by abbreviation, exactly as the original. */
export const DEPTS = Object.fromEntries(
  TRANSFER_DEPT_IDS.map((id) => {
    const dept = DEPARTMENTS.find((d) => d.id === id);
    return [
      dept.abbr,
      {
        id,
        name: dept.label,
        short: DEPT_SHORT[id] ?? dept.label,
        logo: "",
        color: DEPT_COLORS[id] ?? "#64748b",
      },
    ];
  }),
);

/** Returns inline-style objects derived from the dept's brand hex color. */
export function ds(color) {
  return {
    chip: { color, backgroundColor: color + "1a", borderColor: color + "4d" },
    selected: { color, backgroundColor: color + "26", borderColor: color + "99" },
  };
}

/**
 * RANKS — the ladder for each department, lowest first.
 *
 * Taken from ROLE_MAP by `order` so this never drifts from the roster. The long
 * form is used, not the abbreviation that appears in a Discord nickname: a
 * transfer form asking somebody to pick "Sr. Trooper" reads worse than one
 * offering "Senior Trooper", and the record is read months later by somebody
 * who was not there.
 */
export const RANKS = Object.fromEntries(
  Object.entries(DEPTS).map(([abbr, dept]) => [
    abbr,
    ROLE_MAP.filter((role) => role.department === dept.id)
      .sort((a, b) => a.order - b.order)
      .map((role) => role.rankFull),
  ]),
);

/** Flat deduplicated rank list across all departments, used for process modal. */
export const ALL_RANKS = Object.values(RANKS)
  .flat()
  .filter((v, i, a) => a.indexOf(v) === i);

/** The Discord role key that commands each department, for dept-head resolution. */
export const DEPT_COMMAND_KEYS = {
  FHP: "fhp_colonel",
  HCSO: "hcso_sheriff",
  TPD: "tpd_chief",
  HCFR: "hcfr_fire_chief",
};

export const STATUS_CFG = {
  pending: { label: "Pending Review", cls: "bg-amber-500/10 border-amber-500/30 text-amber-300" },
  approved: { label: "Both Approved", cls: "bg-sky-500/10 border-sky-500/30 text-sky-300" },
  completed: { label: "Completed", cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" },
  rejected: { label: "Rejected", cls: "bg-rose-500/10 border-rose-500/30 text-rose-300" },
  closed: { label: "Closed", cls: "bg-slate-500/10 border-slate-500/30 text-slate-300" },
};

export const PORTAL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "request", label: "New Request" },
  { id: "queue", label: "Review Queue" },
  { id: "analytics", label: "Analytics", managementOnly: true },
  { id: "settings", label: "Settings", managementOnly: true },
];

export const ANALYTICS_RANGES = [
  { key: "7", label: "7 days" },
  { key: "14", label: "14 days" },
  { key: "30", label: "30 days" },
  { key: "monthly", label: "Monthly" },
];

/**
 * Build a last-12-months list: [{ label: 'May 2026', year, month (0-indexed) }].
 *
 * `now` is passed in rather than read here. The original called `new Date()` at
 * module scope, which pins the list to whenever the bundle first evaluated and
 * — in this codebase — trips the linter's purity rule during render.
 */
export function buildMonthOptions(now) {
  const opts = [];
  const d = new Date(now);
  d.setDate(1);
  for (let i = 0; i < 12; i++) {
    opts.push({
      label: d.toLocaleString("default", { month: "long", year: "numeric" }),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
    d.setMonth(d.getMonth() - 1);
  }
  return opts;
}

export const STATUS_FILTERS = ["all", "pending", "approved", "completed", "rejected"];

export const BLANK = {
  member: "",
  discord: "",
  rank: "",
  fromDept: "",
  toDept: "",
  reason: "",
  removeRoles: true,
  assignVisitorPass: true,
  assignRetired: false,
  requireBotConfirm: true,
};

export const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-violet-600",
  "bg-emerald-600",
  "bg-orange-600",
  "bg-pink-600",
  "bg-cyan-600",
];

/** The minimum length of a transfer reason, and of a rejection reason. */
export const MIN_REASON = 150;
export const MIN_REJECTION = 20;

/* ─── Session ──────────────────────────────────────────────────────────────── */

/**
 * The portal's session shape, built from this site's auth context.
 *
 * SSRP resolves `{ id, username, displayName, avatar, dept, rank, isDeptHead,
 * isManagement }` from Discord roles in lib/role-map.js. Florida Roleplay
 * already resolves roles centrally, so this maps that onto the same shape and
 * every component below reads it exactly as the original does.
 *
 * Management is Directorship and above — the community's own oversight tier,
 * which is what SSRP's MANAGEMENT_ROLES means. A department's command role
 * makes somebody that department's head.
 */
export function sessionFrom(user) {
  if (!user) return null;
  const roles = user.roles ?? [];
  const held = new Set(roles);

  const commandFor = Object.entries(DEPT_COMMAND_KEYS).find(([, key]) => held.has(key));

  // The department a member belongs to: their highest-ordered mapped role that
  // belongs to a transferable department.
  const mine = ROLE_MAP.filter(
    (role) => held.has(role.key) && TRANSFER_DEPT_IDS.includes(role.department),
  ).sort((a, b) => b.order - a.order)[0];

  const deptAbbr =
    commandFor?.[0] ??
    (mine ? Object.keys(DEPTS).find((abbr) => DEPTS[abbr].id === mine.department) : null);

  return {
    id: user.discordId ?? user.id ?? null,
    username: user.username ?? "",
    displayName: user.displayName || user.username || "",
    avatar: user.avatar ?? null,
    dept: deptAbbr ?? null,
    rank: mine?.rankFull ?? user.rank ?? null,
    isDeptHead: Boolean(commandFor),
    isManagement: held.has("directorship") || held.has("ownership"),
  };
}

/** Staff = Department Head or Management. Drives queue/portal access + internal chat. */
export function isStaffUser(u) {
  return !!u && (u.isManagement || u.isDeptHead);
}
