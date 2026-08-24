/**
 * Seed applications, so the apply pages and the builder have something real to
 * render before anybody has built one — and so a fresh install with no database
 * still demonstrates the whole flow.
 *
 * Two are department applications and one is a subdivision, because the
 * subdivision case is the one that is easy to get wrong: it belongs to a
 * department, it has its own reviewers, and it requires the department's own
 * role before you may apply.
 *
 * Mirrored from client/src/data/applicationSeed.js.
 */

/**
 * Subdivisions per department. A department's applications may name one of
 * these, and the apply index groups by them.
 *
 * TODO: replace with the real subdivision list as each department stands theirs
 * up — this is the shape, not the roster.
 */
export const SUBDIVISIONS = {
  fhp: [
    { id: "k9", label: "K9 Unit" },
    { id: "aviation", label: "Aviation" },
    { id: "cvi", label: "Commercial Vehicle Inspection" },
    { id: "fto", label: "Field Training Officer" },
  ],
  hcso: [
    { id: "marine", label: "Marine Patrol" },
    { id: "swat", label: "SWAT" },
    { id: "k9", label: "K9 Unit" },
    { id: "fto", label: "Field Training Officer" },
  ],
  tpd: [
    { id: "swat", label: "SWAT" },
    { id: "traffic", label: "Traffic Homicide" },
    { id: "cid", label: "Criminal Investigations" },
    { id: "fto", label: "Field Training Officer" },
  ],
  hcfr: [
    { id: "rescue", label: "Technical Rescue" },
    { id: "hazmat", label: "Hazmat" },
    { id: "als", label: "ALS / Paramedic" },
  ],
};

export function subdivisionsFor(departmentId) {
  return SUBDIVISIONS[departmentId] ?? [];
}

export function subdivisionLabel(departmentId, subdivisionId) {
  if (!subdivisionId) return "";
  return subdivisionsFor(departmentId).find((s) => s.id === subdivisionId)?.label ?? subdivisionId;
}

/* ------------------------------------------------------------------ *
 * Seed applications
 * ------------------------------------------------------------------ */

// TODO: replace every Discord id below with the real channel and role
// snowflakes. They are the only values here that must change before the flow
// works against a live server.
const PLACEHOLDER_CHANNEL = "100000000000001001";

const FHP_TROOPER = {
  version: 1,
  id: "app_fhp_trooper",
  slug: "fhp-trooper",
  title: "FHP — Trooper",
  summary:
    "The entry application for the Florida Highway Patrol. Approved troopers start in a probationary period with an assigned FTO.",
  departmentId: "fhp",
  subdivisionId: "",
  icon: "Car",
  tone: "brand",
  status: "open",
  sections: [
    {
      id: "s_about",
      title: "About you",
      description: "The basics we need to identify you in Discord and in game.",
      fields: [
        { id: "f_name", type: "short", label: "Character name", help: "First and last, as it appears in game.", required: true, placeholder: "Owen Brady" },
        { id: "f_discord", type: "discord", label: "Discord ID", help: "Right-click your name in Discord with developer mode on.", required: true, placeholder: "" },
        { id: "f_steam", type: "steam", label: "Steam hex", help: "From the server's connection log, or ask in #support.", required: true, placeholder: "steam:110000100000000" },
        { id: "f_age", type: "age", label: "Your age", help: "Out of character. We do not accept applicants under 16.", required: true, min: 16, placeholder: "" },
        { id: "f_timezone", type: "dropdown", label: "Time zone", required: true, options: ["Pacific", "Mountain", "Central", "Eastern", "Atlantic", "Outside North America"] },
        { id: "f_availability", type: "availability", label: "When do you usually play?", help: "Pick every slot that applies.", required: true, options: ["Weekday mornings", "Weekday evenings", "Weekend mornings", "Weekend evenings", "Late night"] },
      ],
    },
    {
      id: "s_experience",
      title: "Experience",
      description: "We train from scratch — this only tells us where to start you.",
      fields: [
        { id: "f_prior", type: "multiple", label: "Have you done law enforcement roleplay before?", required: true, options: ["No, this would be my first", "Yes, on another server", "Yes, here in another department"] },
        { id: "f_prior_detail", type: "paragraph", label: "Tell us where, and what rank you reached.", required: true, minLength: 40, showIf: { fieldId: "f_prior", equals: "Yes, on another server" } },
        { id: "f_dept", type: "dropdown", label: "Which department were you in?", required: true, options: ["HCSO", "TPD", "HCFR"], showIf: { fieldId: "f_prior", equals: "Yes, here in another department" } },
        { id: "f_why", type: "paragraph", label: "Why the Highway Patrol specifically?", help: "There are three law enforcement departments — tell us why this one.", required: true, minLength: 120, maxLength: 2000 },
      ],
    },
    {
      id: "s_scenario",
      title: "Scenario",
      description: "There is no trick here. We are reading how you think, not what you already know.",
      fields: [
        {
          id: "f_scenario_text", type: "statement",
          label: "You clock a vehicle at 104 in a 70. It fails to yield, and after two miles the driver pulls into a residential street and stops. There is a passenger. Backup is six minutes out.",
          required: false,
        },
        { id: "f_scenario", type: "paragraph", label: "Walk us through what you do next, and why.", required: true, minLength: 150 },
        { id: "f_pursuit", type: "scale", label: "How confident are you with the pursuit policy?", required: true, min: 1, max: 5, minLabel: "Never read it", maxLabel: "Know it cold" },
      ],
    },
    {
      id: "s_agree",
      title: "Before you submit",
      description: "",
      fields: [
        { id: "f_agree_rules", type: "agree", label: "I have read the server rules and the FHP standard operating procedures.", required: true },
        { id: "f_agree_true", type: "agree", label: "Everything above is true, and I understand a false answer means immediate removal.", required: true },
      ],
    },
  ],
  requirements: { minAgeYears: 16, requireSignIn: true, requireRoleKeys: ["whitelisted"], cooldownDays: 14, maxOpenSubmissions: 1 },
  discord: {
    channelId: PLACEHOLDER_CHANNEL,
    pingRoleIds: ["100000000000000021"],
    reviewerRoleIds: ["100000000000000021", "100000000000000020"],
    approvedRoleIds: ["100000000000000015"],
    mentionApplicant: true,
    embedColor: "",
    footer: "Florida Highway Patrol · Recruitment",
  },
  outcome: {
    confirmation: "Your application is with FHP command. Watch your DMs — we answer every one, approved or not.",
    approvedMessage: "Welcome to Troop C. An FTO will reach out to schedule your ride-along.",
    deniedMessage: "Not this time. You can apply again in two weeks, and we would rather you did.",
  },
};

const FHP_K9 = {
  version: 1,
  id: "app_fhp_k9",
  slug: "fhp-k9",
  title: "FHP — K9 Unit",
  summary: "For serving troopers only. K9 handlers carry a dog on every shift and are on call for other departments.",
  departmentId: "fhp",
  subdivisionId: "k9",
  icon: "PawPrint",
  tone: "amber",
  status: "open",
  sections: [
    {
      id: "s_k9_basics",
      title: "Your service",
      description: "",
      fields: [
        { id: "f_k9_callsign", type: "short", label: "Current callsign", required: true, placeholder: "1-T-18" },
        { id: "f_k9_discord", type: "discord", label: "Discord ID", required: true },
        { id: "f_k9_since", type: "date", label: "When did you join FHP?", required: true },
        { id: "f_k9_hours", type: "number", label: "Roughly how many hours on patrol so far?", required: true, min: 0 },
      ],
    },
    {
      id: "s_k9_why",
      title: "The unit",
      description: "",
      fields: [
        { id: "f_k9_why", type: "paragraph", label: "Why do you want a K9?", required: true, minLength: 100 },
        { id: "f_k9_commit", type: "multiple", label: "Can you commit to two K9 shifts a week?", required: true, options: ["Yes", "No", "Some weeks"] },
        { id: "f_k9_commit_why", type: "paragraph", label: "Tell us what your weeks look like.", required: true, showIf: { fieldId: "f_k9_commit", equals: "Some weeks" } },
        { id: "f_k9_agree", type: "agree", label: "I understand a K9 handler is on call for HCSO and TPD as well.", required: true },
      ],
    },
  ],
  requirements: { minAgeYears: 0, requireSignIn: true, requireRoleKeys: ["fhp_trooper", "fhp_senior_trooper", "fhp_corporal", "fhp_sergeant"], cooldownDays: 30, maxOpenSubmissions: 1 },
  discord: {
    channelId: PLACEHOLDER_CHANNEL,
    pingRoleIds: ["100000000000000020"],
    reviewerRoleIds: ["100000000000000021", "100000000000000020"],
    approvedRoleIds: [],
    mentionApplicant: true,
    embedColor: "#f59e0b",
    footer: "FHP K9 · Applications",
  },
  outcome: {
    confirmation: "Sent to the K9 sergeant. Selections happen monthly.",
    approvedMessage: "",
    deniedMessage: "",
  },
};

const HCFR_FIREFIGHTER = {
  version: 1,
  id: "app_hcfr_firefighter",
  slug: "hcfr-firefighter",
  title: "HCFR — Firefighter",
  summary: "Hillsborough County Fire Rescue runs engine, ladder and rescue companies county-wide. No prior experience needed.",
  departmentId: "hcfr",
  subdivisionId: "",
  icon: "Flame",
  tone: "rose",
  status: "open",
  sections: [
    {
      id: "s_hcfr_about",
      title: "About you",
      description: "",
      fields: [
        { id: "f_hcfr_name", type: "short", label: "Character name", required: true },
        { id: "f_hcfr_discord", type: "discord", label: "Discord ID", required: true },
        { id: "f_hcfr_age", type: "age", label: "Your age", required: true, min: 16 },
        { id: "f_hcfr_side", type: "multiple", label: "Which side interests you more?", required: true, options: ["Fire suppression", "EMS and transport", "Both equally"] },
        { id: "f_hcfr_why", type: "paragraph", label: "Why fire rescue?", required: true, minLength: 100 },
        { id: "f_hcfr_agree", type: "agree", label: "I have read the server rules.", required: true },
      ],
    },
  ],
  requirements: { minAgeYears: 16, requireSignIn: true, requireRoleKeys: ["whitelisted"], cooldownDays: 14, maxOpenSubmissions: 1 },
  discord: {
    channelId: PLACEHOLDER_CHANNEL,
    pingRoleIds: ["100000000000000031"],
    reviewerRoleIds: ["100000000000000031", "100000000000000030"],
    approvedRoleIds: ["100000000000000025"],
    mentionApplicant: true,
    embedColor: "",
    footer: "Hillsborough County Fire Rescue",
  },
  outcome: {
    confirmation: "Thanks — the duty chief reviews applications most evenings.",
    approvedMessage: "",
    deniedMessage: "",
  },
};

export const APPLICATIONS = [FHP_TROOPER, FHP_K9, HCFR_FIREFIGHTER];

/** No submissions are seeded: an empty review queue is the honest starting state. */
export const SUBMISSIONS = [];
