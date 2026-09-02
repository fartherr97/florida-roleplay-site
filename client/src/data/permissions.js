/**
 * The permission catalogue and its default grants.
 *
 * Every gated thing in the community is a permission key here, and every
 * permission is granted to a set of **Discord roles**. Nothing in the codebase
 * checks a rank directly any more: routes and buttons ask for a permission, and
 * the grants below decide which roles satisfy it. That is what makes the
 * configuration page able to change access without a deploy.
 *
 * Grants reference a role by its `key` from ROLE_MAP in rosterData.js, which is
 * one-to-one with a Discord role snowflake. The key is the stable handle; the
 * snowflake is the actual binding, and the configuration page shows both.
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
    description: "The civilian community pages — directory, penal code and guides.",
    permissions: [
      { key: "civilian.view", label: "Community pages", detail: "Business directory, penal code and guides." },
      { key: "civilian.penal.manage", label: "Manage the penal code", detail: "Add, edit and remove charges in the penal code." },
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
      { key: "staff.records.manage", label: "Admin logs", detail: "Internal staff record log — resignations, LOAs, strikes, terminations. Never touches a background check. Senior Admins+." },
    ],
  },
  {
    id: "departments",
    label: "Department hubs",
    description:
      "The per-department sites. Each department also grants these capabilities to its own command roles on its Access page; the permissions here reach every department at once.",
    permissions: [
      { key: "departments.view", label: "Open a department hub", detail: "See a department's site — roster, fleet, uniforms and resources." },
      { key: "departments.roster.edit", label: "Arrange any department roster", detail: "Decide which rank sits in which band and which columns show, in every department. Membership itself comes from the community roster." },
      { key: "departments.structure.edit", label: "Edit fleet and uniforms", detail: "Maintain vehicle rosters, uniform kits and chains of command community-wide." },
      { key: "departments.log.manage", label: "Write any admin log", detail: "File disciplinary entries, commendations and rank actions in every department." },
      { key: "departments.audit.view", label: "View department audit logs", detail: "Read every config change and restore an earlier version of a department site." },
      {
        key: "departments.access.manage",
        label: "Manage department access",
        detail:
          "Decide which Discord role holds which capability inside a department, overriding its own command staff.",
        sensitive: true,
      },
      {
        key: "departments.manage",
        label: "Manage every department site",
        detail:
          "Open any department's Builder Portal and create new departments. This is the way back into a department whose own access table locks everyone out, so it belongs with the top of the ladder.",
        sensitive: true,
      },
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
    id: "forms",
    label: "Forms & exams",
    description:
      "The shared form engine behind staff promotion exams, civilian certification tests and feedback forms.",
    permissions: [
      { key: "forms.view", label: "See the forms list", detail: "Open the forms available to you in a hub." },
      { key: "forms.submit", label: "Submit a form", detail: "Fill in and submit a published form you qualify for." },
      { key: "forms.review", label: "Review submissions", detail: "Read every response and grade the written answers on any form." },
      {
        key: "forms.manage",
        label: "Build forms",
        detail:
          "Create and edit forms, set answer keys and pass thresholds, and publish. Anyone with this can read every response, so grant it with exams management.",
        sensitive: true,
      },
    ],
  },
  {
    id: "support",
    label: "Support portal",
    description:
      "Tickets members open and the team works. Anybody signed in can open one — these decide who answers them.",
    permissions: [
      {
        key: "support.work",
        label: "Work the queue",
        detail:
          "See every ticket, reply, write internal notes, change status and take one. The support team's grant.",
      },
      {
        key: "support.escalated",
        label: "Handle reports about staff",
        detail:
          "See and work tickets reporting a staff member. Deliberately apart from support.work — a report about the staff team that the staff team triages is not a report.",
        sensitive: true,
      },
      {
        key: "support.manage",
        label: "Run the portal",
        detail:
          "Hand a ticket to somebody else, and build the response flows agents walk. Without it an agent can take a ticket but not push one onto a colleague.",
        sensitive: true,
      },
      {
        key: "support.configure",
        label: "Configure ticket categories",
        detail:
          "Add, edit, reorder and remove the categories a member picks when opening a ticket, and set who opens and who works each. Whoever holds it decides how every ticket is routed, so it sits with Directorship and Ownership.",
        sensitive: true,
      },
      {
        key: "support.webhooks",
        label: "Configure ticket webhooks",
        detail:
          "Set the Discord webhooks a new ticket is announced to — the support team's, and each department's own — and the role pinged for support tickets. Ownership only.",
        sensitive: true,
      },
    ],
  },
  {
    id: "department_support",
    label: "Department support queues",
    description:
      "Who works each department's own ticket category. Holding one lets that department's command see and work its queue without being on the central support team — which still sees everything.",
    permissions: [
      { key: "support.fhp", label: "Work FHP tickets", detail: "See and work tickets opened for Florida Highway Patrol." },
      { key: "support.mpd", label: "Work MPD tickets", detail: "See and work tickets opened for Miami Police Department." },
      { key: "support.bcso", label: "Work BCSO tickets", detail: "See and work tickets opened for Broward County Sheriff's Office." },
      { key: "support.civilian", label: "Work Civilian Department tickets", detail: "See and work tickets opened for the Civilian Department." },
    ],
  },
  {
    id: "discipline",
    label: "Disciplinary actions",
    description:
      "Filing and reading actions against a member. One record spans the staff team and every department — it is what /bgcheck reads in Discord.",
    permissions: [
      {
        key: "discipline.file",
        label: "File an action anywhere",
        detail:
          "Record an action on behalf of any department or the staff team. Department command already file against their own department without this.",
      },
      {
        key: "discipline.view",
        label: "Read the whole record",
        detail:
          "See every action and run a background check on any member. Without it somebody sees only the ones they filed themselves.",
        sensitive: true,
      },
      {
        key: "discipline.manage",
        label: "Correct or void any action",
        detail:
          "Edit or withdraw somebody else's entry. Whoever filed one can already fix their own.",
        sensitive: true,
      },
    ],
  },
  {
    id: "emails",
    label: "Email directory",
    description:
      "The community email directory — every member's email on file, with their department and rank, read on the site and looked up by the bot.",
    permissions: [
      {
        key: "emails.view",
        label: "View the email directory",
        detail:
          "See every member's email alongside their department and rank, and look one up by member or by address. Anyone can add their own email; reading others' needs this.",
        sensitive: true,
      },
    ],
  },
  {
    id: "rules",
    label: "Server rules",
    description: "Editing the public server rulebook. Ownership only.",
    permissions: [
      {
        key: "rules.manage",
        label: "Edit the rules",
        detail:
          "Add, edit, reorder and remove rules and their categories on the public Rules page. Ownership only.",
        sensitive: true,
      },
    ],
  },
  {
    id: "store",
    label: "Store",
    description:
      "The Tebex-backed storefront: package display, entitlement mappings, purchases and fulfillment. Ownership only.",
    permissions: [
      {
        key: "store.manage",
        label: "Manage the store",
        detail:
          "Sync packages from Tebex, set how each appears on the site, map the FLRP entitlements a package grants, and see purchases, fulfillment and the store audit log. Whoever holds it decides what buying a package grants, so it sits with Ownership only.",
        sensitive: true,
      },
    ],
  },
  {
    id: "truthsocial",
    label: "Broadcast",
    description:
      "Posting a community broadcast to a Discord channel through a webhook. Ownership only.",
    permissions: [
      {
        key: "truthsocial.post",
        label: "Post broadcasts",
        detail:
          "Configure the broadcast webhook and send posts to the channel it points at. Ownership only.",
        sensitive: true,
      },
    ],
  },
  {
    id: "transfers",
    label: "Transfer portal",
    description:
      "Moving a member between emergency services departments. Each department's command signs for its own side; Directorship oversees every one of them.",
    permissions: [
      {
        key: "transfers.view",
        label: "Open the transfer portal",
        detail:
          "Show the portal in the menus. Authority inside it is not this grant: a ticket is readable by whoever raised it and by the command of either department on it, Directorship sees every one, and the portal re-checks all of that on every call.",
      },
    ],
  },
  {
    id: "promotions",
    label: "Promotion board",
    description:
      "Nominations, the timed vote behind them, and who may watch a result before it is published.",
    permissions: [
      { key: "promotions.view", label: "See the board", detail: "Read open nominations and published outcomes." },
      { key: "promotions.vote", label: "Vote", detail: "Cast and change a ballot while a nomination is open." },
      { key: "promotions.nominate", label: "Nominate", detail: "Open a nomination and set its voting window." },
      {
        key: "promotions.manage",
        label: "Manage the board",
        detail:
          "Publish or withdraw a nomination, and decide which roles may watch live results. Anyone with it sees every ballot as it is cast.",
        sensitive: true,
      },
    ],
  },
  {
    id: "media",
    label: "Image hosting",
    description:
      "The community image host: upload an image and get a shareable link. Anyone with a link can view the image; only holders can upload or remove one.",
    permissions: [
      {
        key: "media.upload",
        label: "Upload images",
        detail: "Upload an image to the host, get its link, and remove your own images.",
      },
      {
        key: "media.manage",
        label: "Administer the image host",
        detail: "See every uploaded image with who posted it, and remove anyone's.",
      },
    ],
  },
  {
    id: "development",
    label: "Development Hub",
    description:
      "Requests members open for personal vehicles, department work and builds. Anyone signed in can open one — these decide who works them and who maintains the hub.",
    permissions: [
      {
        key: "development.work",
        label: "Work the dev queue",
        detail:
          "See every request, reply, write internal notes, change status and take one. The dev team's grant.",
      },
      {
        key: "development.manage",
        label: "Manage the hub",
        detail:
          "Maintain the vehicle library, triage suggestions and bug reports, and configure the request categories.",
        sensitive: true,
      },
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
          "Edit this page. Anyone with it can grant themselves everything else, so it belongs with Directorship and Ownership only.",
        sensitive: true,
      },
      {
        key: "discord.roles.manage",
        label: "Map Discord roles",
        detail:
          "Bind each rank, tier and tag to its Discord role. Getting this wrong mis-ranks the whole community, so it belongs with Directorship and Ownership only.",
        sensitive: true,
      },
    ],
  },
  {
    id: "fivem",
    label: "FiveM (in-game)",
    description:
      "The in-game FiveM server config — groups, permissions, pay, weapons and vehicles. Edits apply to the live server with no restart.",
    permissions: [
      {
        key: "fivem.view",
        label: "View FiveM config",
        detail:
          "Read the in-game permission matrix, pay rates, and the weapon and vehicle registries.",
      },
      {
        key: "fivem.manage",
        label: "Manage FiveM config",
        detail:
          "Edit in-game permissions, pay, weapons and vehicles. Changes push to the game server and take effect live, with no restart.",
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
  "ownership",
];

/** Every staff role from `key` upward — the ladder is ordered lowest first. */
function staffFrom(key) {
  return STAFF_LADDER.slice(STAFF_LADDER.indexOf(key));
}

/** Departments whose members should see the roster and community pages. */
const DEPARTMENT_ROLES = [
  "fhp_trooper", "fhp_senior_trooper", "fhp_corporal", "fhp_sergeant",
  "fhp_lieutenant", "fhp_captain", "fhp_colonel",
  "bcso_deputy", "bcso_master_deputy", "bcso_corporal", "bcso_sergeant",
  "bcso_lieutenant", "bcso_major", "bcso_sheriff",
  "mpd_officer", "mpd_senior_officer", "mpd_corporal", "mpd_sergeant",
  "mpd_lieutenant", "mpd_captain", "mpd_chief",
];

/**
 * The grants the community starts with, reproducing the access the site had
 * before permissions were configurable. Editing them is the whole point of the
 * configuration page — these are only the defaults.
 */
export const DEFAULT_GRANTS = {
  // FiveM in-game config: reading is for admins+, editing for the top only.
  "fivem.view": staffFrom("admin"),
  "fivem.manage": ["head_admin", "directorship", "ownership"],

  "roster.view": ["member", ...CIVILIAN_TIERS, ...DEPARTMENT_ROLES, ...STAFF_LADDER],
  "roster.edit_status": [...staffFrom("senior_mod"), "fhp_colonel", "bcso_sheriff", "mpd_chief"],
  "roster.manage_loa": [...staffFrom("senior_mod"), "fhp_colonel", "bcso_sheriff", "mpd_chief"],
  "roster.edit_member": staffFrom("junior_admin"),
  "roster.remove": staffFrom("admin"),

  "civilian.view": ["member", ...CIVILIAN_TIERS, ...DEPARTMENT_ROLES, ...STAFF_LADDER],
  "civilian.penal.manage": staffFrom("admin"),

  "staff.view": STAFF_LADDER,
  "staff.da_view": staffFrom("junior_admin"),
  "staff.links.admin": staffFrom("junior_admin"),
  "staff.links.senior": staffFrom("senior_admin"),
  "staff.portal.manage": ["head_admin", "directorship", "ownership"],
  "staff.records.manage": staffFrom("senior_admin"),

  "departments.view": ["member", ...CIVILIAN_TIERS, ...DEPARTMENT_ROLES, ...STAFF_LADDER],
  "departments.roster.edit": staffFrom("admin"),
  "departments.structure.edit": staffFrom("admin"),
  "departments.log.manage": staffFrom("senior_admin"),
  "departments.audit.view": staffFrom("senior_admin"),
  "departments.access.manage": ["head_admin", "directorship", "ownership"],
  "departments.manage": ["head_admin", "directorship", "ownership"],

  "exams.view": staffFrom("junior_admin"),
  "exams.override": staffFrom("senior_admin"),
  "exams.audit": staffFrom("senior_admin"),
  "exams.manage": ["head_admin", "directorship", "ownership"],

  "forms.view": ["member", ...CIVILIAN_TIERS, ...DEPARTMENT_ROLES, ...STAFF_LADDER],
  "forms.submit": ["member", ...CIVILIAN_TIERS, ...DEPARTMENT_ROLES, ...STAFF_LADDER],
  "forms.review": staffFrom("senior_mod"),
  "forms.manage": ["head_admin", "directorship", "ownership"],

  "promotions.view": STAFF_LADDER,
  "promotions.vote": staffFrom("mod"),
  "promotions.nominate": staffFrom("senior_mod"),
  "promotions.manage": ["head_admin", "directorship", "ownership"],

  // Department command build their own department's applications without a
  // grant — canManageApplications knows the command role for each. These two are
  // the community-wide versions, for the people who oversee every department.

  // A menu gate and nothing more. The transfer portal decides who may read and
  // act on a ticket from the department roles themselves — the way the app it
  // was ported from does — so there is no second grant here that could disagree
  // with it: your own ticket, or one involving a department you command, and
  // Directorship over all of them.
  "transfers.view": ["member", "whitelisted", ...CIVILIAN_TIERS, ...DEPARTMENT_ROLES, ...STAFF_LADDER],

  // Department command file against their own department without a grant, the
  // same way they run their own roster. These are the community-wide
  // versions — and reading somebody's whole record is its own grant from
  // filing one, because the two are not the same act.
  "discipline.file": ["senior_admin", "head_admin", "directorship", "ownership"],
  "discipline.view": ["senior_admin", "head_admin", "directorship", "ownership"],
  "discipline.manage": ["head_admin", "directorship", "ownership"],

  "emails.view": ["directorship", "ownership"],
  "truthsocial.post": ["ownership"],
  "rules.manage": ["ownership"],
  "store.manage": ["ownership"],

  // Opening a ticket needs nothing but a Discord account — support that only
  // answers people who already hold a role is not support. These decide who
  // works them.
  "support.work": staffFrom("trial_mod"),
  "support.escalated": ["directorship", "ownership"],
  "support.manage": ["head_admin", "directorship", "ownership"],
  "support.configure": ["directorship", "ownership"],
  "support.webhooks": ["ownership"],

  // Each department's own queue is worked by that department's command. The
  // central support team (support.work) and Directorship still see every queue.
  "support.fhp": ["fhp_lieutenant", "fhp_captain", "fhp_colonel"],
  "support.mpd": ["mpd_lieutenant", "mpd_captain", "mpd_chief"],
  "support.bcso": ["bcso_lieutenant", "bcso_major", "bcso_sheriff"],
  "support.civilian": ["senior_admin", "head_admin", "directorship", "ownership"],

  // Uploading to the image host — seeded to staff and department command, widen
  // it on this page for anyone else who should host images.
  "media.upload": [...staffFrom("mod"), "fhp_colonel", "bcso_sheriff", "mpd_chief"],
  "media.manage": staffFrom("senior_admin"),

  // The dev team works development requests; department command see their own
  // department's work. Managing the hub (vehicle library, request categories)
  // sits higher. Opening a request needs nothing but a Discord account.
  "development.work": [...staffFrom("admin"), "fhp_colonel", "bcso_sheriff", "mpd_chief"],
  "development.manage": ["head_admin", "directorship", "ownership"],

  "site.staff_directory": STAFF_LADDER,
  "site.moderation": staffFrom("mod"),
  "site.support": STAFF_LADDER,
  "site.leadership": ["head_admin", "directorship", "ownership"],
  "site.department_heads": ["head_admin", "directorship", "ownership", "fhp_colonel", "bcso_sheriff", "mpd_chief"],

  // Both of these can be used to grant everything else, so they sit at the top
  // of the ladder. Gating role mapping lower would be cosmetic: anyone able to
  // edit permissions could simply grant it to themselves.
  "permissions.manage": ["directorship", "ownership"],
  "discord.roles.manage": ["directorship", "ownership"],
};

/* ------------------------------------------------------------------ *
 * Resolution
 * ------------------------------------------------------------------ */

/**
 * Ownership holds every permission, always, without being listed in a grant.
 *
 * This is not a shortcut — it is what stops the tier from being a lie. The rank
 * ladder is a preview convenience; somebody who actually holds the Ownership
 * Discord role holds *only* that role, so every grant would have to name it or
 * they get nothing. An install that saved its permissions before this tier
 * existed has grants that cannot name it, and a single careless edit on the
 * permissions page could lock the owner out of their own site with no way back
 * in — the page that fixes it is itself behind a permission.
 *
 * Nothing is lost by it: `permissions.manage` already lets its holder grant
 * themselves everything else, so a revocable Ownership was never a real limit.
 */
export const ROOT_ROLE = "ownership";

/**
 * The permissions a set of role keys satisfies. Both the client guard and the
 * server middleware call this, so a page and its API can never disagree about
 * who is allowed in.
 */
export function permissionsFor(roleKeys = [], grants = DEFAULT_GRANTS) {
  const held = new Set(roleKeys);
  if (held.has(ROOT_ROLE)) return new Set(Object.keys(PERMISSIONS));
  return new Set(
    Object.entries(grants)
      .filter(([, roles]) => roles.some((role) => held.has(role)))
      .map(([permission]) => permission),
  );
}

/** True when any of the supplied role keys is granted `permission`. */
export function grantsPermission(permission, roleKeys = [], grants = DEFAULT_GRANTS) {
  const held = new Set(roleKeys);
  if (held.has(ROOT_ROLE)) return true;
  const allowed = grants[permission];
  if (!allowed || allowed.length === 0) return false;
  return allowed.some((role) => held.has(role));
}
