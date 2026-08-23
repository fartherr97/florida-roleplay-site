/**
 * Definitions for the two portal sub-applications — the Staff Hub and the
 * Civilian Hub. Each one drives its own top bar, drawer and landing page from
 * this single object, so adding a section is a one-line change here rather than
 * an edit in four files.
 *
 * Roles are declared next to the nav entry that links to a page, and
 * src/lib/guards.js folds them into the shared guard table. The nav, the route
 * gate and the server middleware therefore cannot drift apart.
 */
import { ROLES } from "./mockData";

/* --------------------------- role bundles --------------------------- */

export const STAFF_ANY = [
  ROLES.STAFF,
  ROLES.TRIAL_MOD,
  ROLES.MODERATOR,
  ROLES.SENIOR_MOD,
  ROLES.ADMIN,
  ROLES.SENIOR_ADMIN,
  ROLES.DIRECTOR,
  ROLES.MANAGEMENT,
];

export const ADMIN_PLUS = [
  ROLES.ADMIN,
  ROLES.SENIOR_ADMIN,
  ROLES.DIRECTOR,
  ROLES.MANAGEMENT,
];

export const SENIOR_ADMIN_PLUS = [
  ROLES.SENIOR_ADMIN,
  ROLES.DIRECTOR,
  ROLES.MANAGEMENT,
];

export const DIRECTOR_ONLY = [ROLES.DIRECTOR, ROLES.MANAGEMENT];

/** Any signed-in community member. */
export const MEMBER_ANY = [ROLES.MEMBER, ROLES.WHITELISTED, ...STAFF_ANY];

/** Personal records only exist for a whitelisted character. */
export const WHITELISTED_ANY = [ROLES.WHITELISTED, ...STAFF_ANY];

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
        { to: "/staff-hub/home", label: "Overview", icon: "Home", roles: STAFF_ANY },
        { to: "/staff-hub/roster", label: "Staff Roster", icon: "Users", roles: STAFF_ANY },
        { to: "/staff-hub/dashboard", label: "Staff Dashboard", icon: "ChartColumn", roles: STAFF_ANY },
        { to: "/staff-hub/trial-checklist", label: "Trial Mod Checklist", icon: "ListChecks", roles: STAFF_ANY },
        { to: "/staff-hub/da-database", label: "Staff DA Database", icon: "Gavel", roles: ADMIN_PLUS },
      ],
    },
    {
      id: "rank",
      label: "Rank Access",
      tone: TONES.brand,
      items: [
        { to: "/staff-hub/resources", label: "Resources", icon: "BookOpen", roles: STAFF_ANY },
        { to: "/staff-hub/administrators", label: "Administrators", icon: "Shield", roles: ADMIN_PLUS },
        { to: "/staff-hub/senior-admins", label: "Senior Admins+", icon: "ShieldCheck", roles: SENIOR_ADMIN_PLUS },
        { to: "/staff-hub/director", label: "Director", icon: "Crown", roles: DIRECTOR_ONLY },
      ],
    },
    {
      id: "exams",
      label: "Exam Backend",
      tone: TONES.rose,
      items: [
        { to: "/staff-hub/submissions", label: "Recent Submissions", icon: "Inbox", roles: ADMIN_PLUS },
        { to: "/staff-hub/exam-members", label: "Members", icon: "UserSearch", roles: ADMIN_PLUS },
        { to: "/staff-hub/audit-log", label: "Audit Log", icon: "ScrollText", roles: SENIOR_ADMIN_PLUS },
        { to: "/staff-hub/management", label: "Management", icon: "SlidersHorizontal", roles: DIRECTOR_ONLY },
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
        { to: "/civilian-hub/home", label: "Overview", icon: "Home", roles: MEMBER_ANY },
        // A member who simply is not whitelisted yet gets its own denial copy,
        // pointing at the application rather than at a supervisor.
        { to: "/civilian-hub/characters", label: "Characters", icon: "IdCard", roles: WHITELISTED_ANY, reason: "whitelist" },
        { to: "/civilian-hub/vehicles", label: "Vehicles", icon: "Car", roles: WHITELISTED_ANY, reason: "whitelist" },
        { to: "/civilian-hub/properties", label: "Properties", icon: "House", roles: WHITELISTED_ANY, reason: "whitelist" },
        { to: "/civilian-hub/licences", label: "Licences", icon: "BadgeCheck", roles: WHITELISTED_ANY, reason: "whitelist" },
      ],
    },
    {
      id: "community",
      label: "Community",
      tone: TONES.brand,
      items: [
        { to: "/civilian-hub/businesses", label: "Business Directory", icon: "Store", roles: MEMBER_ANY },
        { to: "/civilian-hub/jobs", label: "Job Board", icon: "Briefcase", roles: MEMBER_ANY },
        { to: "/civilian-hub/classifieds", label: "Classifieds", icon: "Tag", roles: MEMBER_ANY },
      ],
    },
    {
      id: "resources",
      label: "Resources",
      tone: TONES.primary,
      items: [
        { to: "/civilian-hub/penal-code", label: "Penal Code", icon: "Scale", roles: MEMBER_ANY },
        { to: "/civilian-hub/guides", label: "Civilian Guides", icon: "BookOpen", roles: MEMBER_ANY },
      ],
    },
  ],
};

export const HUBS = [STAFF_HUB, CIVILIAN_HUB];

/** Flat list of every gated hub route, for the shared guard table. */
export const hubRoutes = HUBS.flatMap((hub) =>
  hub.groups.flatMap((group) =>
    group.items.map((item) => ({
      path: item.to,
      roles: item.roles,
      reason: item.reason,
    })),
  ),
);

/** The hub that owns a pathname, or null for a page outside both. */
export function hubFor(pathname) {
  return HUBS.find((hub) => pathname.startsWith(hub.base)) ?? null;
}
