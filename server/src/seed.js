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
    tone: "amber",
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
    ranks: ["Deputy", "Master Deputy", "Corporal", "Sergeant", "Lieutenant", "Major", "Sheriff"],
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
    ranks: ["Officer", "Senior Officer", "Corporal", "Sergeant", "Lieutenant", "Captain", "Chief of Police"],
    fleet: [
      "2023 Chevrolet Tahoe PPV",
      "2022 Dodge Charger",
      "SWAT Bearcat",
      "Prisoner Transport Van",
    ],
    applicationType: "mpd",
  },
];

export const rules = [
  {
    id: "cat-disclaimers",
    category: "Disclaimers & Welcome",
    description: "The terms you agree to by being here, and a welcome from the team.",
    items: [
      { id: "rdisclaimers-0", number: "", title: "Server Access Disclaimer", body: "Access to the server is a privilege granted by the Ownership team, who reserve the right to revoke this access at any time and for any reason deemed necessary, without prior notice or explanation. Whitelisted members may be held accountable for actions committed outside of the community at the discretion of Ownership. All rules are subject to change and may be amended by the Ownership team with little to no notice, and it is the responsibility of all members to stay informed of any updates." },
      { id: "rdisclaimers-1", number: "", title: "Non-Discrimination Policy", body: "Florida Roleplay (FLRP) is an equal opportunity community that does not discriminate based on race, color, religion (creed), gender, gender expression, age, national origin (ancestry), disability, marital status, sexual orientation, or military status in any of its activities or operations. This includes, but is not limited to, the hiring and firing of Staff members and department heads, selection of certified civilians, and providing access to the server." },
      { id: "rdisclaimers-2", number: "", title: "Copy Disclaimer", body: "This document is the property of Florida Roleplay (flrp.us). It contains proprietary and confidential information. Unauthorized use of this document is prohibited." },
      { id: "rdisclaimers-3", number: "", title: "Donation Disclaimer", body: "Tebex donations are governed by the Terms of Use and Service available on the Tebex website. All billing-related questions or concerns must be directed to Tebex. Donations made through PayPal are subject to PayPal's Terms of Service and Use. Unless explicitly stated by the Administration of Florida Roleplay (FLRP), PayPal donations will not count toward in-game vehicle benefits and will be considered one-time donations. Any member who voluntarily donates is entitled to a 24-hour refund period from the time of donation; after this period, donations are non-refundable. Donations under $15.00 USD are not eligible for refunds. Refunds are issued after subtracting any applicable administration fees. This community is “Not for Profit” — all donations benefit the server, and no donation is required. By joining our FiveM server, Discord, or any other social media / products / services, you agree to these terms." },
      { id: "rdisclaimers-4", number: "", title: "A Message From Florida Roleplay Staff", body: "Welcome to Florida Roleplay! We are excited and humbled that you have chosen FLRP to provide “The Best Roleplay Experience” any Florida FiveM server has to offer — from our custom Law Enforcement & Fire Department vehicles, to our 120+ custom civilian vehicles, to our custom scripts and everything in between. You can remain completely anonymous if you so choose. Welcome to Florida Roleplay, and thank you for making our server great. Sincerely, Florida Roleplay Staff." },
    ],
  },
  {
    id: "cat-1",
    category: "1 · Advertising",
    description: "No unauthorized Discord links, and no poaching members.",
    items: [
      { id: "r1", number: "1", title: "", body: "Posting any Discord links (whether to another FiveM community or “hangout” server) is strictly prohibited. You must receive administrative approval before posting a link to Discord. Posting an unauthorized link will result in a ban from the community." },
      { id: "r1-1", number: "1.1", title: "", body: "Any member that attempts to recruit or “steal” a member from Florida Roleplay will be banned with zero questions asked." },
    ],
  },
  {
    id: "cat-2",
    category: "2 · Soliciting",
    description: "No soliciting donations for personal gain using the FLRP name or assets.",
    items: [
      { id: "r2", number: "2", title: "", body: "Any member of Florida Roleplay is prohibited from soliciting or attempting to solicit donations for personal gain using the Florida Roleplay name or assets without obtaining prior written permission. Verbal consent is strictly forbidden. Violations will result in disciplinary action as determined by the FLRP Ownership team." },
    ],
  },
  {
    id: "cat-3",
    category: "3 · Spam",
    description: "No mic/chat spam, trolling, or advertising harmful content.",
    items: [
      { id: "r3", number: "3", title: "", body: "Spam is defined as sending large numbers of inappropriate or irrelevant information to users on the internet." },
      { id: "r3-1", number: "3.1", title: "", body: "Includes, but is not limited to: mic spamming, chat spamming, spawning in multiple unnecessary items, and trolling." },
      { id: "r3-2", number: "3.2", title: "", body: "No URLs advertising any violence/threats, hate, sexually explicit content, or terrorism." },
      { id: "r3-2-1", number: "3.2.1", title: "", body: "The FLRP Discord has bots in place that prevent spam; after so many attempts the bot will ban you." },
    ],
  },
  {
    id: "cat-4",
    category: "4 · Discrimination",
    description: "Discrimination is not tolerated in any form.",
    items: [
      { id: "r4", number: "4", title: "", body: "Discrimination is not tolerated within the community. Discrimination is defined as the unjust or prejudicial treatment of different categories of people, such as: religion, race, sex, sexual orientation, age, and gender identification. If you feel you have been discriminated against, please notify a Staff member immediately. If possible, have a recording or witness of the incident. Punishment is on a case-by-case basis; violations of this rule are not taken lightly." },
    ],
  },
  {
    id: "cat-5",
    category: "5 · Disrespect",
    description: "Be civil; use the chain of command for disputes.",
    items: [
      { id: "r5", number: "5", title: "", body: "Being disrespectful or rude to any member of the server, including Staff, can and will result in disciplinary action." },
      { id: "r5-1", number: "5.1", title: "", body: "Arguing about an in-game or out-of-game judgment made by any divisional leadership or Staff is prohibited. If you have a complaint, provide the information in an informative and tactful manner. Use the proper chain of command and the forms in Discord to appeal all judgments." },
    ],
  },
  {
    id: "cat-6",
    category: "6 · Real-Life Military, Public Official & First Responder Policies",
    description: "Stolen valor is a bannable offense; verified status earns a role.",
    items: [
      { id: "r6", number: "6", title: "", body: "Any member who makes aggressively negative comments about United States protective personnel, allied personnel, or any FLRP member found to be indulging in stolen valor — or reasonably suspected of doing so — will be banned from FLRP servers." },
      { id: "r6-1", number: "6.1", title: "", body: "If you publicly or privately claim to other Florida Roleplay members that you are a real-life Law Enforcement Officer, Government Official, or member of the United States Armed Forces, you may be subject to confirmation of your status by the FLRP Ownership team. Personally identifiable information may be redacted at every step. Once verified, members are granted a Discord role publicly confirming their status." },
      { id: "r6-1-1", number: "6.1.1", title: "", body: "Current and former military members must provide documentation proving Veteran or Active Duty status via Common Access Card or Veteran ID Card respectively." },
      { id: "r6-1-2", number: "6.1.2", title: "", body: "Currently employed full-time Law Enforcement officers are authenticated on a case-by-case basis via a verbal or text conversation with the FLRP Ownership team." },
      { id: "r6-1-3", number: "6.1.3", title: "", body: "All other First Responders are verified via a verbal or text conversation with the FLRP Ownership team. Failure to provide adequate proof of a claimed status will result in the removal of the claimed titles and may lead to further disciplinary action as deemed appropriate by the FLRP Management team." },
    ],
  },
  {
    id: "cat-7",
    category: "7 · Voice Chat Rules",
    description: "Respect others; keep it clean and in English.",
    items: [
      { id: "r7", number: "7", title: "", body: "The following rules apply when you are connected to our Discord." },
      { id: "r7-1", number: "7.1", title: "", body: "Respect others." },
      { id: "r7-1-1", number: "7.1.1", title: "", body: "Do not direct any profanity towards any member in a negative way." },
      { id: "r7-1-2", number: "7.1.2", title: "", body: "Extreme or continuous condescending or sarcastic comments are not permitted." },
      { id: "r7-2", number: "7.2", title: "", body: "No posting images / texts / links of a graphic or sexual nature." },
      { id: "r7-3", number: "7.3", title: "", body: "Do not express any racial terms or sexually explicit comments." },
      { id: "r7-4", number: "7.4", title: "", body: "No homophobic or racist soundboards." },
      { id: "r7-5", number: "7.5", title: "", body: "FLRP members must be in their assigned tagged names, as they appear on websites and in-game." },
      { id: "r7-6", number: "7.6", title: "", body: "FLRP members with move powers may move others at their discretion during official business, with the understanding that abuse will result in removal of those permissions." },
      { id: "r7-7", number: "7.7", title: "", body: "If a member uses a “voice changer” during an RP scene, players must be able to understand what the player is saying, and all language used must be in English." },
    ],
  },
  {
    id: "cat-8",
    category: "8 · In-Game Chat Box",
    description: "The chat box is a privilege — don't abuse it.",
    items: [
      { id: "r8", number: "8", title: "", body: "The chat box is a privilege, not a right. Abusing it will get you kicked or banned. No matter the issue, no player is authorized to spam chat." },
      { id: "r8-1", number: "8.1", title: "", body: "No spamming /ooc (out of character) with irrelevant text or metagaming (giving third-hand knowledge you shouldn't have)." },
      { id: "r8-2", number: "8.2", title: "", body: "No arguing with other players or Staff using in-game chat." },
      { id: "r8-3", number: "8.3", title: "", body: "No use of colored text unless you are Staff." },
    ],
  },
  {
    id: "cat-9",
    category: "9 · Malicious Behavior",
    description: "No harmful links, content, or files.",
    items: [
      { id: "r9", number: "9", title: "", body: "Malicious behavior is defined as someone who intends to cause harm to someone or embarrass others." },
      { id: "r9-1", number: "9.1", title: "", body: "No inappropriate links." },
      { id: "r9-2", number: "9.2", title: "", body: "No inappropriate Discord-related content (About Me or Biography — whitelisted members only)." },
      { id: "r9-3", number: "9.3", title: "", body: "No pictures that are not family friendly." },
      { id: "r9-4", number: "9.4", title: "", body: "No uploading any type of file that contains a virus or something that could cause harm." },
    ],
  },
  {
    id: "cat-10",
    category: "10 · Account Responsibility, Member Conduct & Identification",
    description: "You own your account; follow naming and conduct rules.",
    items: [
      { id: "r10", number: "10", title: "", body: "The owner of the account is solely responsible for any and all activity on their account. Failure to follow the rules below may result in disciplinary action." },
      { id: "r10-1", number: "10.1", title: "", body: "It is the responsibility of players to be in cooperation with all applicable Local, State, Provincial, Federal, or Municipal laws where they reside, and with the FiveM & Discord Terms of Service as well as any TOS enforced by Florida Roleplay. Upon joining our Discord, the member automatically agrees they are in full cooperation with this rule." },
      { id: "r10-2", number: "10.2", title: "", body: "No using any racist or offensive names / terms." },
      { id: "r10-3", number: "10.3", title: "", body: "No advertisements (including Steam accounts) in your name." },
      { id: "r10-4", number: "10.4", title: "", body: "No Chinese, Russian, or any special characters in your name." },
      { id: "r10-5", number: "10.5", title: "", body: "All members will be assigned a callsign; failure to comply can result in disciplinary action." },
      { id: "r10-6", number: "10.6", title: "", body: "No use of colored names unless you are Staff." },
      { id: "r10-7", number: "10.7", title: "", body: "Members on a Leave of Absence (or departmental equivalent) may not participate in any administrative, staff, departmental, or disciplinary actions for the duration of their LOA, and are prohibited from joining the FLRP game server with no exceptions." },
      { id: "r10-8", number: "10.8", title: "", body: "Members may not change their name, nickname, or display name, or otherwise present themselves in a way that impersonates a staff member or falsely represents themselves as another whitelisted member." },
      { id: "r10-9", number: "10.9", title: "", body: "No whitelisted member (Law Enforcement, Fire/Rescue, Staff, or the Certified Civilian Department) shall participate in the FLRP game server while under the influence of alcohol or drugs. Members with Discord permissions to assign, remove, or modify tags shall not exercise those permissions while under the influence, and no one may conduct official departmental business (including training) while under the influence. Whether a member is considered under the influence is at the discretion of an FLRP Management team member." },
    ],
  },
  {
    id: "cat-11",
    category: "11 · Cheating and Exploiting",
    description: "No cheats, and report bugs — don't abuse them.",
    items: [
      { id: "r11", number: "11", title: "", body: "No cheating or exploiting." },
      { id: "r11-1", number: "11.1", title: "", body: "Use of client-side trainers and/or mod menus is strictly prohibited. Server-side trainers may be available to different organizations or individuals. This also includes “hacking menus” that allow a player to view information that is only available to Staff members." },
      { id: "r11-2", number: "11.2", title: "", body: "Players cannot use server bugs or game mechanics to exploit for personal gain. If an exploit or bug is discovered, the player must report it immediately." },
    ],
  },
  {
    id: "cat-12",
    category: "12 · Breaking Character",
    description: "Stay in character; take issues to a ticket, not in-game.",
    items: [
      { id: "r12", number: "12", title: "", body: "Breaking character at any point while in game is prohibited without a suitable reason." },
      { id: "r12-1", number: "12.1", title: "", body: "Do not use /ooc or /gooc (out of character) chat to speak to another player in roleplay." },
      { id: "r12-2", number: "12.2", title: "", body: "Do not go out of character in-game unless permitted by a Staff member." },
      { id: "r12-3", number: "12.3", title: "", body: "Do not use any variant of “OOC real quick”." },
      { id: "r12-4", number: "12.4", title: "", body: "If you need to speak to a Staff member or report someone, wait until the RP scene has completed and use the ticket feature in Discord or message a Staff member. Do not argue in-game." },
    ],
  },
  {
    id: "cat-13",
    category: "13 · Roleplay Related Violations / FailRP",
    description: "Roleplay realistically — no meta/power-gaming, RDM, VDM, or NLR breaks.",
    items: [
      { id: "r13", number: "13", title: "", body: "No metagaming, powergaming, random deathmatch, vehicle deathmatch, cop baiting, revenge killing, combat logging, or failure to comply with the New Life Rule. Roleplay-related violations generally do not apply outside of AOP. Reach out to a Staff member if you are unsure." },
      { id: "r13-1", number: "13.1", title: "", body: "Any sexual content or roleplay involving individuals under the age of 18 (in-character or out-of-character), or any non-consensual sexual content or roleplay, is strictly prohibited. No exceptions." },
      { id: "r13-2", number: "13.2", title: "", body: "No terroristic or bomb RP." },
      { id: "r13-3", number: "13.3", title: "", body: "The only acceptable way to have a character be considered “in-state” is via the /showid command in-game." },
      { id: "r13-4", number: "13.4", title: "", body: "No gang RP is permitted unless you are a member of an approved gang in the FLRP “Gangs” Discord." },
      { id: "r13-5", number: "13.5", title: "", body: "FailRP occurs when a player does not roleplay realistically, logically, or in good faith within the situation presented, breaking immersion or ignoring reasonable in-character behavior. Players are expected to act consistently with real-world logic, their character's limitations, and the circumstances of the scenario." },
      { id: "r13-6", number: "13.6", title: "", body: "Once a character's health bar is fully depleted, the character is considered deceased and must be roleplayed as such. No roleplay indicating survival, consciousness, or continued medical viability is permitted after health depletion. The character may only be revived by on-duty Fire/EMS or through an authorized self-revive after the scene has fully concluded; reviving oneself or another player during an active scene is strictly prohibited except for on-duty Fire/EMS or when explicitly directed by Staff." },
      { id: "r13-7", number: "13.7", title: "", body: "Doing actions in-game that would not happen in real life, or that would cause significant damage and/or health loss." },
      { id: "r13-7-1", number: "13.7.1", title: "", body: "Example: continuing to drive a vehicle after hitting a light pole, building, or another vehicle. If you hit anything above 40 mph and continue driving, this is considered FailRP." },
      { id: "r13-7-2", number: "13.7.2", title: "", body: "No animal roleplay (unless Cert. Civ.)." },
      { id: "r13-7-3", number: "13.7.3", title: "", body: "No swimming for longer than an unreasonably realistic amount of time." },
      { id: "r13-8", number: "13.8", title: "Metagaming", body: "Using out-of-character information for in-character use — knowledge your RP character wouldn't know." },
      { id: "r13-9", number: "13.9", title: "Powergaming", body: "Roleplaying on someone's behalf or doing something without giving a person a chance to react; forcing actions against another player; or using game mechanics or roleplay to alter a situation so it best suits your desires." },
      { id: "r13-9-4", number: "13.9.4", title: "", body: "Misuse of jail or hospital systems to punish, retaliate against, or inconvenience another player is prohibited. Jail and hospitalization times must be based solely on the applicable penal codes and roleplay circumstances — not on a player being annoying, uncooperative, difficult, or disliked." },
      { id: "r13-10", number: "13.10", title: "Random Deathmatch (RDM)", body: "Killing someone with little to no roleplay. You must have a valid reason for killing someone." },
      { id: "r13-10-2", number: "13.10.2", title: "", body: "No Hitman RP is allowed without approval from Sr. Admin+ and the person who would also be interacting in the roleplay situation." },
      { id: "r13-11", number: "13.11", title: "Vehicle Deathmatch (VDM)", body: "Killing someone with a vehicle with little to no roleplay. Running over someone who is shooting at you is not VDM, and police using their vehicles to stop a fleeing suspect (killing them in the process) is not VDM." },
      { id: "r13-12", number: "13.12", title: "Cop Baiting", body: "Purposely attempting to get an officer's attention — driving at high speed, burnouts in the middle of the road, ramming cop cars, etc. If an officer is busy with a scene, let them finish." },
      { id: "r13-13", number: "13.13", title: "Revenge Killing", body: "Killing someone after you “die” even though you should have forgotten who killed you." },
      { id: "r13-14", number: "13.14", title: "New Life Rule (NLR)", body: "NLR applies when a character is legitimately killed during a scenario and either respawns or is declared deceased by Fire/EMS. No player may decide whether another player's character is dead (except during Staff intervention). Revive is only permitted via Staff or Fire/EMS. A member who dies with a character may not use the same character for the same scene." },
      { id: "r13-14-1-4", number: "13.14.1.4", title: "Returning to a Scene After Death", body: "A player whose character has died may return to the same scene only on a new character. The new character must have no prior knowledge of the events, individuals, or circumstances of the previous scene, and may not influence, interfere with, or act upon the prior incident in any way that would constitute metagaming." },
      { id: "r13-15", number: "13.15", title: "SuicideRP", body: "Permitted only if it makes sense in an ongoing roleplay and is not graphic, extremely disturbing, or insensitive. Initiating SuicideRP as a roleplay within itself (e.g., jumping off a bridge as a 911 call) is not permitted." },
      { id: "r13-16", number: "13.16", title: "Green Zones", body: "All Green Zones are permanently in “PeaceTime”: normal RP is allowed, but no shooting, killing, robbing, or theft. Green Zones also allow Emergency Services personnel to spawn the character of their choosing without Staff intervention. These include (but are not limited to) all Police Stations, all Fire and EMS Stations, all Hospitals (approx. one block radius, excluding Sandy Station whereas the adjoining parking lot is acceptable), the Prison, and the Server Spawn Point — inside and outside of each building." },
      { id: "r13-17", number: "13.17", title: "FearRP", body: "Players are expected to have a reasonable fear for their lives. Example: an individual in a small room with four people pointing guns at them will follow all demands due to fear of dying." },
      { id: "r13-18", number: "13.18", title: "PoorRP", body: "Roleplay that demonstrates little effort (without necessarily meeting the standard for FailRP) to realistically portray a character or situation, resulting in low-quality or immersion-breaking interactions. Examples include ignoring logical reactions to events, minimal or non-existent responses during interactions, and consistently running from or interacting with law enforcement for little to no reason." },
      { id: "r13-19", number: "13.19", title: "Combat Logging", body: "Exiting the game to avert character death or to escape roleplay, including logging off when a character is deceased. Exiting under these conditions is permitted only with the consent of all involved parties or the authorization of a Staff member." },
    ],
  },
  {
    id: "cat-14",
    category: "14 · Fire Department Interaction Policies",
    description: "Let Fire/EMS finish scenes; don't steal their vehicles.",
    items: [
      { id: "r14-1", number: "14.1", title: "", body: "If Fire/EMS are engaged in a roleplay scene, let them finish." },
      { id: "r14-2", number: "14.2", title: "", body: "You may not start any fire. It must be approved by an Admin+." },
      { id: "r14-3", number: "14.3", title: "", body: "Do not steal Fire/EMS vehicles, no kidnapping Fire/EMS personnel, and no self-reviving without giving an opportunity for EMS to save you and roleplay your scene and/or death." },
    ],
  },
  {
    id: "cat-15",
    category: "15 · Law Enforcement Interaction Policies",
    description: "Let police finish scenes; strict rules on LEO vehicles and impersonation.",
    items: [
      { id: "r15-1", number: "15.1", title: "", body: "If police are engaged in a roleplay scene, let them finish." },
      { id: "r15-1-1", number: "15.1.1", title: "", body: "If tasered more than two (2) times, you must stop running (taser reactivations do not contribute to this number)." },
      { id: "r15-2-1", number: "15.2.1", title: "", body: "Before kidnapping an officer you must get that officer's consent and be at least the rank of Cert. Civ.+ or higher." },
      { id: "r15-3-1", number: "15.3.1", title: "", body: "No stealing or driving Law Enforcement vehicles as a civilian. Exception: Admin+ approval with Certified Civilian+ qualified individuals are permitted to steal police vehicles." },
      { id: "r15-4-1", number: "15.4.1", title: "", body: "LEO members shall not use LEO permissions while not actively on-duty as LEO (RTO, LEO menu, etc.)." },
      { id: "r15-5-1", number: "15.5.1", title: "", body: "No impersonating or “pretending” to be Law Enforcement. Exception: Admin+ approval with Certified Civilian+ qualified individuals are permitted to impersonate Law Enforcement." },
    ],
  },
  {
    id: "cat-16",
    category: "16 · Aviation Related Roleplay",
    description: "Land aircraft safely and away from the public.",
    items: [
      { id: "r16", number: "16", title: "", body: "You can do criminal roleplay while using FLRP aviation aircraft / helicopters. All plane landings during these events must be at airports, beaches, or unpopulated country roads only. Planes cannot be landed on highways, city roads, or where there is considerable risk to the general public. Water planes are permitted to land in oceans, lakes, and streams in areas that are not heavily populated; they cannot be landed in pools or on land." },
    ],
  },
  {
    id: "cat-17",
    category: "17 · Peacetime / Priority Cooldown",
    description: "No initiating LEO priorities during cooldown.",
    items: [
      { id: "r17", number: "17", title: "", body: "During Peacetime or Priority Cooldown, players are prohibited from actions that would initiate a priority event involving Law Enforcement. If a player begins a scenario with a Law Enforcement Officer during Priority Cooldown, they may not escalate it into a priority once the timer reaches zero. During Priority Cooldown, Priorities on Hold, and Priority in Progress, players may participate in violent roleplay with other civilians using any methods allowed by server rules; however, upon the arrival of Emergency Services, all behavior that could initiate a priority must cease. Only one priority event is allowed during “Priority In Progress.” Once the priority returns to cooldown, the player is no longer considered the priority. Hunting roleplay is Passive RP and does not constitute a priority. Running on foot, unarmed, from Law Enforcement does not constitute a priority." },
    ],
  },
  {
    id: "cat-18",
    category: "18 · Vehicle and Weapon Usage",
    description: "Realistic vehicles only; single-shot weapons; no armed aircraft.",
    items: [
      { id: "r18", number: "18", title: "", body: "The following vehicle / weapon rules are in effect until stated otherwise." },
      { id: "r18-1", number: "18.1", title: "", body: "No military / armored vehicles. Exception: unless authorized by a Management+ or the rank of Certified Civilian+." },
      { id: "r18-2", number: "18.2", title: "", body: "No mass spawning vehicles." },
      { id: "r18-3", number: "18.3", title: "", body: "No driving unrealistic vehicles (e.g., an alien project car)." },
      { id: "r18-4", number: "18.4", title: "", body: "No civilians driving emergency vehicles (exceptions found in Section 15)." },
      { id: "r18-5", number: "18.5", title: "", body: "No supercars in Hillsborough County. Exception: traveling on highways." },
      { id: "r18-6", number: "18.6", title: "", body: "No vehicles / aircraft with active mounted weaponry." },
      { id: "r18-7", number: "18.7", title: "", body: "No use of full-auto options on any weapon — all weapons should always be set to single shot. Exception: LEO SWAT members temporarily activated on a priority scene." },
      { id: "r18-8", number: "18.8", title: "", body: "No using numerous weapons / rifles. Exception: your character is carrying a bag." },
      { id: "r18-9", number: "18.9", title: "", body: "Only Certified Civilians are permitted to RP as “Security.” Foxhound Security is the only permitted security company. Please visit civsop.flrp.us for more information." },
    ],
  },
  {
    id: "cat-19",
    category: "19 · Ban Appeals",
    description: "Appeal through the form only; be respectful.",
    items: [
      { id: "r19", number: "19", title: "", body: "All appeals to bans for any reason must be completed in the Ban Appeals form obtained from a Staff member." },
      { id: "r19-1", number: "19.1", title: "", body: "Debating a ban or arguing with community leaders in any form other than the support ticket or ban appeal will result in your appeal being denied and a permanent ban placed on your identity." },
      { id: "r19-2", number: "19.2", title: "", body: "Mistakes happen, but it is your duty to put your point across fairly and responsibly; being rude or unjust in your arguments will lead to your appeal being denied. Appeals must be made by the banned user — no one else may appeal on the member's behalf." },
    ],
  },
  {
    id: "cat-20",
    category: "20 · Dual Community / Dual Clanning Policy",
    description: "Staff can't be staff elsewhere; rank caps for other departments.",
    items: [
      { id: "r20", number: "20", title: "", body: "We are glad to have members who are part of another community. However, when taking on a Staff position here, you may not be Staff in another FiveM community. If you are part of another community, please tell us up front, and let us know if you leave or retire from it." },
      { id: "r20-1", number: "20.1", title: "", body: "If you are part of a department in another community, you cannot be higher than a Corporal (or equivalent) in our community." },
      { id: "r20-2", number: "20.2", title: "", body: "If you have any questions, please reach out to a Community Staff member." },
    ],
  },
  {
    id: "cat-21",
    category: "21 · Investigation Policy",
    description: "How investigations are recorded and classified.",
    items: [
      { id: "r21", number: "21", title: "", body: "Any time a member is under investigation, a record is kept of the complaint. Members under investigation are expected to be truthful and complete when requested by a compliance team member, who compiles the evidence and records the outcome. Outcomes are classified as follows." },
      { id: "r21-1", number: "21.1", title: "Not Sustained", body: "There is insufficient evidence to confirm or refute the complaint." },
      { id: "r21-2", number: "21.2", title: "Sustained", body: "The allegation is true. The player's actions were inconsistent with the rules of FLRP and action was taken." },
      { id: "r21-3", number: "21.3", title: "Exonerated", body: "The allegation is true; however, the player's action was justified and/or consistent with a reasonable understanding of FLRP rules." },
      { id: "r21-4", number: "21.4", title: "Unfounded", body: "The allegations are false or there is no credible evidence to support action. The investigation is documented until further information is gathered." },
    ],
  },
  {
    id: "cat-22",
    category: "22 · Streaming and Server Media Policies",
    description: "Record and stream freely; official media has extra rules.",
    items: [
      { id: "r22", number: "22", title: "", body: "Members are encouraged to record and stream freely, provided they do not officially represent FLRP. Content Creators are admitted case-by-case via a support ticket; typically members need a substantial following (750+) on platforms such as YouTube, Twitch, or TikTok, plus a portfolio for review. Acceptance to the official FLRP Media Team is at the Management team's discretion." },
      { id: "r22-1", number: "22.1", title: "", body: "Content Creators may post a maximum of one (1) stream link in our Discord #going-live channel within a 24-hour period, subject to the owners' discretion." },
      { id: "r22-2", number: "22.2", title: "", body: "All videos and streams must be family-friendly." },
      { id: "r22-3", number: "22.3", title: "", body: "Do not post unsuitable or inappropriate videos on our or your platforms, including NSFW videos and pictures." },
      { id: "r22-4", number: "22.4", title: "", body: "Do not speak negatively about the community or post anything that could damage its reputation." },
      { id: "r22-5", number: "22.5", title: "", body: "When a Staff member requests to initiate a Staff situation, you are required to pause your stream and mute your audio." },
    ],
  },
  {
    id: "cat-23",
    category: "23 · Florida Roleplay Assets",
    description: "Community assets belong to FLRP and must be surrendered on departure.",
    items: [
      { id: "r23", number: "23", title: "", body: "All server resources — including scripts, vehicles, departmental documents, forms, presentations, and any other materials — created by Department Heads, Management, Ownership, or any members in an official capacity are the exclusive property of Florida Roleplay. These resources must be surrendered immediately upon removal, resignation, or banishment, and all copies relinquished or destroyed. All department-related documents must be created, stored, and managed exclusively using the flrp.us domain and its authorized services; the use of external programs, personal accounts, or unauthorized platforms (including personal Google accounts) is strictly prohibited. Any member found in violation is subject to immediate banishment. This policy protects the intellectual property and confidentiality of Florida Roleplay and its assets." },
    ],
  },
  {
    id: "cat-24",
    category: "24 · Staff Discretion",
    description: "Staff have final authority and may enforce common-sense rules.",
    items: [
      { id: "r24", number: "24", title: "", body: "Compliance Division members (e.g., Community Staff) are granted full discretion over all situations within the Discord and in-game servers, and have final authority in any matter inside and outside the game. If you disagree with a decision, contact that member's supervisor (refer to the Chain of Command). Staff may enforce common-sense rules not explicitly detailed in this document. If a situation may breach a rule, consult a Staff member beforehand to ensure compliance." },
    ],
  },
];

export const applicationTypes = [];

export const staff = [];

export const patchNotes = [];

export const storeTiers = [];


export const events = [];

export const knowledgeBase = [];

/** Canned assistant replies, keyed by the topic a message mentions. */
export const assistantReplies = [
  {
    match: ["rdm", "vdm", "metagam", "powergam", "new life"],
    reply:
      "The full rulebook lives on the rules page, and it's searchable. The three people ask about most are 2.2 (no RDM — violence needs build-up and motive), 2.4 (no metagaming — Discord and stream info never reaches your character) and 2.6 (New Life Rule — after you respawn you forget the scene that killed you).",
  },
  {
    match: ["whitelist", "apply", "application", "join"],
    reply:
      "Start with the community whitelist application — everything else needs an approved whitelist behind it. Reviews take 24 to 48 hours and the outcome arrives as a Discord DM. Read the rules first; the interview references them directly.",
  },
  {
    match: ["department", "police", "fhp", "bcso", "mpd"],
    reply:
      "We run three agencies: FHP, BCSO and MPD. Each department page lists its rank structure, fleet and a direct link to its application.",
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
