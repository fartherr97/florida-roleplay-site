/**
 * Seed data mirroring client/src/data/mockData.js so the API serves realistic
 * responses before MariaDB is populated. Every route falls back to these shapes
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
  STAFF: "staff",
  TRIAL_MOD: "trial_mod",
  MODERATOR: "moderator",
  SENIOR_MOD: "senior_mod",
  ADMIN: "admin",
  SENIOR_ADMIN: "senior_admin",
  DIRECTOR: "director",
  MANAGEMENT: "management",
  DEPT_HEAD: "department_head",
};

/** Role bundles the hub gates on, mirrored in client/src/data/hubNavigation.js. */
export const STAFF_ANY = [
  ROLES.STAFF, ROLES.TRIAL_MOD, ROLES.MODERATOR, ROLES.SENIOR_MOD,
  ROLES.ADMIN, ROLES.SENIOR_ADMIN, ROLES.DIRECTOR, ROLES.MANAGEMENT,
];
export const ADMIN_PLUS = [
  ROLES.ADMIN, ROLES.SENIOR_ADMIN, ROLES.DIRECTOR, ROLES.MANAGEMENT,
];
export const SENIOR_ADMIN_PLUS = [
  ROLES.SENIOR_ADMIN, ROLES.DIRECTOR, ROLES.MANAGEMENT,
];
export const DIRECTOR_ONLY = [ROLES.DIRECTOR, ROLES.MANAGEMENT];

/** Any signed-in community member; staff hold these implicitly. */
export const MEMBER_ANY = [ROLES.MEMBER, ROLES.WHITELISTED, ...STAFF_ANY];

/** Personal civilian records only exist for a whitelisted character. */
export const WHITELISTED_ANY = [ROLES.WHITELISTED, ...STAFF_ANY];

/**
 * Every rank the preview switcher offers and the roles each grants, mirroring
 * PREVIEW_RANKS in client/src/data/mockData.js. Used only by the development
 * preview path in middleware/requireRole.js, which is hard-disabled in
 * production.
 */
export const STAFF_RANKS = {
  member: [ROLES.MEMBER],
  whitelisted: [ROLES.MEMBER, ROLES.WHITELISTED],
  trial_mod: [ROLES.MEMBER, ROLES.WHITELISTED, ROLES.STAFF, ROLES.TRIAL_MOD],
  moderator: [
    ROLES.MEMBER, ROLES.WHITELISTED, ROLES.STAFF, ROLES.TRIAL_MOD,
    ROLES.MODERATOR,
  ],
  senior_mod: [
    ROLES.MEMBER, ROLES.WHITELISTED, ROLES.STAFF, ROLES.TRIAL_MOD,
    ROLES.MODERATOR, ROLES.SENIOR_MOD,
  ],
  admin: [
    ROLES.MEMBER, ROLES.WHITELISTED, ROLES.STAFF, ROLES.TRIAL_MOD,
    ROLES.MODERATOR, ROLES.SENIOR_MOD, ROLES.ADMIN,
  ],
  senior_admin: [
    ROLES.MEMBER, ROLES.WHITELISTED, ROLES.STAFF, ROLES.TRIAL_MOD,
    ROLES.MODERATOR, ROLES.SENIOR_MOD, ROLES.ADMIN, ROLES.SENIOR_ADMIN,
  ],
  director: [
    ROLES.MEMBER, ROLES.WHITELISTED, ROLES.STAFF, ROLES.TRIAL_MOD,
    ROLES.MODERATOR, ROLES.SENIOR_MOD, ROLES.ADMIN, ROLES.SENIOR_ADMIN,
    ROLES.DIRECTOR, ROLES.MANAGEMENT,
  ],
};

export const RANK_LABELS = {
  member: "Member",
  whitelisted: "Whitelisted",
  trial_mod: "Trial Mod",
  moderator: "Moderator",
  senior_mod: "Senior Mod",
  admin: "Administrator",
  senior_admin: "Senior Admin",
  director: "Director",
};

/** Every role the middleware will accept, for validation at the edges. */
export const ALL_ROLES = Object.values(ROLES);

/** Development caller resolved from DEV_USER_ID until Discord OAuth is wired. */
export const devUser = {
  id: "198273645500000000",
  username: "sunshine.dev",
  displayName: "Sunshine Dev",
  avatar: null,
  rank: "Senior Moderator",
  roles: [
    ROLES.MEMBER, ROLES.WHITELISTED, ROLES.STAFF, ROLES.TRIAL_MOD,
    ROLES.MODERATOR, ROLES.SENIOR_MOD,
  ],
};

export const serverStatus = {
  online: true,
  players: 118,
  maxPlayers: 128,
  queue: 7,
  uptime: "6d 14h",
  address: "connect.floridaroleplay.example",
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
    fleet: ["Unmarked Tahoe", "Federal Transport Van", "Port Authority Interceptor"],
    applicationType: "dhs",
  },
];

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

export const applicationTypes = [
  { type: "whitelist", name: "Community Whitelist", blurb: "The application every new member starts with. Approval grants access to the main server.", status: "Open", estimate: "24–48 hours", icon: "ScrollText", tone: "primary" },
  { type: "fhp", name: "Florida Highway Patrol", blurb: "Interstate enforcement, crash investigation and pursuit operations.", status: "Open", estimate: "3–5 days", icon: "Car", tone: "brand" },
  { type: "hcso", name: "Hillsborough County Sheriff's Office", blurb: "County patrol, K9, marine and aviation divisions.", status: "Open", estimate: "3–5 days", icon: "Shield", tone: "green" },
  { type: "tpd", name: "Tampa Police Department", blurb: "City patrol, investigations and tactical response.", status: "Open", estimate: "3–5 days", icon: "Building2", tone: "brand" },
  { type: "hcfr", name: "Hillsborough County Fire Rescue", blurb: "Fire suppression, technical rescue and advanced life support.", status: "Open", estimate: "3–5 days", icon: "Flame", tone: "rose" },
  { type: "dhs", name: "Department of Homeland Security", blurb: "Federal task force work. Opens periodically by invitation.", status: "Closed", estimate: "—", icon: "Siren", tone: "amber" },
  { type: "staff", name: "Staff Team", blurb: "Moderation, ticket handling and community support.", status: "Open", estimate: "7–10 days", icon: "Wrench", tone: "primary" },
];

export const staff = [
  { id: "s-1", name: "Marcus Reyes", handle: "reyes", role: "Owner", group: "Management", department: "Management", tone: "rose", online: true },
  { id: "s-2", name: "Dana Whitfield", handle: "dwhitfield", role: "Community Manager", group: "Management", department: "Management", tone: "rose", online: true },
  { id: "s-3", name: "Priya Raman", handle: "praman", role: "Head of Development", group: "Management", department: "Development", tone: "rose", online: false },
  { id: "s-4", name: "Alex Duarte", handle: "aduarte", role: "Head Administrator", group: "Staff", department: "Staff Team", tone: "primary", online: true },
  { id: "s-5", name: "Jamie Okonkwo", handle: "jokonkwo", role: "Senior Moderator", group: "Staff", department: "Staff Team", tone: "primary", online: true },
  { id: "s-6", name: "Sam Bennett", handle: "sbennett", role: "Support Lead", group: "Staff", department: "Support", tone: "primary", online: false },
  { id: "s-7", name: "Colonel R. Vance", handle: "rvance", role: "FHP Colonel", group: "Emergency Services", department: "FHP", tone: "brand", online: true },
  { id: "s-8", name: "Sheriff L. Moreau", handle: "lmoreau", role: "HCSO Sheriff", group: "Emergency Services", department: "HCSO", tone: "green", online: false },
  { id: "s-9", name: "Chief T. Alvarez", handle: "talvarez", role: "TPD Chief of Police", group: "Emergency Services", department: "TPD", tone: "brand", online: true },
  { id: "s-10", name: "Chief M. Doyle", handle: "mdoyle", role: "HCFR Fire Chief", group: "Emergency Services", department: "HCFR", tone: "rose", online: true },
];

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

export const events = [
  { id: "ev-1", title: "Gulf Coast Street Meet", date: "2026-09-06", time: "8:00 PM EST", location: "Bayshore Boulevard", status: "Upcoming", attendance: 84, description: "Bring your build to the causeway. Judged categories for stance, muscle and imports, with a cruise down Bayshore afterwards." },
  { id: "ev-2", title: "Multi-Agency Hurricane Drill", date: "2026-09-13", time: "7:00 PM EST", location: "County-wide", status: "Upcoming", attendance: 41, description: "A full county emergency exercise — evacuation routing, shelter operations and joint FHP/HCSO/HCFR command." },
  { id: "ev-3", title: "Department Open House", date: "2026-09-27", time: "6:30 PM EST", location: "TPD Headquarters", status: "Upcoming", attendance: 27, description: "Thinking about applying? Tour every department, sit in the vehicles and ask the command staff anything." },
  { id: "ev-4", title: "Summer Boat Parade", date: "2026-07-19", time: "8:00 PM EST", location: "Tampa Bay", status: "Past", attendance: 132, description: "Our biggest turnout of the year — 132 players on the water for the annual parade and fireworks." },
  { id: "ev-5", title: "Season 2 Launch Night", date: "2026-06-01", time: "7:00 PM EST", location: "Server-wide", status: "Past", attendance: 156, description: "The Season 2 map, economy rework and new departments went live to a full server." },
];

export const knowledgeBase = [
  {
    slug: "getting-started",
    title: "Getting started on Florida Roleplay",
    category: "Getting Started",
    summary: "Install FiveM, join the Discord, get whitelisted and connect for the first time.",
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
    summary: "Push-to-talk, proximity ranges, radio channels and the in-character phone.",
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
    summary: "What each department looks for, what the interview covers, and how long it takes.",
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
    match: ["department", "police", "fhp", "hcso", "tpd", "fire", "hcfr", "dhs"],
    reply:
      "We run five agencies: FHP, HCSO, TPD, HCFR and DHS. Four are hiring right now — DHS opens by invitation only. Each department page lists its rank structure, fleet and a direct link to its application.",
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
