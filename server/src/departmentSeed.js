/**
 * The saved department sites.
 *
 * Each entry here is one complete site: branding, navigation, pages and roster
 * layout. The same engine renders all of them — pointing the hub at a different
 * id loads a different department, which is the whole idea. New departments are
 * created from the Builder Portal and persisted to `department_configs`; these
 * are the seeds the site ships with, and the fallback when no database is
 * configured. An exact copy of client/src/data/departmentConfigs.js — change
 * one and change the other.
 *
 * Membership deliberately does not appear below. Categories name the Discord
 * role keys from ROLE_MAP that belong in them, and the roster page projects the
 * community roster through that mapping — so the Discord bot that already keeps
 * the community roster current keeps every department site current too, with no
 * second sync to write.
 */
import { CONFIG_VERSION } from "./lib/departmentConfig.js";

/* ------------------------------------------------------------------ *
 * Shared page furniture
 * ------------------------------------------------------------------ */

const NAV_GROUPS = [
  { id: "main", label: "Main" },
  { id: "resources", label: "Resources" },
  { id: "admin", label: "Administration" },
];

/** The pages every department starts with, before its own content is added. */
function corePages({ heroKicker, heroTitle, heroSubtitle, blocks = [] }) {
  return [
    {
      id: "home",
      label: "Overview",
      navGroup: "main",
      icon: "Home",
      type: "home",
      locked: true,
      config: { heroKicker, heroTitle, heroSubtitle, blocks },
    },
    { id: "roster", label: "Roster", navGroup: "main", icon: "Users", type: "roster" },
    { id: "chain", label: "Chain of Command", navGroup: "main", icon: "Network", type: "chain" },
    { id: "fleet", label: "Fleet", navGroup: "resources", icon: "Car", type: "fleet", config: { vehicles: [] } },
    { id: "uniforms", label: "Uniforms", navGroup: "resources", icon: "Shirt", type: "uniforms", config: { kits: [] } },
    { id: "calendar", label: "Calendar", navGroup: "resources", icon: "Calendar", type: "calendar", config: { events: [] } },
    { id: "hours", label: "Duty Hours", navGroup: "resources", icon: "Clock", type: "hours" },
    { id: "activity", label: "Activity", navGroup: "admin", icon: "Activity", type: "activity" },
    { id: "adminlog", label: "Admin Log", navGroup: "admin", icon: "Gavel", type: "adminlog", config: { entries: [] } },
    { id: "audit", label: "Audit Log", navGroup: "admin", icon: "ScrollText", type: "audit" },
    { id: "access", label: "Access & Roles", navGroup: "admin", icon: "Shield", type: "access" },
    {
      id: "builder",
      label: "Builder Portal",
      navGroup: "admin",
      icon: "SlidersHorizontal",
      type: "builder",
      locked: true,
    },
  ];
}

/** The columns every department's roster shows, on top of rank and name. */
const MEMBER_FIELDS = [
  { id: "callsign", label: "Callsign", type: "text" },
  {
    id: "status",
    label: "Status",
    type: "select",
    options: ["Active", "Semi-Active", "LOA", "Inactive", "Suspended"],
    pill: true,
  },
  { id: "joinedAt", label: "Joined", type: "date" },
];

const STAT_ITEMS = [
  { id: "st-total", label: "Personnel", mode: "total" },
  { id: "st-active", label: "Active", mode: "status", statusValue: "Active" },
  { id: "st-loa", label: "On leave", mode: "status", statusValue: "LOA" },
  { id: "st-command", label: "Command", mode: "category", categoryId: "cat-command" },
];

/**
 * The access table a new department starts with. Directorship is not listed:
 * it reaches every department through the community-wide `departments.manage`
 * permission instead, which is what keeps a misconfigured department
 * recoverable without a database edit.
 */
function access(headRoleKey, headLabel, supervisorKeys) {
  return [
    { roleKey: headRoleKey, label: headLabel, level: 3, manage: true, editRoster: true, editStructure: true, manageCalendar: true, manageLog: true, manageAccess: true, viewAudit: true },
    ...supervisorKeys.map(({ key, label }) => ({
      roleKey: key,
      label,
      level: 2,
      manage: false,
      editRoster: true,
      editStructure: true,
      manageCalendar: true,
      manageLog: true,
      manageAccess: false,
      viewAudit: true,
    })),
  ];
}

/**
 * Assemble one department site. `categories` is the only part that really
 * differs between them: it decides which rank lands in which band on the roster
 * and, through that, the shape of the chain of command.
 */
function department({
  id,
  name,
  shortName,
  accent,
  tagline,
  description,
  hero,
  categories,
  grants,
  extraPages = [],
}) {
  return {
    version: CONFIG_VERSION,
    id,
    branding: { name, shortName, tagline, description, accent, logoUrl: "", bannerUrl: "" },
    navGroups: NAV_GROUPS,
    pages: [...corePages(hero), ...extraPages],
    roster: {
      layout: "tabs",
      source: "shared",
      memberFields: MEMBER_FIELDS,
      stats: { show: true, items: STAT_ITEMS },
      subdivisions: [
        {
          id: "sub-main",
          name: shortName,
          main: true,
          accent: "",
          roleKeys: [],
          banner: { title: `${name} Roster`, subtitle: "Personnel & Assignments" },
          categories,
        },
      ],
    },
    access: grants,
    webhooks: {},
  };
}

/** A content page of SOPs, used by the departments that ship with one. */
function sopPage(id, label, title, sections) {
  return {
    id,
    label,
    navGroup: "resources",
    icon: "BookOpen",
    type: "content",
    config: {
      heroTitle: title,
      heroSubtitle: "Standing orders for every member of the department.",
      blocks: sections.map((section, index) => ({
        id: `${id}-b${index}`,
        type: "text",
        title: section.title,
        body: section.body,
      })),
    },
  };
}

/* ------------------------------------------------------------------ *
 * The saved sites
 * ------------------------------------------------------------------ */

const FHP = department({
  id: "fhp",
  name: "Florida Highway Patrol",
  shortName: "FHP",
  accent: "#d2b48c",
  tagline: "Troop C — South Florida",
  description:
    "State troopers covering the interstates and state routes across the South Florida region — traffic enforcement, crash investigation and pursuit.",
  hero: {
    heroKicker: "Florida Highway Patrol",
    heroTitle: "Troop C Operations",
    heroSubtitle:
      "Everything a trooper needs on shift — the roster, the fleet, current SOPs and the training calendar.",
    blocks: [
      {
        id: "fhp-b0",
        type: "links",
        kicker: "Quick access",
        title: "On shift",
        columns: 4,
        items: [
          { id: "l1", label: "Roster", icon: "Users", page: "roster" },
          { id: "l2", label: "Fleet", icon: "Car", page: "fleet" },
          { id: "l3", label: "Pursuit SOP", icon: "BookOpen", page: "sop" },
          { id: "l4", label: "Calendar", icon: "Calendar", page: "calendar" },
        ],
      },
      {
        id: "fhp-b1",
        type: "callout",
        title: "Pursuit policy is under review",
        body: "Until command signs off on the revision, the standing policy applies: two units and air support, terminated at the supervisor's call.",
      },
    ],
  },
  categories: [
    { id: "cat-command", name: "Command", color: "#f59e0b", roleKeys: ["fhp_colonel", "fhp_captain"] },
    { id: "cat-supervisors", name: "Supervisors", color: "#3b82f6", roleKeys: ["fhp_lieutenant", "fhp_sergeant", "fhp_corporal"] },
    { id: "cat-troopers", name: "Troopers", color: "#22c55e", roleKeys: ["fhp_senior_trooper", "fhp_trooper"] },
  ],
  grants: access("fhp_colonel", "Colonel", [
    { key: "fhp_captain", label: "Captain" },
    { key: "fhp_lieutenant", label: "Lieutenant" },
  ]),
  extraPages: [
    sopPage("sop", "Patrol SOP", "Patrol Standard Operating Procedure", [
      {
        title: "Traffic stops",
        body: "Call the stop with your location, plate and occupant count before you approach. A second unit is required for any felony stop, and for any stop on the interstate after dark.",
      },
      {
        title: "Pursuits",
        body: "Any trooper may initiate. A supervisor must acknowledge within one minute or the pursuit is terminated. Maximum two units plus air; secondary units call the pursuit so the primary can drive.",
      },
      {
        title: "Crash investigation",
        body: "Scene safety first: block with the cruiser at an angle, arrow board on. Photograph before anything moves. A fatality escalates to a supervisor and a Homicide Investigation Unit callout.",
      },
    ]),
  ],
});

const BCSO = department({
  id: "bcso",
  name: "Broward County Sheriff's Office",
  shortName: "BCSO",
  accent: "green",
  tagline: "Serving Broward County",
  description:
    "The county's primary law enforcement agency — patrol, criminal investigation, court services and the county jail.",
  hero: {
    heroKicker: "Broward County Sheriff's Office",
    heroTitle: "Deputy Operations",
    heroSubtitle:
      "Roster, districts, fleet and the current general orders for every deputy on the road.",
    blocks: [
      {
        id: "bcso-b0",
        type: "links",
        kicker: "Quick access",
        title: "On shift",
        columns: 4,
        items: [
          { id: "l1", label: "Roster", icon: "Users", page: "roster" },
          { id: "l2", label: "Chain of Command", icon: "Network", page: "chain" },
          { id: "l3", label: "Fleet", icon: "Car", page: "fleet" },
          { id: "l4", label: "Duty Hours", icon: "Clock", page: "hours" },
        ],
      },
    ],
  },
  categories: [
    { id: "cat-command", name: "Command", color: "#f59e0b", roleKeys: ["bcso_sheriff", "bcso_major"] },
    { id: "cat-supervisors", name: "Supervisors", color: "#3b82f6", roleKeys: ["bcso_lieutenant", "bcso_sergeant", "bcso_corporal"] },
    { id: "cat-deputies", name: "Deputies", color: "#22c55e", roleKeys: ["bcso_master_deputy", "bcso_deputy"] },
  ],
  grants: access("bcso_sheriff", "Sheriff", [
    { key: "bcso_major", label: "Major" },
    { key: "bcso_lieutenant", label: "Lieutenant" },
  ]),
});

const MPD = department({
  id: "mpd",
  name: "Miami Police Department",
  shortName: "MPD",
  accent: "violet",
  tagline: "City of Miami",
  description:
    "City policing across downtown, Ybor and the waterfront — patrol districts, community response and criminal investigation.",
  hero: {
    heroKicker: "Miami Police Department",
    heroTitle: "City Operations",
    heroSubtitle: "District assignments, the fleet, uniform standards and the shift calendar.",
    blocks: [
      {
        id: "mpd-b0",
        type: "links",
        kicker: "Quick access",
        title: "On shift",
        columns: 4,
        items: [
          { id: "l1", label: "Roster", icon: "Users", page: "roster" },
          { id: "l2", label: "Uniforms", icon: "Shirt", page: "uniforms" },
          { id: "l3", label: "Fleet", icon: "Car", page: "fleet" },
          { id: "l4", label: "Calendar", icon: "Calendar", page: "calendar" },
        ],
      },
    ],
  },
  categories: [
    { id: "cat-command", name: "Command", color: "#f59e0b", roleKeys: ["mpd_chief", "mpd_captain"] },
    { id: "cat-supervisors", name: "Supervisors", color: "#3b82f6", roleKeys: ["mpd_lieutenant", "mpd_sergeant", "mpd_corporal"] },
    { id: "cat-officers", name: "Officers", color: "#22c55e", roleKeys: ["mpd_senior_officer", "mpd_officer"] },
  ],
  grants: access("mpd_chief", "Chief of Police", [
    { key: "mpd_captain", label: "Captain" },
    { key: "mpd_lieutenant", label: "Lieutenant" },
  ]),
});

export const DEPARTMENT_CONFIGS = { fhp: FHP, bcso: BCSO, mpd: MPD };

export const DEPARTMENT_IDS = Object.keys(DEPARTMENT_CONFIGS);

/* ------------------------------------------------------------------ *
 * Starter templates
 * ------------------------------------------------------------------ */

/**
 * What the Builder Portal offers when a new department is created. Each one is a
 * complete working site the department then edits — the reference implementation
 * called this "Start here", and it is the difference between a blank config and
 * something usable in a minute.
 */
export const STARTER_TEMPLATES = [
  {
    id: "law",
    label: "Law enforcement",
    detail: "Command / Supervisors / Officers, with a fleet, uniforms and a patrol SOP.",
    accent: "brand",
    categories: [
      { id: "cat-command", name: "Command", color: "#f59e0b", roleKeys: [] },
      { id: "cat-supervisors", name: "Supervisors", color: "#3b82f6", roleKeys: [] },
      { id: "cat-officers", name: "Officers", color: "#22c55e", roleKeys: [] },
    ],
  },
  {
    id: "fire",
    label: "Fire & EMS",
    detail: "Command / Company Officers / Firefighters, with apparatus and certifications.",
    accent: "rose",
    categories: [
      { id: "cat-command", name: "Command", color: "#f59e0b", roleKeys: [] },
      { id: "cat-supervisors", name: "Company Officers", color: "#3b82f6", roleKeys: [] },
      { id: "cat-firefighters", name: "Firefighters", color: "#22c55e", roleKeys: [] },
    ],
  },
  {
    id: "federal",
    label: "Federal agency",
    detail: "Command / Supervisors / Agents, with a tighter default on who may read what.",
    accent: "amber",
    categories: [
      { id: "cat-command", name: "Command", color: "#f59e0b", roleKeys: [] },
      { id: "cat-supervisors", name: "Supervisors", color: "#3b82f6", roleKeys: [] },
      { id: "cat-agents", name: "Agents", color: "#22c55e", roleKeys: [] },
    ],
  },
  {
    id: "blank",
    label: "Blank",
    detail: "One overview page and an empty roster. Build it up yourself.",
    accent: "slate",
    categories: [{ id: "cat-members", name: "Members", color: "#22c55e", roleKeys: [] }],
  },
];

/**
 * A new, empty department site from one of the templates above. The Builder
 * saves the result; nothing here touches the seeds.
 */
export function configFromTemplate(templateId, { id, name, shortName, headRoleKey }) {
  const template =
    STARTER_TEMPLATES.find((t) => t.id === templateId) ?? STARTER_TEMPLATES.at(-1);
  return department({
    id,
    name,
    shortName: shortName || name,
    accent: template.accent,
    tagline: "Internal Operations",
    description: "",
    hero: {
      heroKicker: name,
      heroTitle: `${shortName || name} Operations`,
      heroSubtitle: "",
      blocks: [],
    },
    categories: template.categories,
    grants: headRoleKey
      ? [
          {
            roleKey: headRoleKey,
            label: "Department head",
            level: 3,
            manage: true,
            editRoster: true,
            editStructure: true,
            manageCalendar: true,
            manageLog: true,
            manageAccess: true,
            viewAudit: true,
          },
        ]
      : [],
  });
}
