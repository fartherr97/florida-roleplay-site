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
  groups: [
    {
      id: "portal",
      label: "Staff Portal",
      tone: TONES.primary,
      items: [
        { to: "/staff-hub/home", label: "Overview", icon: "Home", permission: "staff.view" },
        { to: "/staff-hub/roster", label: "Staff Roster", icon: "Users", permission: "staff.view" },
        { to: "/staff-hub/dashboard", label: "Staff Dashboard", icon: "ChartColumn", permission: "staff.view" },
        { to: "/staff-hub/trial-checklist", label: "Trial Mod Checklist", icon: "ListChecks", permission: "staff.view" },
        { to: "/staff-hub/forms", label: "Forms & Exams", icon: "ClipboardList", permission: "staff.view" },
        { to: "/staff-hub/promotion-board", label: "Promotion Board", icon: "Award", permission: "promotions.view" },
        { to: "/staff-hub/da-hub", label: "DA Hub", icon: "Gavel", permission: "staff.view" },
        { to: "/staff-hub/da-database", label: "DA Database", icon: "Search", permission: "staff.da_view" },
      ],
    },
    {
      id: "rank",
      label: "Rank Access",
      tone: TONES.brand,
      items: [
        { to: "/staff-hub/resources", label: "Resources", icon: "BookOpen", permission: "staff.view" },
        { to: "/staff-hub/administrators", label: "Administrators", icon: "Shield", permission: "staff.links.admin" },
        { to: "/staff-hub/senior-admins", label: "Senior Admins+", icon: "ShieldCheck", permission: "staff.links.senior" },
        { to: "/staff-hub/head-admin", label: "Head Admin", icon: "Crown", permission: "staff.portal.manage" },
      ],
    },
    {
      id: "exams",
      label: "Exam Backend",
      tone: TONES.rose,
      items: [
        { to: "/staff-hub/submissions", label: "Recent Submissions", icon: "Inbox", permission: "exams.view" },
        { to: "/staff-hub/exam-members", label: "Members", icon: "UserSearch", permission: "exams.view" },
        { to: "/staff-hub/audit-log", label: "Audit Log", icon: "ScrollText", permission: "exams.audit" },
        { to: "/staff-hub/management", label: "Management", icon: "SlidersHorizontal", permission: "exams.manage" },
        { to: "/staff-hub/permissions", label: "Permissions", icon: "KeyRound", permission: "permissions.manage" },
        { to: "/staff-hub/discord-roles", label: "Discord Roles", icon: "Key", permission: "discord.roles.manage" },
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
