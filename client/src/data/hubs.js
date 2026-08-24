/**
 * Definitions for the two portal sub-applications — the Staff Hub and the
 * Civilian Hub. Each one drives its own top bar, drawer and landing page from
 * this single object, so adding a section is a one-line change here rather than
 * an edit in four files.
 *
 * Each nav entry names the permission it needs. src/lib/guards.js gates the
 * matching route on the same permission and the server enforces it on the
 * matching endpoint, so the nav, the route gate and the API cannot disagree.
 */
import { ROLES } from "./mockData";

/* --------------------------- role bundles --------------------------- */

export const STAFF_ANY = [
  ROLES.TRIAL_MOD,
  ROLES.MOD,
  ROLES.SENIOR_MOD,
  ROLES.JUNIOR_ADMIN,
  ROLES.ADMIN,
  ROLES.SENIOR_ADMIN,
  ROLES.HEAD_ADMIN,
  ROLES.DIRECTORSHIP,
  ROLES.OWNERSHIP,
];

/** Jr. Admin and up. */
export const ADMIN_PLUS = [
  ROLES.JUNIOR_ADMIN,
  ROLES.ADMIN,
  ROLES.SENIOR_ADMIN,
  ROLES.HEAD_ADMIN,
];

export const SENIOR_ADMIN_PLUS = [ROLES.SENIOR_ADMIN, ROLES.HEAD_ADMIN];

/** The top of the staff ladder. */
export const HEAD_ADMIN_ONLY = [ROLES.HEAD_ADMIN];

/** Any signed-in community member. */
export const MEMBER_ANY = [
  ROLES.MEMBER,
  ROLES.WHITELISTED,
  ROLES.CERT_CIV_1,
  ROLES.CERT_CIV_2,
  ROLES.CERT_CIV_3,
  ...STAFF_ANY,
];

/** Personal records only exist for a whitelisted character. */
export const WHITELISTED_ANY = [
  ROLES.WHITELISTED,
  ROLES.CERT_CIV_1,
  ROLES.CERT_CIV_2,
  ROLES.CERT_CIV_3,
  ...STAFF_ANY,
];

/* ------------------------------- hubs ------------------------------- */

const TONES = {
  primary: {
    text: "text-primary-400",
    tile: "bg-primary-500/10 text-primary-400 ring-primary-400/20",
  },
  brand: {
    text: "text-sky-400",
    tile: "bg-sky-500/10 text-sky-400 ring-sky-400/20",
  },
  green: {
    text: "text-emerald-400",
    tile: "bg-emerald-500/10 text-emerald-400 ring-emerald-400/20",
  },
  rose: {
    text: "text-rose-500",
    tile: "bg-rose-500/10 text-rose-400 ring-rose-400/20",
  },
};

export const STAFF_HUB = {
  id: "staff",
  base: "/staff-hub",
  name: "Staff Hub",
  eyebrow: "Staff Hub",
  tagline: "Staff Hub",
  description:
    "Tools, resources and documentation for the staff team — roster, shift metrics, disciplinary records and the exam backend, all in one place.",
  /**
   * A flat row of tabs rather than dropdown groups.
   *
   * The staff team carries sixteen destinations, which is far too many for one
   * row — so the ten that get opened daily are tabs, and everything that is
   * configured once and then left alone lives behind Site Administration. That
   * is what stops the bar becoming a menu you have to read.
   */
  flat: true,
  tabs: [
    { to: "/staff-hub/home", label: "Home", icon: "Home", permission: "staff.view" },
    { to: "/staff-hub/roster", label: "Roster", icon: "Users", permission: "staff.view" },
    { to: "/staff-hub/da-hub", label: "DA Hub", icon: "Gavel", permission: "staff.view" },
    { to: "/staff-hub/reports", label: "Reports", icon: "Megaphone", permission: "site.moderation" },
    { to: "/staff-hub/forms", label: "Forms", icon: "ClipboardList", permission: "staff.view" },
    { to: "/staff-hub/training", label: "Training Dashboard", icon: "GraduationCap", permission: "staff.view" },
    { to: "/staff-hub/da-database", label: "DA Database", icon: "Search", permission: "staff.da_view" },
    { to: "/staff-hub/analytics", label: "Analytics", icon: "ChartColumn", permission: "staff.view" },
    { to: "/staff-hub/promotion-board", label: "Promotion Board", icon: "Award", permission: "promotions.view" },
    { to: "/staff-hub/administration", label: "Site Administration", icon: "SlidersHorizontal", permission: "staff.view", accent: true },
  ],

  /**
   * Everything Site Administration gathers. Not tabs — these are the pages a
   * director configures once a month, and each one already has its own gate.
   */
  administration: [
    {
      id: "access",
      label: "Access control",
      items: [
        { to: "/staff-hub/permissions", label: "Permissions", icon: "KeyRound", permission: "permissions.manage", detail: "Every gated page and the Discord roles that satisfy it." },
        { to: "/staff-hub/discord-roles", label: "Discord Role Mapping", icon: "Key", permission: "discord.roles.manage", detail: "Which Discord role is each rank, tier and tag." },
      ],
    },
    {
      id: "exams",
      label: "Exam backend",
      items: [
        { to: "/staff-hub/submissions", label: "Recent Submissions", icon: "Inbox", permission: "exams.view", detail: "What has come in, with review and override." },
        { to: "/staff-hub/exam-members", label: "Members", icon: "UserSearch", permission: "exams.view", detail: "One member's exam history." },
        { to: "/staff-hub/audit-log", label: "Audit Log", icon: "ScrollText", permission: "exams.audit", detail: "Every override ever applied." },
        { to: "/staff-hub/management", label: "Thresholds & Questions", icon: "SlidersHorizontal", permission: "exams.manage", detail: "Grading thresholds and the question catalogue." },
      ],
    },
    {
      id: "resources",
      label: "Rank resources",
      items: [
        { to: "/staff-hub/resources", label: "Resources", icon: "BookOpen", permission: "staff.view", detail: "Documentation for the whole team." },
        { to: "/staff-hub/administrators", label: "Administrators", icon: "Shield", permission: "staff.links.admin", detail: "The Administrator link collection." },
        { to: "/staff-hub/senior-admins", label: "Senior Admins+", icon: "ShieldCheck", permission: "staff.links.senior", detail: "The Senior Admin link collection." },
        { to: "/staff-hub/head-admin", label: "Head Admin", icon: "Crown", permission: "staff.portal.manage", detail: "Portal content: reminders, featured member, rank links." },
      ],
    },
    {
      id: "support",
      label: "Support portal",
      items: [
        { to: "/support/queue", label: "Ticket queue", icon: "LifeBuoy", permission: "support.work", detail: "Everything members have asked for." },
        { to: "/support/flows", label: "Response flows", icon: "Network", permission: "support.manage", detail: "The branching replies agents walk." },
        { to: "/transfers", label: "Transfer portal", icon: "Users", permission: "transfers.view", detail: "Moves between emergency services departments." },
      ],
    },
  ],
};

export const CIVILIAN_HUB = {
  id: "civilian",
  base: "/civilian-hub",
  name: "Civilian Hub",
  eyebrow: "Civilian Hub",
  tagline: "Civilian Hub",
  description:
    "Everything your character owns and everywhere they work — vehicles, property, licences, businesses, jobs and the classifieds board.",
  groups: [
    {
      id: "records",
      label: "My Records",
      tone: TONES.green,
      items: [
        { to: "/civilian-hub/home", label: "Overview", icon: "Home", permission: "civilian.view" },
        // A member who simply is not whitelisted yet gets its own denial copy,
        // pointing at the application rather than at a supervisor.
        { to: "/civilian-hub/characters", label: "Characters", icon: "IdCard", permission: "civilian.records" },
        { to: "/civilian-hub/vehicles", label: "Vehicles", icon: "Car", permission: "civilian.records" },
        { to: "/civilian-hub/properties", label: "Properties", icon: "House", permission: "civilian.records" },
        { to: "/civilian-hub/licences", label: "Licences", icon: "BadgeCheck", permission: "civilian.records" },
      ],
    },
    {
      id: "community",
      label: "Community",
      tone: TONES.brand,
      items: [
        { to: "/civilian-hub/roster", label: "Community Roster", icon: "Users", permission: "roster.view" },
        { to: "/civilian-hub/businesses", label: "Business Directory", icon: "Store", permission: "civilian.view" },
        { to: "/civilian-hub/jobs", label: "Job Board", icon: "Briefcase", permission: "civilian.view" },
        { to: "/civilian-hub/classifieds", label: "Classifieds", icon: "Tag", permission: "civilian.view" },
        { to: "/civilian-hub/forms", label: "Forms & Assessments", icon: "ClipboardList", permission: "forms.view" },
      ],
    },
    {
      id: "resources",
      label: "Resources",
      tone: TONES.primary,
      items: [
        { to: "/civilian-hub/penal-code", label: "Penal Code", icon: "Scale", permission: "civilian.view" },
        { to: "/civilian-hub/guides", label: "Civilian Guides", icon: "BookOpen", permission: "civilian.view" },
      ],
    },
  ],
};

export const HUBS = [STAFF_HUB, CIVILIAN_HUB];


/** The hub that owns a pathname, or null for a page outside both. */
export function hubFor(pathname) {
  return HUBS.find((hub) => pathname.startsWith(hub.base)) ?? null;
}
