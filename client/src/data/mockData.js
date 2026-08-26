/**
 * Mock content for the whole site. Every read goes through src/lib/api.js, which
 * falls back to these shapes whenever the API is unavailable — so the UI renders
 * fully before (and without) a database.
 *
 * NOTE: the ROLES list below is intentionally duplicated in server/src/seed.js.
 * The client guard and the server middleware must agree on role names, so if you
 * add a role here, add it there too.
 */

/* ------------------------------------------------------------------ *
 * Placeholders — swap these in one place when the real assets land.
 * ------------------------------------------------------------------ */

export const SITE = {
  name: "Florida Roleplay",
  shortName: "FLRP",
  // The community's own domain. Everything that has to live beside the site —
  // the bot API, a department's own hostname — is a subdomain of this, because
  // session cookies are SameSite=Lax and the browser silently drops them
  // anywhere else. See "The API has to be on a subdomain" in the README.
  domain: "flrp.us",
  url: "https://flrp.us",
  // The community emblem, in client/public. Square-cropped and sized down from
  // the 1024px original so a 32px nav mark does not pull a 1.75 MB file.
  logoUrl: "/logo.png",
  // TODO: replace with a real in-game screenshot of the server.
  //       Royalty-free Florida coastline placeholder (Unsplash, free licence).
  heroImage:
    "https://images.unsplash.com/photo-1535498730771-e735b998cd64?auto=format&fit=crop&w=2400&q=70",
  // TODO: replace with the live FiveM connect endpoint.
  fivemConnect: "fivem://connect/play.flrp.us",
  serverAddress: "play.flrp.us",
  // TODO: replace with the real Discord invite.
  discordInvite: "https://discord.gg/4dBa5TCGRC",
  // Applications, forms and CAD are handled by Sonoran now, not by this site.
  // TODO: replace with the community's real Sonoran apply/forms URL. Every
  // "Apply" affordance points here, so it only needs setting in one place.
  applyUrl: "https://flrp.sonoransoftware.com",
  // TODO: replace with the real Tebex store URL.
  storeUrl: "https://florida-roleplay.tebex.io",
  // TODO: name the AI assistant.
  assistantName: "Sunny",
  // TODO: replace with the real social handles.
  socials: {
    discord: "https://discord.gg/4dBa5TCGRC",
    tiktok: "https://www.tiktok.com/@floridaroleplay",
    x: "https://x.com/floridaroleplay",
    youtube: "https://www.youtube.com/@floridaroleplay",
  },
};

/* ------------------------------------------------------------------ *
 * Roles — mirrored in server/src/seed.js (see note above).
 * ------------------------------------------------------------------ */

export const ROLES = {
  MEMBER: "member",
  WHITELISTED: "whitelisted",
  // Civilian certification tiers
  CERT_CIV_1: "cert_civ_1",
  CERT_CIV_2: "cert_civ_2",
  CERT_CIV_3: "cert_civ_3",
  // Staff ladder, lowest to highest
  TRIAL_MOD: "trial_mod",
  MOD: "mod",
  SENIOR_MOD: "senior_mod",
  JUNIOR_ADMIN: "junior_admin",
  ADMIN: "admin",
  SENIOR_ADMIN: "senior_admin",
  HEAD_ADMIN: "head_admin",
  // Above the staff ladder: community direction, then the people who own it.
  DIRECTORSHIP: "directorship",
  OWNERSHIP: "ownership",
  // Department command, orthogonal to the staff ladder
  DEPT_HEAD: "department_head",
};

export const ROLE_LABELS = {
  member: "Member",
  whitelisted: "Whitelisted",
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
  department_head: "Department Head",
};

/**
 * Civilian standing, below the staff ladder. Everyone who signs in with Discord
 * is a member; whitelisting is what creates a character and therefore the
 * personal records the Civilian Hub shows.
 */
export const CIVILIAN_RANKS = [
  { id: "member", label: "Member", tone: "slate", roles: [ROLES.MEMBER] },
  {
    id: "cert_civ_1",
    label: "Cert. Civ. I",
    tone: "green",
    roles: [ROLES.MEMBER, ROLES.WHITELISTED, ROLES.CERT_CIV_1],
  },
  {
    id: "cert_civ_2",
    label: "Cert. Civ. II",
    tone: "green",
    roles: [ROLES.MEMBER, ROLES.WHITELISTED, ROLES.CERT_CIV_1, ROLES.CERT_CIV_2],
  },
  {
    id: "cert_civ_3",
    label: "Cert. Civ. III",
    tone: "green",
    roles: [
      ROLES.MEMBER, ROLES.WHITELISTED, ROLES.CERT_CIV_1, ROLES.CERT_CIV_2,
      ROLES.CERT_CIV_3,
    ],
  },
];

const CIV_BASE = [ROLES.MEMBER, ROLES.WHITELISTED, ROLES.CERT_CIV_1];

const STAFF_LADDER = [
  { id: "trial_mod", label: "Trial Mod", role: ROLES.TRIAL_MOD, tone: "slate" },
  { id: "mod", label: "Mod", role: ROLES.MOD, tone: "brand" },
  { id: "senior_mod", label: "Sr. Mod", role: ROLES.SENIOR_MOD, tone: "green" },
  { id: "junior_admin", label: "Jr. Admin", role: ROLES.JUNIOR_ADMIN, tone: "primary" },
  { id: "admin", label: "Admin", role: ROLES.ADMIN, tone: "primary" },
  { id: "senior_admin", label: "Sr. Admin", role: ROLES.SENIOR_ADMIN, tone: "amber" },
  { id: "head_admin", label: "Head Admin", role: ROLES.HEAD_ADMIN, tone: "rose" },
  { id: "directorship", label: "Directorship", role: ROLES.DIRECTORSHIP, tone: "rose" },
  { id: "ownership", label: "Ownership", role: ROLES.OWNERSHIP, tone: "amber" },
];

/**
 * Staff ranks in ascending order. Each rank carries every role below it, so
 * previewing a rank behaves exactly like holding those Discord roles and a
 * promotion never needs the previous role removed first.
 */
export const STAFF_RANKS = STAFF_LADDER.map((rank, index) => ({
  id: rank.id,
  label: rank.label,
  tone: rank.tone,
  roles: [...CIV_BASE, ...STAFF_LADDER.slice(0, index + 1).map((r) => r.role)],
}));

/**
 * Every rank the preview switcher offers, civilian standing first. Keeping both
 * ladders in one list is what lets a visitor preview the Civilian Hub as a plain
 * member rather than only as staff.
 */
export const PREVIEW_RANKS = [...CIVILIAN_RANKS, ...STAFF_RANKS];

/** Mock signed-in user. Set to null to preview the signed-out experience. */

/* ------------------------------------------------------------------ *
 * Live-ish server state
 * ------------------------------------------------------------------ */

/** Mirrors reportQueue in server/src/seed.js — the staff-side moderation list. */
export const reportQueue = [];

export const serverStatus = {
  online: false,
  players: 0,
  maxPlayers: 0,
  queue: 0,
  uptime: null,
  address: null,
};

/* ------------------------------------------------------------------ *
 * Departments
 * ------------------------------------------------------------------ */

export const departments = [
  {
    id: "fhp",
    name: "Florida Highway Patrol",
    abbr: "FHP",
    tone: "amber",
    icon: "Car",
    tagline: "Interstate enforcement and traffic homicide investigation.",
    mission:
      "The Florida Highway Patrol secures the state's interstates and highways, running traffic enforcement, crash reconstruction and high-speed pursuit operations across every county on the map.",
    roster: 42,
    hiring: true,
    ranks: [
      "Trooper",
      "Senior Trooper",
      "Corporal",
      "Sergeant",
      "Lieutenant",
      "Captain",
      "Colonel",
    ],
    fleet: [
      "2023 Dodge Charger Pursuit",
      "2022 Ford Explorer PI",
      "2021 Chevrolet Tahoe PPV",
      "Unmarked Mustang GT",
    ],
    applicationType: "fhp",
  },
  {
    id: "bcso",
    name: "Broward County Sheriff's Office",
    abbr: "BCSO",
    tone: "green",
    icon: "Shield",
    tagline: "County patrol, K9, marine and aviation units.",
    mission:
      "BCSO covers unincorporated Broward County with a full patrol division, a K9 detail, marine patrol on the bay and an aviation unit supporting county-wide operations.",
    roster: 56,
    hiring: true,
    ranks: [
      "Deputy",
      "Master Deputy",
      "Corporal",
      "Sergeant",
      "Lieutenant",
      "Major",
      "Sheriff",
    ],
    fleet: [
      "2023 Ford F-150 Police Responder",
      "2022 Dodge Durango Pursuit",
      "Marine Patrol Boat",
      "Air-1 Helicopter",
    ],
    applicationType: "bcso",
  },
  {
    id: "mpd",
    name: "Miami Police Department",
    abbr: "MPD",
    tone: "brand",
    icon: "Building2",
    tagline: "City policing, SWAT and community response.",
    mission:
      "MPD handles calls for service inside Miami city limits — patrol, criminal investigations, a tactical response team and a community outreach division working the downtown core.",
    roster: 61,
    hiring: true,
    ranks: [
      "Officer",
      "Senior Officer",
      "Corporal",
      "Sergeant",
      "Lieutenant",
      "Captain",
      "Chief of Police",
    ],
    fleet: [
      "2023 Chevrolet Tahoe PPV",
      "2022 Dodge Charger",
      "SWAT Bearcat",
      "Prisoner Transport Van",
    ],
    applicationType: "mpd",
  },
];

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

export const rules = [];

/* ------------------------------------------------------------------ *
 * Applications
 * ------------------------------------------------------------------ */

export const applicationTypes = [];

/* ------------------------------------------------------------------ *
 * Staff roster
 * ------------------------------------------------------------------ */

export const staff = [];

/* ------------------------------------------------------------------ *
 * Patch notes
 * ------------------------------------------------------------------ */

export const patchNotes = [];

/* ------------------------------------------------------------------ *
 * Store & supporters
 * ------------------------------------------------------------------ */

export const storeTiers = [];


/* ------------------------------------------------------------------ *
 * Events
 * ------------------------------------------------------------------ */

export const events = [];

/* ------------------------------------------------------------------ *
 * Knowledge base
 * ------------------------------------------------------------------ */

export const knowledgeBase = [];

/* ------------------------------------------------------------------ *
 * Report categories
 * ------------------------------------------------------------------ */

export const reportTypes = [
  { value: "player", label: "Player report — rule break" },
  { value: "staff", label: "Staff complaint" },
  { value: "ban-appeal", label: "Ban appeal" },
  { value: "bug", label: "Bug or exploit report" },
  { value: "other", label: "Something else" },
];

/* ------------------------------------------------------------------ *
 * Landing page copy
 * ------------------------------------------------------------------ */

export const features = [
  {
    id: "scripts",
    icon: "Wrench",
    title: "Custom Scripts",
    body: "A purpose-built framework — MDT, dispatch, evidence, business ownership and an economy written for this server, not bought off a shelf.",
  },
  {
    id: "serious-rp",
    icon: "ScrollText",
    title: "Serious Roleplay",
    body: "Whitelisted, voice-only and consistently enforced. Scenes have stakes because everyone is held to the same standard.",
  },
  {
    id: "staff",
    icon: "LifeBuoy",
    title: "Active Staff",
    body: "Tickets answered in minutes, not days. Our staff team is on the server every night, in character and on call.",
  },
];

export const heroCopy = {
  headline: "Welcome to",
  brand: "Florida Roleplay",
  subtitle:
    "A whitelisted FiveM community built around serious, character-driven roleplay on Florida's South Florida — custom scripts, four emergency services and a story that keeps running when you log off.",
  tagline: "Serious RP · Custom Framework · Active Every Night",
};
