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
  // TODO: replace with the real hosted logo URL.
  logoUrl: "/favicon.svg",
  // TODO: replace with a real in-game screenshot of the server.
  //       Royalty-free Florida coastline placeholder (Unsplash, free licence).
  heroImage:
    "https://images.unsplash.com/photo-1535498730771-e735b998cd64?auto=format&fit=crop&w=2400&q=70",
  // TODO: replace with the live FiveM connect endpoint.
  fivemConnect: "fivem://connect/flrp.example.net",
  serverAddress: "connect.floridaroleplay.example",
  // TODO: replace with the real Discord invite.
  discordInvite: "https://discord.gg/your-invite-here",
  // TODO: replace with the real Tebex store URL.
  storeUrl: "https://florida-roleplay.tebex.io",
  // TODO: name the AI assistant.
  assistantName: "Sunny",
  // TODO: replace with the real social handles.
  socials: {
    discord: "https://discord.gg/your-invite-here",
    tiktok: "https://www.tiktok.com/@floridaroleplay",
    x: "https://x.com/floridaroleplay",
    youtube: "https://www.youtube.com/@floridaroleplay",
  },
  supportEmail: "support@floridaroleplay.example",
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
export const mockUser = {
  id: "198273645500000000",
  username: "sunshine.dev",
  displayName: "Sunshine Dev",
  avatar: null,
  rank: "Sr. Mod",
  roles: [
    "member", "whitelisted", "cert_civ_1", "trial_mod", "mod", "senior_mod",
  ],
};

/* ------------------------------------------------------------------ *
 * Live-ish server state
 * ------------------------------------------------------------------ */

export const serverStatus = {
  online: true,
  players: 118,
  maxPlayers: 128,
  queue: 7,
  uptime: "6d 14h",
  address: SITE.serverAddress,
};

/* ------------------------------------------------------------------ *
 * Departments
 * ------------------------------------------------------------------ */

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
  {
    id: "dhs",
    name: "Department of Homeland Security",
    abbr: "DHS",
    tone: "amber",
    icon: "Siren",
    tagline: "Federal task force, port security and investigations.",
    mission:
      "DHS oversees federal enforcement in the state — port and airport security, multi-agency task force operations and long-form criminal investigations that cross county lines.",
    roster: 19,
    hiring: false,
    ranks: [
      "Special Agent",
      "Senior Special Agent",
      "Supervisory Agent",
      "Assistant Director",
      "Director",
    ],
    fleet: [
      "Unmarked Tahoe",
      "Federal Transport Van",
      "Port Authority Interceptor",
    ],
    applicationType: "dhs",
  },
];

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

export const rules = [
  {
    id: "general",
    category: "General Conduct",
    description: "The baseline expectations for everyone on the server.",
    items: [
      {
        id: "g-1",
        number: "1.1",
        title: "Respect every player",
        body: "Harassment, hate speech, discrimination and targeted abuse are never in character and never permitted. Take heated disputes to a staff ticket, not to chat.",
      },
      {
        id: "g-2",
        number: "1.2",
        title: "No cheating or exploiting",
        body: "Any modification that grants an unfair advantage results in a permanent ban. If you find a bug that can be exploited, report it instead of using it.",
      },
      {
        id: "g-3",
        number: "1.3",
        title: "One character per session",
        body: "Do not swap characters to escape an active roleplay scene, a pursuit, or the consequences of your actions.",
      },
      {
        id: "g-4",
        number: "1.4",
        title: "Staff decisions are final in the moment",
        body: "You may appeal any decision afterwards through the reports page. Arguing with staff mid-scene disrupts everyone else's roleplay.",
      },
    ],
  },
  {
    id: "roleplay",
    category: "Roleplay Standards",
    description: "How we keep scenes serious, believable and fair.",
    items: [
      {
        id: "rp-1",
        number: "2.1",
        title: "Value your life",
        body: "Your character fears death and injury. Comply when a weapon is pointed at you and behave as a reasonable person would under threat.",
      },
      {
        id: "rp-2",
        number: "2.2",
        title: "No random deathmatch (RDM)",
        body: "Violence requires roleplay build-up and a motive. Shooting a player without prior interaction is an instant removal from the session.",
      },
      {
        id: "rp-3",
        number: "2.3",
        title: "No vehicle deathmatch (VDM)",
        body: "Vehicles are not weapons. Using a car to kill or grief players is treated the same as RDM.",
      },
      {
        id: "rp-4",
        number: "2.4",
        title: "No metagaming",
        body: "Information from Discord, streams or out-of-character chat must never reach your character's decisions.",
      },
      {
        id: "rp-5",
        number: "2.5",
        title: "No powergaming",
        body: "You cannot force an outcome on another player, invent abilities your character does not have, or ignore realistic injury.",
      },
      {
        id: "rp-6",
        number: "2.6",
        title: "New Life Rule",
        body: "When your character is downed and respawns, they forget the events leading to their death and may not return to that scene.",
      },
    ],
  },
  {
    id: "criminal",
    category: "Criminal Roleplay",
    description: "Limits that keep crime scenes tense rather than chaotic.",
    items: [
      {
        id: "c-1",
        number: "3.1",
        title: "Group size limits",
        body: "A maximum of six players may participate in any single criminal act, including lookouts and getaway drivers.",
      },
      {
        id: "c-2",
        number: "3.2",
        title: "Hostage taking",
        body: "Hostages must be real players who consent to the scene out of character. NPC hostages do not satisfy this requirement.",
      },
      {
        id: "c-3",
        number: "3.3",
        title: "Cop baiting",
        body: "Do not deliberately provoke police without a roleplay reason. Crime needs motive, planning and consequence.",
      },
      {
        id: "c-4",
        number: "3.4",
        title: "Green zones",
        body: "Hospitals, police stations, the DMV and all spawn areas are permanent no-crime zones.",
      },
    ],
  },
  {
    id: "emergency",
    category: "Emergency Services",
    description: "Additional standards for whitelisted department members.",
    items: [
      {
        id: "e-1",
        number: "4.1",
        title: "Stay in your lane",
        body: "Only respond to calls your department and rank cover. Do not self-dispatch across agency boundaries.",
      },
      {
        id: "e-2",
        number: "4.2",
        title: "Use proper radio procedure",
        body: "Clear, concise radio traffic with correct call signs. Radio is a shared resource — keep it usable.",
      },
      {
        id: "e-3",
        number: "4.3",
        title: "Pursuit policy",
        body: "Pursuits require supervisor approval past five minutes. Terminate when the risk to the public outweighs the offence.",
      },
    ],
  },
  {
    id: "voice",
    category: "Voice & Streaming",
    description: "Expectations around comms and broadcasting.",
    items: [
      {
        id: "v-1",
        number: "5.1",
        title: "Working microphone required",
        body: "All roleplay happens in voice. Text chat is for out-of-character staff communication only.",
      },
      {
        id: "v-2",
        number: "5.2",
        title: "Streaming is welcome",
        body: "Stream freely, but never use your chat as a source of in-character information — that is metagaming.",
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Applications
 * ------------------------------------------------------------------ */

export const applicationTypes = [
  {
    type: "whitelist",
    name: "Community Whitelist",
    blurb:
      "The application every new member starts with. Approval grants access to the main server.",
    status: "Open",
    estimate: "24–48 hours",
    icon: "ScrollText",
    tone: "primary",
  },
  {
    type: "fhp",
    name: "Florida Highway Patrol",
    blurb: "Interstate enforcement, crash investigation and pursuit operations.",
    status: "Open",
    estimate: "3–5 days",
    icon: "Car",
    tone: "brand",
  },
  {
    type: "hcso",
    name: "Hillsborough County Sheriff's Office",
    blurb: "County patrol, K9, marine and aviation divisions.",
    status: "Open",
    estimate: "3–5 days",
    icon: "Shield",
    tone: "green",
  },
  {
    type: "tpd",
    name: "Tampa Police Department",
    blurb: "City patrol, investigations and tactical response.",
    status: "Open",
    estimate: "3–5 days",
    icon: "Building2",
    tone: "brand",
  },
  {
    type: "hcfr",
    name: "Hillsborough County Fire Rescue",
    blurb: "Fire suppression, technical rescue and advanced life support.",
    status: "Open",
    estimate: "3–5 days",
    icon: "Flame",
    tone: "rose",
  },
  {
    type: "dhs",
    name: "Department of Homeland Security",
    blurb: "Federal task force work. Opens periodically by invitation.",
    status: "Closed",
    estimate: "—",
    icon: "Siren",
    tone: "amber",
  },
  {
    type: "staff",
    name: "Staff Team",
    blurb: "Moderation, ticket handling and community support.",
    status: "Open",
    estimate: "7–10 days",
    icon: "Wrench",
    tone: "primary",
  },
];

/* ------------------------------------------------------------------ *
 * Staff roster
 * ------------------------------------------------------------------ */

export const staff = [
  {
    id: "s-1",
    name: "Marcus Reyes",
    handle: "reyes",
    role: "Head Admin",
    group: "Management",
    department: "Management",
    tone: "rose",
    online: true,
  },
  {
    id: "s-2",
    name: "Dana Whitfield",
    handle: "dwhitfield",
    role: "Head Admin",
    group: "Management",
    department: "Management",
    tone: "rose",
    online: true,
  },
  {
    id: "s-3",
    name: "Priya Raman",
    handle: "praman",
    role: "Head Admin",
    group: "Management",
    department: "Development",
    tone: "rose",
    online: false,
  },
  {
    id: "s-4",
    name: "Alex Duarte",
    handle: "aduarte",
    role: "Sr. Admin",
    group: "Staff",
    department: "Staff Team",
    tone: "primary",
    online: true,
  },
  {
    id: "s-5",
    name: "Jamie Okonkwo",
    handle: "jokonkwo",
    role: "Sr. Mod",
    group: "Staff",
    department: "Staff Team",
    tone: "primary",
    online: true,
  },
  {
    id: "s-6",
    name: "Sam Bennett",
    handle: "sbennett",
    role: "Admin",
    group: "Staff",
    department: "Support",
    tone: "primary",
    online: false,
  },
  {
    id: "s-7",
    name: "Colonel R. Vance",
    handle: "rvance",
    role: "FHP Colonel",
    group: "Emergency Services",
    department: "FHP",
    tone: "brand",
    online: true,
  },
  {
    id: "s-8",
    name: "Sheriff L. Moreau",
    handle: "lmoreau",
    role: "HCSO Sheriff",
    group: "Emergency Services",
    department: "HCSO",
    tone: "green",
    online: false,
  },
  {
    id: "s-9",
    name: "Chief T. Alvarez",
    handle: "talvarez",
    role: "TPD Chief of Police",
    group: "Emergency Services",
    department: "TPD",
    tone: "brand",
    online: true,
  },
  {
    id: "s-10",
    name: "Chief M. Doyle",
    handle: "mdoyle",
    role: "HCFR Fire Chief",
    group: "Emergency Services",
    department: "HCFR",
    tone: "rose",
    online: true,
  },
];

/* ------------------------------------------------------------------ *
 * Patch notes
 * ------------------------------------------------------------------ */

export const patchNotes = [
  {
    id: "v2-14-0",
    version: "v2.14.0",
    title: "Marine patrol, new fleet and queue rework",
    tag: "Feature",
    tone: "primary",
    releasedAt: "2026-08-14",
    changes: [
      "Added HCSO marine patrol with three new boats and a bay-wide callout system.",
      "Reworked the connection queue — priority now respects supporter tier and department status.",
      "New 2023 Ford F-150 Police Responder added to the HCSO fleet.",
      "Fixed a crash when entering the Tampa General ER interior.",
      "Radio ranges rebalanced for county-wide coverage.",
    ],
  },
  {
    id: "v2-13-2",
    version: "v2.13.2",
    title: "Stability pass and pursuit policy tooling",
    tag: "Fix",
    tone: "brand",
    releasedAt: "2026-07-30",
    changes: [
      "Resolved desync affecting long-distance pursuits on the interstate.",
      "Supervisors can now log pursuit authorisations directly in the MDT.",
      "Reduced server tick cost of the weather sync loop by roughly 30%.",
      "Fixed duplicate evidence entries on the HCSO booking screen.",
    ],
  },
  {
    id: "v2-13-0",
    version: "v2.13.0",
    title: "Business ownership and the new DMV",
    tag: "Feature",
    tone: "primary",
    releasedAt: "2026-07-08",
    changes: [
      "Player-owned businesses are live — nine locations available at launch.",
      "The DMV interior has been rebuilt with a functioning practical test route.",
      "Added twelve new civilian vehicles to dealership stock.",
      "Green zone boundaries redrawn around all spawn areas.",
    ],
  },
  {
    id: "v2-12-1",
    version: "v2.12.1",
    title: "Hotfix — inventory persistence",
    tag: "Hotfix",
    tone: "rose",
    releasedAt: "2026-06-21",
    changes: [
      "Fixed inventory items being lost on an unclean disconnect.",
      "Restored missing evidence lockers at TPD headquarters.",
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Store & supporters
 * ------------------------------------------------------------------ */

export const storeTiers = [
  {
    id: "bronze",
    name: "Bronze",
    price: "$5",
    period: "/month",
    tone: "amber",
    popular: false,
    blurb: "A small thank-you that keeps the lights on.",
    features: [
      "Supporter role in Discord",
      "Coloured name in-character",
      "Priority queue — tier 1",
      "Access to the supporter channels",
    ],
  },
  {
    id: "silver",
    name: "Silver",
    price: "$10",
    period: "/month",
    tone: "slate",
    popular: true,
    blurb: "Our most popular tier — the full quality-of-life bundle.",
    features: [
      "Everything in Bronze",
      "Priority queue — tier 2",
      "Two extra character slots",
      "Custom licence plate",
      "Monthly supporter event access",
    ],
  },
  {
    id: "gold",
    name: "Gold",
    price: "$20",
    period: "/month",
    tone: "primary",
    popular: false,
    blurb: "For members who want to shape where the server goes next.",
    features: [
      "Everything in Silver",
      "Priority queue — tier 3",
      "Four extra character slots",
      "Custom vehicle request per quarter",
      "Direct feedback channel with the dev team",
    ],
  },
];

export const supporters = [
  { id: "sup-1", name: "Riley Vance", tier: "Gold", since: "2025-04-02" },
  { id: "sup-2", name: "Morgan Ellis", tier: "Gold", since: "2025-06-18" },
  { id: "sup-3", name: "Casey Nguyen", tier: "Gold", since: "2026-01-11" },
  { id: "sup-4", name: "Jordan Blake", tier: "Silver", since: "2025-02-27" },
  { id: "sup-5", name: "Taylor Brooks", tier: "Silver", since: "2025-09-05" },
  { id: "sup-6", name: "Avery Sinclair", tier: "Silver", since: "2025-11-30" },
  { id: "sup-7", name: "Quinn Harper", tier: "Silver", since: "2026-03-14" },
  { id: "sup-8", name: "Reese Calloway", tier: "Bronze", since: "2025-01-19" },
  { id: "sup-9", name: "Dakota Pierce", tier: "Bronze", since: "2025-05-23" },
  { id: "sup-10", name: "Emerson Hale", tier: "Bronze", since: "2025-08-09" },
  { id: "sup-11", name: "Rowan Fitzgerald", tier: "Bronze", since: "2026-02-02" },
  { id: "sup-12", name: "Sawyer Lin", tier: "Bronze", since: "2026-05-27" },
];

/* ------------------------------------------------------------------ *
 * Events
 * ------------------------------------------------------------------ */

export const events = [
  {
    id: "ev-1",
    title: "Gulf Coast Street Meet",
    date: "2026-09-06",
    time: "8:00 PM EST",
    location: "Bayshore Boulevard",
    status: "Upcoming",
    attendance: 84,
    description:
      "Bring your build to the causeway. Judged categories for stance, muscle and imports, with a cruise down Bayshore afterwards.",
  },
  {
    id: "ev-2",
    title: "Multi-Agency Hurricane Drill",
    date: "2026-09-13",
    time: "7:00 PM EST",
    location: "County-wide",
    status: "Upcoming",
    attendance: 41,
    description:
      "A full county emergency exercise — evacuation routing, shelter operations and joint FHP/HCSO/HCFR command.",
  },
  {
    id: "ev-3",
    title: "Department Open House",
    date: "2026-09-27",
    time: "6:30 PM EST",
    location: "TPD Headquarters",
    status: "Upcoming",
    attendance: 27,
    description:
      "Thinking about applying? Tour every department, sit in the vehicles and ask the command staff anything.",
  },
  {
    id: "ev-4",
    title: "Summer Boat Parade",
    date: "2026-07-19",
    time: "8:00 PM EST",
    location: "Tampa Bay",
    status: "Past",
    attendance: 132,
    description:
      "Our biggest turnout of the year — 132 players on the water for the annual parade and fireworks.",
  },
  {
    id: "ev-5",
    title: "Season 2 Launch Night",
    date: "2026-06-01",
    time: "7:00 PM EST",
    location: "Server-wide",
    status: "Past",
    attendance: 156,
    description:
      "The Season 2 map, economy rework and new departments went live to a full server.",
  },
];

/* ------------------------------------------------------------------ *
 * Knowledge base
 * ------------------------------------------------------------------ */

export const knowledgeBase = [
  {
    slug: "getting-started",
    title: "Getting started on Florida Roleplay",
    category: "Getting Started",
    summary:
      "Install FiveM, join the Discord, get whitelisted and connect for the first time.",
    updatedAt: "2026-08-02",
    readingTime: "4 min",
    body: [
      "Welcome to Florida Roleplay. This guide takes you from a fresh install to your first scene in about twenty minutes.",
      "Start by installing FiveM from the official site and letting it locate your legitimate copy of GTA V. FiveM will not run against a pirated install, and the launcher will tell you if it cannot verify the game.",
      "Next, join our Discord. Whitelisting, applications, support tickets and department recruitment all happen there, and your Discord account is the identity the server recognises.",
      "Read the rules in full before applying. Our whitelist interview references them directly, and the most common reason an application is declined is an answer that contradicts a rule the applicant clearly skimmed.",
      "Once your whitelist is approved, connect using the address on the join page. Your first spawn puts you at the DMV — take the practical test, get your licence, and you are free to build a character.",
    ],
  },
  {
    slug: "voice-and-radio",
    title: "Voice, radio and phone basics",
    category: "Getting Started",
    summary:
      "Push-to-talk, proximity ranges, radio channels and the in-character phone.",
    updatedAt: "2026-07-21",
    readingTime: "3 min",
    body: [
      "All roleplay on the server happens in voice. Text chat exists only for out-of-character staff communication.",
      "Proximity voice has three ranges — whisper, normal and shout. Cycle them with the volume key; the on-screen indicator shows which range you are currently using.",
      "Radios are item-based. You need a physical radio in your inventory to join a channel, and emergency services are issued one on duty. Keep transmissions short: the channel is shared across the whole department.",
      "The in-character phone handles calls, texts and the classifieds board. Numbers are per-character and persist across sessions.",
    ],
  },
  {
    slug: "applying-to-a-department",
    title: "Applying to an emergency service",
    category: "Applications",
    summary:
      "What each department looks for, what the interview covers, and how long it takes.",
    updatedAt: "2026-08-11",
    readingTime: "5 min",
    body: [
      "Department applications open to any whitelisted member with at least ten hours of logged playtime and no active infractions.",
      "Every application asks for your character's background, your understanding of the pursuit policy, and a written scenario response. Write the scenario as your character would actually handle it — command staff are reading for judgement, not for vocabulary.",
      "If your written application passes, you are invited to a voice interview with the department's command staff. Expect radio procedure questions and a ride-along.",
      "Turnaround is typically three to five days. You can check status any time from the applications page using your reference id.",
    ],
  },
  {
    slug: "reporting-a-player",
    title: "Reporting a player or appealing a ban",
    category: "Support",
    summary: "How to file a report with evidence, and what happens next.",
    updatedAt: "2026-06-29",
    readingTime: "3 min",
    body: [
      "Use the reports page for rule breaks, staff complaints and ban appeals. Reports filed in Discord DMs are not tracked and will be redirected.",
      "Evidence is what makes a report actionable. Clips of thirty to sixty seconds around the incident are ideal — upload to Medal, YouTube or Streamable and paste the link.",
      "Include the time of the incident and the names of everyone involved. Server logs are searchable by timestamp, and a precise time turns a he-said-she-said report into a resolved one.",
      "Reports are reviewed within 48 hours. You will receive the outcome in Discord, and appeals are handled by a different staff member than the one who issued the original sanction.",
    ],
  },
  {
    slug: "performance-and-crashes",
    title: "Fixing performance problems and crashes",
    category: "Troubleshooting",
    summary: "Cache clearing, graphics mods, and the settings that actually matter.",
    updatedAt: "2026-05-16",
    readingTime: "4 min",
    body: [
      "Most crash reports we receive are resolved by clearing the FiveM cache. Delete the cache folder inside your FiveM application data directory and reconnect — the server will re-download only what changed.",
      "Graphics mods are the second most common cause. If you run a visual pack, disable it before reporting a crash so we can tell whether the problem is ours.",
      "Inside the game, the settings with the largest impact are extended distance scaling and grass quality. Dropping both to medium typically recovers twenty to thirty frames on mid-range hardware.",
      "If a crash persists after a cache clear with mods disabled, open a support ticket with your CitizenFX crash log attached.",
    ],
  },
  {
    slug: "supporter-perks",
    title: "Supporter tiers and what they include",
    category: "Store",
    summary: "Queue priority, character slots and how billing works.",
    updatedAt: "2026-08-05",
    readingTime: "2 min",
    body: [
      "Supporter tiers fund the server's hosting and asset licensing. Everything they grant is quality-of-life — none of it affects in-character power balance.",
      "Queue priority is tiered: Gold is served first, then Silver, then Bronze, then standard members. Emergency services on duty are also given priority.",
      "Character slots and cosmetic perks apply immediately after checkout. If a perk has not appeared within fifteen minutes, open a store ticket with your transaction id.",
      "Subscriptions are handled by Tebex and can be cancelled at any time from their portal. Perks remain active until the end of the paid period.",
    ],
  },
];

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
    "A whitelisted FiveM community built around serious, character-driven roleplay on Florida's Gulf Coast — custom scripts, five emergency services and a story that keeps running when you log off.",
  tagline: "Serious RP · Custom Framework · Active Every Night",
};
