/**
 * The department hub config engine.
 *
 * A department site is a single config document. This module is everything that
 * reads one: it fills in defaults, decides what a caller may see or edit, turns
 * branding into CSS variables, and shapes the document for the wire. The React
 * pages and the Express routes both import it, so a page and its API can never
 * disagree about who may do what.
 *
 * Mirrored exactly at server/src/lib/departmentConfig.js — see the note there.
 *
 * Two deliberate departures from the reference implementation this was ported
 * from (fartherr97/ssrp-department-hub):
 *
 *  1. Membership is not stored in the config. A department's roster is a
 *     projection of the community roster in src/data/rosterData.js, bucketed by
 *     the Discord role map. The config decides presentation — categories,
 *     columns, banners, stats — and the bot keeps the membership itself current
 *     through the sync API it already writes to. Storing members here would mean
 *     two sources of truth for the same people.
 *  2. Permissions are not a second model. The reference gave each config its own
 *     `groups` with capability flags; here a department grants capabilities to
 *     the same Discord role keys the rest of the community uses, and the
 *     site-wide permissions in src/data/permissions.js still override.
 */

/** Bump when a change to the shape needs `migrateConfig` to touch stored rows. */
import { ACTION_BODY_MAP } from "./discipline";

export const CONFIG_VERSION = 1;

/* ------------------------------------------------------------------ *
 * Capabilities
 * ------------------------------------------------------------------ */

/**
 * What a Discord role can be granted *inside one department*. Rendered as the
 * toggle list on the Access page, so adding an entry here surfaces it for every
 * department at once.
 *
 * These are deliberately narrow: they only ever apply to the department whose
 * config granted them. The community-wide equivalents live in the permission
 * catalogue and are what let (say) Directorship edit every department.
 */
export const CAPABILITIES = [
  {
    key: "manage",
    label: "Manage this site",
    detail:
      "Open the Builder Portal — branding, pages, roster setup and backups. Implies every capability below.",
  },
  {
    key: "editRoster",
    label: "Arrange the roster",
    detail:
      "Decide which rank sits in which band, and which columns the roster shows. Who is actually on it comes from the community roster the Discord bot maintains.",
  },
  {
    key: "editStructure",
    label: "Edit fleet and uniforms",
    detail: "Maintain the vehicle roster, uniform kits and the chain of command.",
  },
  { key: "manageCalendar", label: "Manage the calendar", detail: "Post and edit department events." },
  {
    key: "manageLog",
    label: "Write the admin log",
    detail: "File disciplinary entries, commendations and rank actions.",
  },
  {
    key: "manageAccess",
    label: "Manage access",
    detail: "Grant these capabilities to other Discord roles, up to your own level.",
  },
  { key: "viewAudit", label: "View the audit log", detail: "Read every config change and restore an earlier version." },
];

export const CAPABILITY_KEYS = CAPABILITIES.map((c) => c.key);

/**
 * A department's recruitment state, shown as a coloured pill on its public page
 * and the departments split. A department head sets it from the Builder, so the
 * pill is real rather than a hardcoded "hiring".
 */
export const RECRUITMENT_STATUSES = [
  { id: "hiring", label: "Now Hiring", color: "#22c55e", apply: true },
  { id: "interviews", label: "Open Interviews", color: "#3b82f6", apply: true },
  { id: "limited", label: "Limited Hiring", color: "#f59e0b", apply: true },
  { id: "closed", label: "Applications Closed", color: "#ef4444", apply: false },
];

export const RECRUITMENT_STATUS_MAP = Object.fromEntries(
  RECRUITMENT_STATUSES.map((s) => [s.id, s]),
);

/** The status object for a config, always resolving to a known one. */
export function recruitmentOf(config) {
  return RECRUITMENT_STATUS_MAP[config?.recruitment?.status] ?? RECRUITMENT_STATUS_MAP.hiring;
}

/**
 * Community-wide permissions that grant the matching department capability in
 * *every* department. This is the bridge between the two models: a department
 * command role is scoped to its own site, while these reach across all of them.
 */
export const GLOBAL_CAPABILITY_PERMISSIONS = {
  "departments.manage": "manage",
  "departments.roster.edit": "editRoster",
  "departments.structure.edit": "editStructure",
  "departments.log.manage": "manageLog",
  "departments.access.manage": "manageAccess",
  "departments.audit.view": "viewAudit",
};

/**
 * The capabilities a caller holds in one department.
 *
 * `roleKeys` are the caller's Discord role keys (from ROLE_MAP); `permissions`
 * is the set of community-wide permission keys they hold. `manage` implies
 * everything else, which is what makes the Builder Portal a single grant rather
 * than seven.
 */
export function capabilitiesFor(config, roleKeys = [], permissions = new Set()) {
  const held = new Set();
  const roles = new Set(roleKeys);
  const perms = permissions instanceof Set ? permissions : new Set(permissions);

  for (const [permission, capability] of Object.entries(GLOBAL_CAPABILITY_PERMISSIONS)) {
    if (perms.has(permission)) held.add(capability);
  }
  for (const grant of config?.access || []) {
    if (!roles.has(grant.roleKey)) continue;
    for (const key of CAPABILITY_KEYS) if (grant[key]) held.add(key);
  }

  if (held.has("manage")) CAPABILITY_KEYS.forEach((key) => held.add(key));
  return held;
}

/**
 * The highest access level the caller holds here, used to stop someone editing a
 * grant above their own station. Community-wide `departments.manage` outranks
 * every configured role, so a locked-out department is always recoverable.
 */
export function accessLevelFor(config, roleKeys = [], permissions = new Set()) {
  const perms = permissions instanceof Set ? permissions : new Set(permissions);
  if (perms.has("departments.manage")) return Infinity;
  const roles = new Set(roleKeys);
  return (config?.access || [])
    .filter((grant) => roles.has(grant.roleKey))
    .reduce((max, grant) => Math.max(max, grant.level ?? 0), -1);
}

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */

/**
 * Every page type the engine can render, with the capability that unlocks its
 * editing controls and whether it is an administrative page. `App.jsx` maps
 * these ids onto components; adding a type means adding both.
 */
export const PAGE_TYPES = [
  { type: "home", label: "Home", icon: "Home", detail: "Hero banner plus content blocks." },
  { type: "welcome", label: "Welcome", icon: "Star", detail: "A public landing: hero over a rotating photo gallery, an announcements ticker and content blocks." },
  { type: "content", label: "Content", icon: "BookOpen", detail: "A page of content blocks — SOPs, resources, guides." },
  { type: "roster", label: "Roster", icon: "Users", detail: "Personnel grouped into categories, projected from the community roster.", edit: "editRoster" },
  { type: "fleet", label: "Fleet", icon: "Car", detail: "The vehicle roster.", edit: "editStructure" },
  { type: "uniforms", label: "Uniforms", icon: "Shirt", detail: "Uniform kits and clothing codes.", edit: "editStructure" },
  { type: "chain", label: "Chain of command", icon: "Network", detail: "The command tree, built from the roster's categories.", edit: "editStructure" },
  { type: "calendar", label: "Calendar", icon: "Calendar", detail: "Trainings, patrols and department events.", edit: "manageCalendar" },
  { type: "adminlog", label: "Admin log", icon: "Gavel", detail: "Disciplinary entries, commendations and rank actions.", edit: "manageLog", requires: "manageLog" },
  { type: "dahub", label: "DA Database", icon: "Gavel", detail: "File and review this department's disciplinary actions — the same record /bgcheck reads.", edit: "manageLog", requires: "manageLog" },
  { type: "activity", label: "Activity feed", icon: "Activity", detail: "A running feed of roster and log changes." },
  { type: "hours", label: "Duty hours", icon: "Clock", detail: "Patrol hours per member for the current period.", edit: "editRoster" },
  { type: "audit", label: "Audit log", icon: "ScrollText", detail: "Config changes and version history.", requires: "viewAudit" },
  { type: "access", label: "Access & roles", icon: "Shield", detail: "Which Discord role holds which capability here.", requires: "manageAccess" },
  { type: "builder", label: "Builder Portal", icon: "SlidersHorizontal", detail: "Configure this whole site.", requires: "manage" },
];

export const PAGE_TYPE_MAP = Object.fromEntries(PAGE_TYPES.map((p) => [p.type, p]));

/**
 * Whether a caller may open a page.
 *
 * Administrative types carry a fixed capability requirement that a config cannot
 * loosen — otherwise a department could hand its Builder Portal to everyone.
 * Any other page is open to anyone who can see the department, unless it opts
 * into `restricted` and names the roles allowed.
 */
export function canOpenPage(page, { capabilities = new Set(), roleKeys = [] } = {}) {
  if (!page) return false;
  const required = PAGE_TYPE_MAP[page.type]?.requires;
  if (required) return capabilities.has(required);
  if (!page.restricted) return true;
  if (capabilities.has("manage")) return true;
  const allowed = page.access || [];
  if (allowed.length === 0) return false;
  const roles = new Set(roleKeys);
  return allowed.some((key) => roles.has(key));
}

/** The pages a caller may open, in config order. */
export function visiblePages(config, ctx) {
  return (config?.pages || []).filter((page) => canOpenPage(page, ctx));
}

/**
 * Nav groups with their visible pages, dropping any group left empty. The nav is
 * a convenience — DeptShell gates the route and the API gates the data.
 */
export function navFor(config, ctx) {
  const pages = visiblePages(config, ctx);
  return (config?.navGroups || [])
    .map((group) => ({
      ...group,
      pages: pages.filter((page) => page.navGroup === group.id),
    }))
    .filter((group) => group.pages.length > 0);
}

/** The page a URL segment names, falling back to the first one it may open. */
export function resolvePage(config, pageId, ctx) {
  const pages = config?.pages || [];
  const asked = pageId ? pages.find((page) => page.id === pageId) : null;
  if (asked) return asked;
  return visiblePages(config, ctx)[0] ?? null;
}

/* ------------------------------------------------------------------ *
 * Theming
 * ------------------------------------------------------------------ */

/**
 * A department's accent, as the CSS variables DeptShell sets on its wrapper.
 * Scoping them to the wrapper rather than :root means the public site's orange
 * is untouched the moment you navigate out of the hub.
 */
export const ACCENT_PRESETS = [
  { id: "brand", label: "Patrol blue", color: "#3b82f6", soft: "#60a5fa" },
  { id: "primary", label: "Florida orange", color: "#f2800d", soft: "#f59331" },
  { id: "green", label: "Sheriff green", color: "#10b981", soft: "#34d399" },
  { id: "amber", label: "Federal amber", color: "#f59e0b", soft: "#fbbf24" },
  { id: "rose", label: "Fire red", color: "#f43f5e", soft: "#fb7185" },
  { id: "violet", label: "Command violet", color: "#8b5cf6", soft: "#a78bfa" },
  { id: "slate", label: "Neutral slate", color: "#64748b", soft: "#94a3b8" },
];

const ACCENT_MAP = Object.fromEntries(ACCENT_PRESETS.map((a) => [a.id, a]));

/** Resolve a branding accent — a preset id, or a literal #rrggbb. */
export function accentOf(branding) {
  const raw = branding?.accent || "brand";
  if (ACCENT_MAP[raw]) return ACCENT_MAP[raw];
  if (/^#[0-9a-f]{6}$/i.test(raw)) return { id: raw, label: "Custom", color: raw, soft: raw };
  return ACCENT_MAP.brand;
}

export function themeVars(branding) {
  const accent = accentOf(branding);
  // Two families on one wrapper: the legacy --dept-accent tokens the older dept
  // pages read, and the flat --color-* tokens the ported "CAD" utilities and the
  // shared FLRP components read. Both are driven by the same accent so a
  // department reskins its whole site from one colour. The navy surfaces are
  // fixed in the .dept-hub CSS; only the accent-derived tokens are set here.
  return {
    "--dept-accent": accent.color,
    "--dept-accent-soft": accent.soft,
    "--color-primary": accent.color,
    "--color-hover": accent.soft,
    "--color-border": `color-mix(in srgb, ${accent.color} 20%, transparent)`,
    "--color-border-strong": `color-mix(in srgb, ${accent.color} 36%, transparent)`,
  };
}

/* ------------------------------------------------------------------ *
 * Normalisation
 * ------------------------------------------------------------------ */

const DEFAULT_NAV_GROUPS = [
  { id: "main", label: "Main" },
  { id: "resources", label: "Resources" },
  { id: "admin", label: "Administration" },
];

const DEFAULT_MEMBER_FIELDS = [
  { id: "callsign", label: "Callsign", type: "text" },
  {
    id: "status",
    label: "Status",
    type: "select",
    options: ["Active", "Semi-Active", "LOA", "Inactive"],
    pill: true,
  },
];

/**
 * Fill in everything a stored config may be missing and drop anything the engine
 * does not understand. Every read goes through this, so a config written by an
 * older build, a hand-edited backup or a half-finished Builder session still
 * renders instead of throwing somewhere deep in a page.
 */
export function normalizeConfig(raw, id) {
  const config = raw && typeof raw === "object" ? raw : {};
  const branding = config.branding || {};
  const roster = config.roster || {};

  const navGroups = (Array.isArray(config.navGroups) && config.navGroups.length
    ? config.navGroups
    : DEFAULT_NAV_GROUPS
  ).map((group, index) => ({
    id: String(group.id ?? `group-${index}`),
    label: String(group.label ?? group.id ?? `Group ${index + 1}`),
  }));

  const groupIds = new Set(navGroups.map((g) => g.id));

  const pages = (Array.isArray(config.pages) ? config.pages : [])
    .filter((page) => page && PAGE_TYPE_MAP[page.type])
    .map((page, index) => ({
      id: String(page.id ?? `page-${index}`),
      label: String(page.label ?? PAGE_TYPE_MAP[page.type].label),
      type: page.type,
      icon: page.icon || PAGE_TYPE_MAP[page.type].icon,
      // A page pointing at a group that no longer exists would vanish from the
      // nav with no way back; park it in the first group instead.
      navGroup: groupIds.has(page.navGroup) ? page.navGroup : navGroups[0].id,
      locked: !!page.locked,
      restricted: !!page.restricted,
      access: Array.isArray(page.access) ? page.access.map(String) : [],
      config: page.config && typeof page.config === "object" ? page.config : {},
    }));

  // Every department that can file disciplinary actions gets the DA Database page,
  // even on a config saved before the page existed — so command can file and review
  // their own department's DAs from the dept hub. Injected non-destructively (opening
  // is still gated on `manageLog`); a save from the builder persists it.
  const deptId = String(config.id || id || "department");
  if (ACTION_BODY_MAP[deptId]?.source === "department" && !pages.some((p) => p.type === "dahub")) {
    pages.push({
      id: "dahub",
      label: "DA Database",
      type: "dahub",
      icon: "Gavel",
      navGroup: groupIds.has("admin") ? "admin" : navGroups[0].id,
      locked: false,
      restricted: false,
      access: [],
      config: {},
    });
  }

  return {
    version: CONFIG_VERSION,
    id: String(config.id || id || "department"),
    // This department's own Discord server id, when it runs one — the roster
    // sync reads members from it as well as the main guild. Empty means the
    // department lives in the main guild only.
    guildId: /^\d{17,20}$/.test(String(config.guildId ?? "")) ? String(config.guildId) : "",
    branding: {
      name: branding.name || "Department",
      shortName: branding.shortName || branding.name || "Department",
      tagline: branding.tagline || "Internal Operations",
      description: branding.description || "",
      accent: branding.accent || "brand",
      logoUrl: branding.logoUrl || "",
      bannerUrl: branding.bannerUrl || "",
    },
    navGroups,
    pages,
    roster: {
      layout: roster.layout === "grid" ? "grid" : "tabs",
      // "shared" projects the community roster; "config" uses members stored on
      // the subdivision, for a unit the Discord bot does not track.
      source: roster.source === "config" ? "config" : "shared",
      memberFields: Array.isArray(roster.memberFields) && roster.memberFields.length
        ? roster.memberFields
        : DEFAULT_MEMBER_FIELDS,
      stats: {
        show: roster.stats?.show !== false,
        items: Array.isArray(roster.stats?.items) ? roster.stats.items : [],
      },
      // Callsigns handed out automatically from a per-department number range, so
      // a new member is assigned the next free number in the range and keeps it.
      // A zero range (the default) means no auto-assignment — callsigns then come
      // only from a member's Discord nickname, or nowhere.
      callsigns: {
        auto: roster.callsigns?.auto !== false,
        min: Number.isFinite(roster.callsigns?.min) ? Math.max(0, Math.trunc(roster.callsigns.min)) : 0,
        max: Number.isFinite(roster.callsigns?.max) ? Math.max(0, Math.trunc(roster.callsigns.max)) : 0,
      },
      subdivisions: (Array.isArray(roster.subdivisions) ? roster.subdivisions : []).map(
        (sub, index) => ({
          id: String(sub.id ?? `sub-${index}`),
          name: String(sub.name ?? `Unit ${index + 1}`),
          main: !!sub.main,
          accent: sub.accent || "",
          banner: sub.banner || {},
          // Which role keys from ROLE_MAP land in this subdivision. Empty on the
          // main roster means "every role mapped to this department".
          roleKeys: Array.isArray(sub.roleKeys) ? sub.roleKeys.map(String) : [],
          categories: (Array.isArray(sub.categories) ? sub.categories : []).map(
            (cat, catIndex) => ({
              id: String(cat.id ?? `cat-${catIndex}`),
              name: String(cat.name ?? `Category ${catIndex + 1}`),
              color: cat.color || "#64748b",
              // An optional badge/insignia shown on the roster band and chain.
              insigniaUrl: cat.insigniaUrl || "",
              roleKeys: Array.isArray(cat.roleKeys) ? cat.roleKeys.map(String) : [],
              members: Array.isArray(cat.members) ? cat.members : [],
            }),
          ),
        }),
      ),
    },
    access: (Array.isArray(config.access) ? config.access : []).map((grant, index) => ({
      roleKey: String(grant.roleKey ?? ""),
      label: grant.label || grant.roleKey || `Grant ${index + 1}`,
      level: Number.isFinite(grant.level) ? grant.level : 0,
      ...Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, !!grant[key]])),
    })).filter((grant) => grant.roleKey),
    webhooks: config.webhooks && typeof config.webhooks === "object" ? config.webhooks : {},
    recruitment: {
      status: RECRUITMENT_STATUS_MAP[config.recruitment?.status] ? config.recruitment.status : "hiring",
      // Up to four fleet vehicle ids to feature on the public page.
      featuredVehicles: Array.isArray(config.recruitment?.featuredVehicles)
        ? config.recruitment.featuredVehicles.map(String).slice(0, 4)
        : [],
    },
  };
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** True for an id safe to use as a department key, a table value and a URL segment. */
export function validDepartmentId(id) {
  return typeof id === "string" && ID_RE.test(id);
}

/**
 * Reject a config that would break the site or lock everyone out of it. Runs in
 * the Builder before a save and again on the server, because the second one is
 * the boundary.
 */
export function validateConfig(config) {
  const errors = [];
  if (!config || typeof config !== "object") return ["Config must be an object."];
  if (!validDepartmentId(config.id)) errors.push("Department id must be lowercase letters, digits and dashes.");
  if (!config.branding?.name) errors.push("The department needs a name.");
  if (!Array.isArray(config.pages) || config.pages.length === 0) {
    errors.push("A department needs at least one page.");
  }

  const ids = new Set();
  for (const page of config.pages || []) {
    if (ids.has(page.id)) errors.push(`Two pages share the id "${page.id}".`);
    ids.add(page.id);
    if (!PAGE_TYPE_MAP[page.type]) errors.push(`Page "${page.label || page.id}" has an unknown type.`);
  }

  // The same lockout rule the site-wide permissions page enforces: undoing a
  // config with nobody able to manage it would take a database edit.
  const managers = (config.access || []).filter((grant) => grant.manage);
  if (managers.length === 0) {
    errors.push("At least one Discord role must be able to manage this site.");
  }

  for (const url of webhookUrls(config)) {
    if (url && url !== REDACTED && !/^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//.test(url)) {
      errors.push("Webhook URLs must be Discord webhook URLs.");
    }
  }
  return errors;
}

function webhookUrls(config) {
  return Object.values(config?.webhooks || {}).map((hook) => hook?.url || "");
}

/* ------------------------------------------------------------------ *
 * Wire shapes
 * ------------------------------------------------------------------ */

/**
 * A Discord webhook URL is a write credential for a channel — anyone holding it
 * can post as the department. It never leaves the server except to someone who
 * could set it in the first place, and this sentinel is what comes back instead.
 */
export const REDACTED = "__redacted__";

/** The config minus its secrets, for a caller who cannot manage the site. */
export function redactSensitive(config) {
  if (!config?.webhooks) return config;
  return {
    ...config,
    webhooks: Object.fromEntries(
      Object.entries(config.webhooks).map(([key, hook]) => [
        key,
        hook?.url ? { ...hook, url: REDACTED } : hook,
      ]),
    ),
  };
}

/**
 * Strip the access table. It is a map of "which Discord role holds which power
 * here", which is exactly what someone probing the department would want; only
 * people who can already read it on the Access page get it.
 */
export function redactAccess(config) {
  return { ...config, access: [] };
}

/**
 * Restore secrets the caller received redacted, before a save. Someone editing
 * the roster still PUTs the whole document, and their copy has the sentinel
 * where a URL used to be — without this, a routine save would blank it.
 */
export function mergeRedactedBack(incoming, stored) {
  if (!incoming?.webhooks) return incoming;
  return {
    ...incoming,
    webhooks: Object.fromEntries(
      Object.entries(incoming.webhooks).map(([key, hook]) => [
        key,
        hook?.url === REDACTED
          ? { ...hook, url: stored?.webhooks?.[key]?.url || "" }
          : hook,
      ]),
    ),
  };
}

/** The listing entry for a department, safe for anyone who may see the directory. */
export function summarize(config) {
  return {
    id: config.id,
    name: config.branding.name,
    shortName: config.branding.shortName,
    tagline: config.branding.tagline,
    description: config.branding.description,
    accent: config.branding.accent,
    logoUrl: config.branding.logoUrl,
    pageCount: config.pages.length,
    recruitment: config.recruitment,
    guildId: config.guildId,
  };
}
