/**
 * The permission catalogue and its default grants — an exact copy of
 * client/src/data/permissions.js.
 *
 * The server is the boundary: every gated endpoint resolves through
 * requirePermission, which reads the stored grants and falls back to these
 * defaults. The two copies are intentionally duplicated rather than shared
 * through a package; if you change one, change the other.
 */

/* ------------------------------------------------------------------ *
 * Catalogue
 * ------------------------------------------------------------------ */

export const PERMISSION_GROUPS = [
  {
    id: "roster",
    label: "Roster",
    description: "The community roster and who may change it.",
    permissions: [
      { key: "roster.view", label: "View the roster", detail: "See every member, their department, rank and activity status." },
      { key: "roster.edit_status", label: "Change activity status", detail: "Set a member Active, Semi-Active, LOA or Inactive." },
      { key: "roster.manage_loa", label: "Grant and end LOA", detail: "Place a member on leave with a return date, or bring them back early." },
      { key: "roster.edit_member", label: "Edit roster entries", detail: "Change a callsign or correct a rank by hand, overriding the Discord sync." },
      { key: "roster.remove", label: "Remove from the roster", detail: "Take a member off the roster entirely." },
    ],
  },
  {
    id: "civilian",
    label: "Civilian Hub",
    description: "Civilian records and the community sections.",
    permissions: [
      { key: "civilian.view", label: "Community pages", detail: "Business directory, job board, classifieds, penal code and guides." },
      { key: "civilian.records", label: "Personal records", detail: "Characters, vehicles, properties and licences." },
    ],
  },
  {
    id: "staff",
    label: "Staff Hub",
    description: "Staff tooling and rank-scoped resources.",
    permissions: [
      { key: "staff.view", label: "Staff portal", detail: "Overview, staff roster, dashboard, trial checklist and resources." },
      { key: "staff.da_view", label: "Disciplinary database", detail: "Read disciplinary actions issued against staff." },
      { key: "staff.links.admin", label: "Administrator resources", detail: "The Administrators link collection." },
      { key: "staff.links.senior", label: "Senior resources", detail: "The Senior Admins+ link collection." },
      { key: "staff.portal.manage", label: "Manage the portal", detail: "Edit reminders, the featured member, quick notes and every rank's links." },
    ],
  },
  {
    id: "exams",
    label: "Staff exams",
    description: "The exam backend behind staff promotion.",
    permissions: [
      { key: "exams.view", label: "View submissions", detail: "Recent submissions and member exam history." },
      { key: "exams.override", label: "Override a result", detail: "Change a graded result, recorded permanently in the audit log." },
      { key: "exams.audit", label: "Audit log", detail: "Read every override ever applied." },
      { key: "exams.manage", label: "Manage exams", detail: "Grading thresholds and the question catalog." },
    ],
  },
  {
    id: "site",
    label: "Public site",
    description: "Gated areas of the main community site.",
    permissions: [
      { key: "site.staff_directory", label: "Staff directory", detail: "The staff listing at /staff." },
      { key: "site.moderation", label: "Moderation queue", detail: "Open reports awaiting a decision." },
      { key: "site.support", label: "Support queue", detail: "Member support tickets." },
      { key: "site.leadership", label: "Leadership", detail: "The leadership overview and standing decisions." },
      { key: "site.department_heads", label: "Department heads", detail: "Command staff across every agency." },
    ],
  },
  {
    id: "system",
    label: "System",
    description: "Configuration of the portal itself. Grant sparingly.",
    permissions: [
      {
        key: "permissions.manage",
        label: "Manage permissions",
        detail:
          "Edit this page. Anyone with it can grant themselves everything else, so it belongs with Directorship only.",
        sensitive: true,
      },
      {
        key: "discord.roles.manage",
        label: "Map Discord roles",
        detail:
          "Bind each rank, tier and tag to its Discord role. Getting this wrong mis-ranks the whole community, so it belongs with Directorship only.",
        sensitive: true,
      },
    ],
  },
];

/** Flat lookup of every permission key to its definition. */
export const PERMISSIONS = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((group) =>
    group.permissions.map((permission) => [
      permission.key,
      { ...permission, group: group.id },
    ]),
  ),
);

/* ------------------------------------------------------------------ *
 * Default grants
 * ------------------------------------------------------------------ */

/**
 * Two roles that are not rostered ranks: `member` is anyone in the Discord
 * server, `whitelisted` is anyone approved onto the game server. They are
 * grantable like any other role so the baseline stays configurable.
 */
export const BASE_ROLES = [
  { key: "member", label: "Member", detail: "Anyone in the Discord server." },
  { key: "whitelisted", label: "Whitelisted", detail: "Approved onto the game server." },
];

const CIVILIAN_TIERS = ["cert_civ_1", "cert_civ_2", "cert_civ_3"];
const STAFF_LADDER = [
  "trial_mod",
  "mod",
  "senior_mod",
  "junior_admin",
  "admin",
  "senior_admin",
  "head_admin",
  "directorship",
];

/** Every staff role from `key` upward — the ladder is ordered lowest first. */
function staffFrom(key) {
  return STAFF_LADDER.slice(STAFF_LADDER.indexOf(key));
}

/** Departments whose members should see the roster and community pages. */
const DEPARTMENT_ROLES = [
  "fhp_trooper", "fhp_senior_trooper", "fhp_corporal", "fhp_sergeant",
  "fhp_lieutenant", "fhp_captain", "fhp_colonel",
  "hcso_deputy", "hcso_master_deputy", "hcso_corporal", "hcso_sergeant",
  "hcso_lieutenant", "hcso_major", "hcso_sheriff",
  "tpd_officer", "tpd_senior_officer", "tpd_corporal", "tpd_sergeant",
  "tpd_lieutenant", "tpd_captain", "tpd_chief",
  "hcfr_probationary", "hcfr_firefighter", "hcfr_paramedic", "hcfr_engineer",
  "hcfr_lieutenant", "hcfr_battalion_chief", "hcfr_fire_chief",
  "dhs_agent", "dhs_senior_agent", "dhs_supervisor", "dhs_director",
];

/**
 * The grants the community starts with, reproducing the access the site had
 * before permissions were configurable. Editing them is the whole point of the
 * configuration page — these are only the defaults.
 */
export const DEFAULT_GRANTS = {
  "roster.view": ["member", ...CIVILIAN_TIERS, ...DEPARTMENT_ROLES, ...STAFF_LADDER],
  "roster.edit_status": [...staffFrom("senior_mod"), "dhs_director", "fhp_colonel", "hcso_sheriff", "tpd_chief", "hcfr_fire_chief"],
  "roster.manage_loa": [...staffFrom("senior_mod"), "dhs_director", "fhp_colonel", "hcso_sheriff", "tpd_chief", "hcfr_fire_chief"],
  "roster.edit_member": staffFrom("junior_admin"),
  "roster.remove": staffFrom("admin"),

  "civilian.view": ["member", ...CIVILIAN_TIERS, ...DEPARTMENT_ROLES, ...STAFF_LADDER],
  "civilian.records": ["whitelisted", ...CIVILIAN_TIERS, ...DEPARTMENT_ROLES, ...STAFF_LADDER],

  "staff.view": STAFF_LADDER,
  "staff.da_view": staffFrom("junior_admin"),
  "staff.links.admin": staffFrom("junior_admin"),
  "staff.links.senior": staffFrom("senior_admin"),
  "staff.portal.manage": ["head_admin", "directorship"],

  "exams.view": staffFrom("junior_admin"),
  "exams.override": staffFrom("senior_admin"),
  "exams.audit": staffFrom("senior_admin"),
  "exams.manage": ["head_admin", "directorship"],

  "site.staff_directory": STAFF_LADDER,
  "site.moderation": staffFrom("mod"),
  "site.support": STAFF_LADDER,
  "site.leadership": ["head_admin", "directorship"],
  "site.department_heads": ["head_admin", "directorship", "fhp_colonel", "hcso_sheriff", "tpd_chief", "hcfr_fire_chief", "dhs_director"],

  // Both of these can be used to grant everything else, so they sit at the top
  // of the ladder. Gating role mapping lower would be cosmetic: anyone able to
  // edit permissions could simply grant it to themselves.
  "permissions.manage": ["directorship"],
  "discord.roles.manage": ["directorship"],
};

/* ------------------------------------------------------------------ *
 * Resolution
 * ------------------------------------------------------------------ */

/**
 * The permissions a set of role keys satisfies. Both the client guard and the
 * server middleware call this, so a page and its API can never disagree about
 * who is allowed in.
 */
export function permissionsFor(roleKeys = [], grants = DEFAULT_GRANTS) {
  const held = new Set(roleKeys);
  return new Set(
    Object.entries(grants)
      .filter(([, roles]) => roles.some((role) => held.has(role)))
      .map(([permission]) => permission),
  );
}

/** True when any of the supplied role keys is granted `permission`. */
export function grantsPermission(permission, roleKeys = [], grants = DEFAULT_GRANTS) {
  const allowed = grants[permission];
  if (!allowed || allowed.length === 0) return false;
  const held = new Set(roleKeys);
  return allowed.some((role) => held.has(role));
}
