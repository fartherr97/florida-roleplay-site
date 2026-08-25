/**
 * Seed data mirroring client/src/data/mockData.js so the API serves realistic
 * responses before Postgres is populated. Every route falls back to these shapes
 * when a query fails, which keeps the whole site working end-to-end with no
 * database running.
 *
 * NOTE: the ROLES list below is intentionally duplicated in
 * client/src/data/mockData.js. The route middleware and the client's route guard
 * must agree on role names, so if you add a role here, add it there too.
 */

export const ROLES = {
  MEMBER: "member",
  WHITELISTED: "whitelisted",
  CERT_CIV_1: "cert_civ_1",
  CERT_CIV_2: "cert_civ_2",
  CERT_CIV_3: "cert_civ_3",
  TRIAL_MOD: "trial_mod",
  MOD: "mod",
  SENIOR_MOD: "senior_mod",
  JUNIOR_ADMIN: "junior_admin",
  ADMIN: "admin",
  SENIOR_ADMIN: "senior_admin",
  HEAD_ADMIN: "head_admin",
  DIRECTORSHIP: "directorship",
  OWNERSHIP: "ownership",
  DEPT_HEAD: "department_head",
};

/** Role bundles the hub gates on, mirrored in client/src/data/hubNavigation.js. */
export const STAFF_ANY = [
  ROLES.TRIAL_MOD, ROLES.MOD, ROLES.SENIOR_MOD, ROLES.JUNIOR_ADMIN,
  ROLES.ADMIN, ROLES.SENIOR_ADMIN, ROLES.HEAD_ADMIN, ROLES.DIRECTORSHIP,
  ROLES.OWNERSHIP,
];
export const ADMIN_PLUS = [
  ROLES.JUNIOR_ADMIN, ROLES.ADMIN, ROLES.SENIOR_ADMIN, ROLES.HEAD_ADMIN,
];
export const SENIOR_ADMIN_PLUS = [ROLES.SENIOR_ADMIN, ROLES.HEAD_ADMIN];
export const HEAD_ADMIN_ONLY = [ROLES.HEAD_ADMIN];

/** Any signed-in community member; staff hold these implicitly. */
export const MEMBER_ANY = [
  ROLES.MEMBER, ROLES.WHITELISTED, ROLES.CERT_CIV_1, ROLES.CERT_CIV_2,
  ROLES.CERT_CIV_3, ...STAFF_ANY,
];

/** Personal civilian records only exist for a whitelisted character. */
export const WHITELISTED_ANY = [
  ROLES.WHITELISTED, ROLES.CERT_CIV_1, ROLES.CERT_CIV_2, ROLES.CERT_CIV_3,
  ...STAFF_ANY,
];

/** Civilian floor every staff rank also carries. */
const CIV_BASE = [ROLES.MEMBER, ROLES.WHITELISTED, ROLES.CERT_CIV_1];

/**
 * Every rank the preview switcher offers and the roles each grants, mirroring
 * PREVIEW_RANKS in client/src/data/mockData.js. Used only by the development
 * preview path in middleware/requireRole.js, which is hard-disabled in
 * production.
 */
export const STAFF_RANKS = {
  member: [ROLES.MEMBER],
  cert_civ_1: [ROLES.MEMBER, ROLES.WHITELISTED, ROLES.CERT_CIV_1],
  cert_civ_2: [ROLES.MEMBER, ROLES.WHITELISTED, ROLES.CERT_CIV_1, ROLES.CERT_CIV_2],
  cert_civ_3: [
    ROLES.MEMBER, ROLES.WHITELISTED, ROLES.CERT_CIV_1, ROLES.CERT_CIV_2,
    ROLES.CERT_CIV_3,
  ],
  trial_mod: [...CIV_BASE, ROLES.TRIAL_MOD],
  mod: [...CIV_BASE, ROLES.TRIAL_MOD, ROLES.MOD],
  senior_mod: [...CIV_BASE, ROLES.TRIAL_MOD, ROLES.MOD, ROLES.SENIOR_MOD],
  junior_admin: [
    ...CIV_BASE, ROLES.TRIAL_MOD, ROLES.MOD, ROLES.SENIOR_MOD,
    ROLES.JUNIOR_ADMIN,
  ],
  admin: [
    ...CIV_BASE, ROLES.TRIAL_MOD, ROLES.MOD, ROLES.SENIOR_MOD,
    ROLES.JUNIOR_ADMIN, ROLES.ADMIN,
  ],
  senior_admin: [
    ...CIV_BASE, ROLES.TRIAL_MOD, ROLES.MOD, ROLES.SENIOR_MOD,
    ROLES.JUNIOR_ADMIN, ROLES.ADMIN, ROLES.SENIOR_ADMIN,
  ],
  head_admin: [
    ...CIV_BASE, ROLES.TRIAL_MOD, ROLES.MOD, ROLES.SENIOR_MOD,
    ROLES.JUNIOR_ADMIN, ROLES.ADMIN, ROLES.SENIOR_ADMIN, ROLES.HEAD_ADMIN,
  ],
  directorship: [
    ...CIV_BASE, ROLES.TRIAL_MOD, ROLES.MOD, ROLES.SENIOR_MOD,
    ROLES.JUNIOR_ADMIN, ROLES.ADMIN, ROLES.SENIOR_ADMIN, ROLES.HEAD_ADMIN,
    ROLES.DIRECTORSHIP,
  ],
  ownership: [
    ...CIV_BASE, ROLES.TRIAL_MOD, ROLES.MOD, ROLES.SENIOR_MOD,
    ROLES.JUNIOR_ADMIN, ROLES.ADMIN, ROLES.SENIOR_ADMIN, ROLES.HEAD_ADMIN,
    ROLES.DIRECTORSHIP, ROLES.OWNERSHIP,
  ],
};

export const RANK_LABELS = {
  member: "Member",
  cert_civ_1: "Cert. Civ. I",
  cert_civ_2: "Cert. Civ. II",
  cert_civ_3: "Cert. Civ. III",
  trial_mod: "Trial Mod",
  mod: "Mod",
  senior_mod: "Sr. Mod",
  junior_admin: "Jr. Admin",
  admin: "Admin",
  senior_admin: "Sr. Admin",
  head_admin: "Head Admin",
  directorship: "Directorship",
  ownership: "Ownership",
};

/** Every role the middleware will accept, for validation at the edges. */
export const ALL_ROLES = Object.values(ROLES);

/** Development caller resolved from DEV_USER_ID until Discord OAuth is wired. */
export const devUser = {
  id: "198273645500000000",
  username: "sunshine.dev",
  displayName: "Sunshine Dev",
  avatar: null,
  rank: "Ownership",
  roles: [
    ROLES.MEMBER, ROLES.WHITELISTED, ROLES.CERT_CIV_1, ROLES.TRIAL_MOD,
    ROLES.MOD, ROLES.SENIOR_MOD, ROLES.JUNIOR_ADMIN, ROLES.ADMIN,
    ROLES.SENIOR_ADMIN, ROLES.HEAD_ADMIN, ROLES.DIRECTORSHIP, ROLES.OWNERSHIP,
  ],
};

/**
 * The moderation queue, so the staff-side reports page renders before anybody
 * has filed one. Three states, because a queue of three pending reports shows
 * none of what the page does.
 */
export const reportQueue = [];

export const serverStatus = {
  online: false,
  players: 0,
  maxPlayers: 0,
  queue: 0,
  uptime: null,
  address: null,
};

export const departments = [
  {
    id: "fhp",
    name: "Florida Highway Patrol",
    abbr: "FHP",
    tone: "brand",
    icon: "Car",
    tagline: "Interstate enforcement and traffic homicide investigation.",
    mission:
      "The Florida Highway Patrol secures the state's interstates and highways, running traffic enforcement, crash reconstruction and high-speed pursuit operations across every county on the map.",
    roster: 42,
    hiring: true,
    ranks: ["Trooper", "Senior Trooper", "Corporal", "Sergeant", "Lieutenant", "Captain", "Colonel"],
    fleet: [
      "2023 Dodge Charger Pursuit",
      "2022 Ford Explorer PI",
      "2021 Chevrolet Tahoe PPV",
      "Unmarked Mustang GT",
    ],
    applicationType: "fhp",
  },
  {
    id: "hcso",
    name: "Hillsborough County Sheriff's Office",
    abbr: "HCSO",
    tone: "green",
    icon: "Shield",
    tagline: "County patrol, K9, marine and aviation units.",
    mission:
      "HCSO covers unincorporated Hillsborough County with a full patrol division, a K9 detail, marine patrol on the bay and an aviation unit supporting county-wide operations.",
    roster: 56,
    hiring: true,
    ranks: ["Deputy", "Master Deputy", "Corporal", "Sergeant", "Lieutenant", "Major", "Sheriff"],
    fleet: [
      "2023 Ford F-150 Police Responder",
      "2022 Dodge Durango Pursuit",
      "Marine Patrol Boat",
      "Air-1 Helicopter",
    ],
    applicationType: "hcso",
  },
  {
    id: "tpd",
    name: "Tampa Police Department",
    abbr: "TPD",
    tone: "brand",
    icon: "Building2",
    tagline: "City policing, SWAT and community response.",
    mission:
      "TPD handles calls for service inside Tampa city limits — patrol, criminal investigations, a tactical response team and a community outreach division working the downtown core.",
    roster: 61,
    hiring: true,
    ranks: ["Officer", "Senior Officer", "Corporal", "Sergeant", "Lieutenant", "Captain", "Chief of Police"],
    fleet: [
      "2023 Chevrolet Tahoe PPV",
      "2022 Dodge Charger",
      "SWAT Bearcat",
      "Prisoner Transport Van",
    ],
    applicationType: "tpd",
  },
  {
    id: "hcfr",
    name: "Hillsborough County Fire Rescue",
    abbr: "HCFR",
    tone: "rose",
    icon: "Flame",
    tagline: "Fire suppression, rescue and advanced life support.",
    mission:
      "HCFR runs engine, ladder and rescue companies county-wide, providing fire suppression, technical rescue, hazmat response and ALS transport to every district.",
    roster: 38,
    hiring: true,
    ranks: [
      "Probationary Firefighter",
      "Firefighter",
      "Firefighter/Paramedic",
      "Driver Engineer",
      "Lieutenant",
      "Battalion Chief",
      "Fire Chief",
    ],
    fleet: [
      "Engine 12 — Pierce Enforcer",
      "Ladder 7 — Aerial Platform",
      "Rescue 3 — ALS Transport",
      "Battalion 1 Command Unit",
    ],
    applicationType: "hcfr",
  },
];

export const rules = [];

export const applicationTypes = [];

export const staff = [];

export const patchNotes = [];

export const storeTiers = [];

export const supporters = [];

export const events = [];

export const knowledgeBase = [];

/** Canned assistant replies, keyed by the topic a message mentions. */
export const assistantReplies = [
  {
    match: ["rule", "rdm", "vdm", "metagam", "powergam", "new life"],
    reply:
      "The full rulebook lives on the rules page, and it's searchable. The three people ask about most are 2.2 (no RDM — violence needs build-up and motive), 2.4 (no metagaming — Discord and stream info never reaches your character) and 2.6 (New Life Rule — after you respawn you forget the scene that killed you).",
  },
  {
    match: ["whitelist", "apply", "application", "join"],
    reply:
      "Start with the community whitelist application — everything else needs an approved whitelist behind it. Reviews take 24 to 48 hours and the outcome arrives as a Discord DM. Read the rules first; the interview references them directly.",
  },
  {
    match: ["department", "police", "fhp", "hcso", "tpd", "fire", "hcfr"],
    reply:
      "We run four agencies: FHP, HCSO, TPD and HCFR. Each department page lists its rank structure, fleet and a direct link to its application.",
  },
  {
    match: ["crash", "fps", "lag", "performance", "connect"],
    reply:
      "Nine times out of ten a crash is fixed by clearing the FiveM cache and disabling any graphics mods. If it survives both, open a support ticket with your CitizenFX crash log — there's a full guide in the knowledge base.",
  },
  {
    match: ["store", "donate", "supporter", "perk", "tier"],
    reply:
      "Supporter tiers are Bronze, Silver and Gold, and everything they unlock is quality-of-life — queue priority, character slots and cosmetics. Nothing in the store affects in-character balance. Checkout is handled by Tebex.",
  },
];

export const assistantFallback =
  "I'm not sure about that one — try the rules page or the knowledge base, and if neither covers it a staff member will pick it up in a Discord ticket.";
