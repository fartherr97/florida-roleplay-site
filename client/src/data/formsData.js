/**
 * The forms and exams the community ships with.
 *
 * A form and an exam are the same document — see src/lib/forms.js. What
 * separates them here is whether the questions carry points and an answer key:
 * the staff promotion exams do, the feedback forms do not, and the civilian
 * certification tests sit in between.
 *
 * `audience` decides which hub lists a form. `submitRoles` and `reviewRoles`
 * name Discord role keys from ROLE_MAP, so who can take an exam follows the
 * roles someone actually holds rather than a separate list to maintain.
 *
 * Mirrored in server/src/formsSeed.js.
 */

/* ------------------------------------------------------------------ *
 * Staff exams
 * ------------------------------------------------------------------ */

const TRIAL_EXAM = {
  id: "staff-trial",
  audience: "staff",
  title: "Trial Moderator Exam",
  description:
    "The entry exam for the staff team. Covers the rulebook, the escalation ladder and the tools you will use on your first shift.",
  icon: "ListChecks",
  passThreshold: 80,
  published: true,
  feedback: false,
  anonymous: false,
  submitRoles: ["trial_mod"],
  reviewRoles: ["senior_admin", "head_admin", "directorship"],
  completionMessage:
    "Submitted. A Senior Admin will grade the written answers and your result appears in the Exam Backend.",
  resourceLinks: [
    { label: "Rulebook", url: "/rules" },
    { label: "Trial Mod Checklist", url: "/staff-hub/trial-checklist" },
  ],
  questions: [
    {
      id: "t-q1",
      type: "multiple",
      prompt: "A player is combat logging during an active scene. What is the first thing you do?",
      required: true,
      points: 2,
      options: [
        "Ban them immediately",
        "Record the evidence, then continue handling the scene",
        "Ask the other party what happened and act on that",
        "Nothing — combat logging is not a staff matter",
      ],
      correct: "Record the evidence, then continue handling the scene",
    },
    {
      id: "t-q2",
      type: "checkboxes",
      prompt: "Which of these require escalation to an Administrator?",
      required: true,
      points: 3,
      options: [
        "A permanent ban appeal",
        "A verbal warning for RDM",
        "A staff member reported by a player",
        "A vehicle stuck in the world",
      ],
      correct: ["A permanent ban appeal", "A staff member reported by a player"],
    },
    {
      id: "t-q3",
      type: "truefalse",
      prompt: "A moderator may action a report they were personally involved in.",
      required: true,
      points: 1,
      correct: "False",
    },
    {
      id: "t-q4",
      type: "short",
      prompt: "What is the maximum ban length a Trial Moderator may issue?",
      required: true,
      points: 1,
      correct: ["24 hours", "24h", "1 day"],
      matchMode: "exact",
    },
    {
      id: "t-q5",
      type: "paragraph",
      prompt:
        "Two players give completely contradictory accounts of the same scene and there is no video evidence. Walk through how you resolve it.",
      required: true,
      points: 5,
    },
  ],
};

const SENIOR_EXAM = {
  id: "staff-senior",
  audience: "staff",
  title: "Senior Moderator Exam",
  description:
    "Taken before promotion to Senior Moderator. Heavier on judgement calls and on the parts of the rulebook that are most often applied wrongly.",
  icon: "ShieldCheck",
  passThreshold: 85,
  published: true,
  feedback: false,
  anonymous: false,
  submitRoles: ["mod", "senior_mod"],
  reviewRoles: ["senior_admin", "head_admin", "directorship"],
  completionMessage: "Submitted. Your result appears in the Exam Backend once it has been graded.",
  resourceLinks: [{ label: "Rulebook", url: "/rules" }],
  questions: [
    {
      id: "s-q1",
      type: "multiple",
      prompt: "A player appeals a ban you issued. Who reviews it?",
      required: true,
      points: 2,
      options: [
        "You, since you have the context",
        "Any other staff member of the same rank",
        "An Administrator or above who was not involved",
        "The player picks a reviewer",
      ],
      correct: "An Administrator or above who was not involved",
    },
    {
      id: "s-q2",
      type: "dropdown",
      prompt: "How long is evidence retained before a case can be closed?",
      required: true,
      points: 2,
      options: ["7 days", "14 days", "30 days", "90 days"],
      correct: "30 days",
    },
    {
      id: "s-q3",
      type: "scale",
      prompt: "How confident are you handling a mass-RDM incident on your own?",
      required: true,
      points: 0,
      scaleMin: 1,
      scaleMax: 5,
      minLabel: "Not at all",
      maxLabel: "Completely",
      correct: "",
    },
    {
      id: "s-q4",
      type: "paragraph",
      prompt:
        "Describe a decision you made as a Moderator that you would make differently now, and what changed your mind.",
      required: true,
      points: 6,
    },
  ],
};

const ADMIN_EXAM = {
  id: "staff-admin",
  audience: "staff",
  title: "Administrator Exam",
  description:
    "The final written stage before an Administrator appointment. Policy, precedent and the handling of staff-on-staff reports.",
  icon: "Shield",
  passThreshold: 85,
  published: true,
  feedback: false,
  anonymous: false,
  submitRoles: ["senior_mod", "junior_admin"],
  reviewRoles: ["head_admin", "directorship"],
  completionMessage: "Submitted. Head Admin reviews these directly.",
  resourceLinks: [],
  questions: [
    {
      id: "a-q1",
      type: "checkboxes",
      prompt: "Which of these must be recorded in the DA database?",
      required: true,
      points: 3,
      options: [
        "A written warning to a staff member",
        "A demotion",
        "A verbal reminder about tone",
        "A suspension",
      ],
      correct: ["A written warning to a staff member", "A demotion", "A suspension"],
    },
    {
      id: "a-q2",
      type: "truefalse",
      prompt: "An Administrator may overturn a Senior Admin's decision without consultation.",
      required: true,
      points: 2,
      correct: "False",
    },
    {
      id: "a-q3",
      type: "paragraph",
      prompt:
        "A Senior Moderator has been reported by three separate players in a week. None of the reports is individually serious. How do you handle it?",
      required: true,
      points: 8,
    },
  ],
};

const STAFF_FEEDBACK = {
  id: "staff-feedback",
  audience: "staff",
  title: "Staff Team Feedback",
  description:
    "Anonymous, ungraded and read by Directorship only. Say what is working and what is not.",
  icon: "Megaphone",
  passThreshold: 0,
  published: true,
  feedback: true,
  anonymous: true,
  submitRoles: [],
  reviewRoles: ["directorship"],
  completionMessage: "Thank you. Nothing about this response identifies you.",
  resourceLinks: [],
  questions: [
    {
      id: "sf-q1",
      type: "rating",
      prompt: "How supported do you feel by the staff team right now?",
      required: true,
      points: 0,
      ratingMax: 5,
      correct: "",
    },
    {
      id: "sf-q2",
      type: "multiple",
      prompt: "How is your current workload?",
      required: true,
      points: 0,
      options: ["Too light", "About right", "Heavy but manageable", "Unsustainable"],
      correct: "",
    },
    {
      id: "sf-q3",
      type: "paragraph",
      prompt: "What would you change about how the team runs?",
      required: false,
      points: 0,
    },
  ],
};

/* ------------------------------------------------------------------ *
 * Civilian forms
 * ------------------------------------------------------------------ */

const WHITELIST_CHECK = {
  id: "civ-whitelist",
  audience: "civilian",
  title: "Whitelist Knowledge Check",
  description:
    "The short quiz that goes with a whitelist application. Everything on it is in the rulebook — read that first and this takes five minutes.",
  icon: "BadgeCheck",
  passThreshold: 80,
  published: true,
  feedback: false,
  anonymous: false,
  submitRoles: [],
  reviewRoles: ["senior_mod", "junior_admin", "admin", "senior_admin", "head_admin", "directorship"],
  completionMessage:
    "Submitted. Your result is attached to your whitelist application — staff review both together.",
  resourceLinks: [
    { label: "Rulebook", url: "/rules" },
    { label: "Whitelist application", url: "/applications/whitelist" },
  ],
  questions: [
    {
      id: "w-q1",
      type: "multiple",
      prompt: "What does “new life rule” mean?",
      required: true,
      points: 2,
      options: [
        "You may return to the scene once you respawn",
        "Your character forgets the events leading to their downing",
        "You must make a new character after every death",
        "You cannot be downed twice in one scene",
      ],
      correct: "Your character forgets the events leading to their downing",
    },
    {
      id: "w-q2",
      type: "truefalse",
      prompt: "Using information you heard on a stream to act in character is allowed.",
      required: true,
      points: 2,
      correct: "False",
    },
    {
      id: "w-q3",
      type: "checkboxes",
      prompt: "Which of these count as failing roleplay?",
      required: true,
      points: 3,
      options: [
        "Driving at full speed through traffic to escape with no regard for your character",
        "Negotiating with police during a hostage situation",
        "Instantly forgetting a robbery because your friend arrived",
        "Calling emergency services after a crash",
      ],
      correct: [
        "Driving at full speed through traffic to escape with no regard for your character",
        "Instantly forgetting a robbery because your friend arrived",
      ],
    },
    {
      id: "w-q4",
      type: "short",
      prompt: "Which command opens a support ticket in game?",
      required: true,
      points: 1,
      correct: ["/report", "report"],
      matchMode: "exact",
    },
    {
      id: "w-q5",
      type: "paragraph",
      prompt:
        "In your own words, describe the character you intend to play and what they want out of the city.",
      required: true,
      points: 4,
    },
  ],
};

const CERT_CIV_TEST = {
  id: "civ-cert-ii",
  audience: "civilian",
  title: "Certified Civilian II Assessment",
  description:
    "The written half of the Cert. Civ. II certification. Pass this and a supervisor books your practical.",
  icon: "Award",
  passThreshold: 80,
  published: true,
  feedback: false,
  anonymous: false,
  submitRoles: ["cert_civ_1", "cert_civ_2"],
  reviewRoles: ["senior_mod", "admin", "senior_admin", "head_admin", "directorship"],
  completionMessage: "Submitted. Watch your Discord DMs for your practical booking.",
  resourceLinks: [
    { label: "Civilian guides", url: "/civilian-hub/guides" },
    { label: "Penal code", url: "/civilian-hub/penal-code" },
  ],
  questions: [
    {
      id: "c-q1",
      type: "dropdown",
      prompt: "What is the penalty class for grand theft auto?",
      required: true,
      points: 2,
      options: ["Infraction", "Misdemeanour", "Felony", "Capital offence"],
      correct: "Felony",
    },
    {
      id: "c-q2",
      type: "multiple",
      prompt: "You witness a robbery in progress. What is the expected response?",
      required: true,
      points: 2,
      options: [
        "Intervene directly",
        "Call it in and keep your distance",
        "Film it and post it later",
        "Ignore it entirely",
      ],
      correct: "Call it in and keep your distance",
    },
    {
      id: "c-q3",
      type: "paragraph",
      prompt: "Describe a scene you have run that you were proud of, and why.",
      required: true,
      points: 4,
    },
  ],
};

const CIV_FEEDBACK = {
  id: "civ-feedback",
  audience: "civilian",
  title: "Community Feedback",
  description: "Anonymous and ungraded. Tell us how the city is playing right now.",
  icon: "Megaphone",
  passThreshold: 0,
  published: true,
  feedback: true,
  anonymous: true,
  submitRoles: [],
  reviewRoles: ["head_admin", "directorship"],
  completionMessage: "Thank you — this goes to the leadership team unattributed.",
  resourceLinks: [],
  questions: [
    {
      id: "cf-q1",
      type: "rating",
      prompt: "How would you rate the city right now?",
      required: true,
      points: 0,
      ratingMax: 5,
      correct: "",
    },
    {
      id: "cf-q2",
      type: "checkboxes",
      prompt: "Which of these have got in your way recently?",
      required: false,
      points: 0,
      options: [
        "Server performance",
        "Waiting for emergency services",
        "Rule-breaking going unactioned",
        "Not enough to do as a civilian",
        "Nothing — it has been good",
      ],
      correct: [],
    },
    {
      id: "cf-q3",
      type: "paragraph",
      prompt: "Anything else you want the team to know?",
      required: false,
      points: 0,
    },
  ],
};

export const forms = [
  TRIAL_EXAM,
  SENIOR_EXAM,
  ADMIN_EXAM,
  STAFF_FEEDBACK,
  WHITELIST_CHECK,
  CERT_CIV_TEST,
  CIV_FEEDBACK,
];

/**
 * Seed submissions, so the review queue and the response summary render before
 * anyone has actually filled a form in. Graded shapes are computed on read from
 * the same engine the live path uses, rather than hardcoded here — hardcoding
 * them would let the seeds drift away from what the grader actually produces.
 */
export const submissions = [
  {
    id: "sub-1",
    formId: "staff-trial",
    subject: { name: "Wren Castellano", discordId: "402118844500000916" },
    answers: {
      "t-q1": "Record the evidence, then continue handling the scene",
      "t-q2": ["A permanent ban appeal", "A staff member reported by a player"],
      "t-q3": "False",
      "t-q4": "24 hours",
      "t-q5":
        "Take both statements separately, check the logs for anything that corroborates either, and if nothing does, no action against either party — but a note on the file so a pattern would show up.",
    },
    at: "2026-08-19T18:22:00Z",
  },
  {
    id: "sub-2",
    formId: "staff-trial",
    subject: { name: "Iggy Salas", discordId: "402118844500000917" },
    answers: {
      "t-q1": "Ban them immediately",
      "t-q2": ["A permanent ban appeal"],
      "t-q3": "False",
      "t-q4": "24 hours",
      "t-q5": "Ask them both and pick whoever sounds more sure.",
    },
    at: "2026-08-21T14:05:00Z",
  },
  {
    id: "sub-3",
    formId: "civ-whitelist",
    subject: { name: "Rosa Delgado", discordId: "402118844500000963" },
    answers: {
      "w-q1": "Your character forgets the events leading to their downing",
      "w-q2": "False",
      "w-q3": [
        "Driving at full speed through traffic to escape with no regard for your character",
        "Instantly forgetting a robbery because your friend arrived",
      ],
      "w-q4": "/report",
      "w-q5":
        "A tow truck driver working the Gulf Coast highways — mostly out to build a business and end up in other people's problems.",
    },
    at: "2026-08-20T09:41:00Z",
  },
  {
    id: "sub-4",
    formId: "civ-feedback",
    anonymous: true,
    answers: {
      "cf-q1": 4,
      "cf-q2": ["Waiting for emergency services"],
      "cf-q3": "More civilian jobs would go a long way.",
    },
    at: "2026-08-22T20:14:00Z",
  },
  {
    id: "sub-5",
    formId: "civ-feedback",
    anonymous: true,
    answers: { "cf-q1": 5, "cf-q2": ["Nothing — it has been good"], "cf-q3": "" },
    at: "2026-08-23T01:02:00Z",
  },
];
