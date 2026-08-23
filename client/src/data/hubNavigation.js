/**
 * Sidebar model for the Staff Hub, grouped the way the community's existing hub
 * is: portal tools first, then rank-scoped link collections, then the exam
 * backend. Roles are declared here and consumed by src/lib/guards.js, so the
 * sidebar and the route gate can never disagree about who may open what.
 */
import { ROLES } from "./mockData";

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

export const hubGroups = [
  {
    id: "portal",
    label: "Staff Portal",
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
    items: [
      { to: "/staff-hub/submissions", label: "Recent Submissions", icon: "Inbox", roles: ADMIN_PLUS },
      { to: "/staff-hub/exam-members", label: "Members", icon: "UserSearch", roles: ADMIN_PLUS },
      { to: "/staff-hub/audit-log", label: "Audit Log", icon: "ScrollText", roles: SENIOR_ADMIN_PLUS },
      { to: "/staff-hub/management", label: "Management", icon: "SlidersHorizontal", roles: DIRECTOR_ONLY },
    ],
  },
];

/** Flat list of every gated hub route, for the shared guard table. */
export const hubRoutes = hubGroups.flatMap((group) =>
  group.items.map((item) => ({ path: item.to, roles: item.roles })),
);
