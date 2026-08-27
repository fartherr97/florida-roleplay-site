/**
 * Development Hub seed data.
 *
 * Mirrors server/src/devHubSeed.js and stands in whenever the API has no
 * database, so the hub renders with something real to look at. Vehicle images
 * are left null on purpose — the cards fall back to a branded placeholder rather
 * than hot-linking an image host.
 */

/** The vehicle library: what's available, with spawn codes to copy. */
export const VEHICLES = [
  {
    id: "veh-charger-fhp",
    name: "Dodge Charger Pursuit — FHP",
    year: "2023",
    developer: "FLRP Dev Team",
    spawnCode: "flrp_fhp_charger",
    available: true,
    category: "Law enforcement",
    image: null,
    source: "",
  },
  {
    id: "veh-tahoe-bcso",
    name: "Chevrolet Tahoe — BCSO",
    year: "2022",
    developer: "FLRP Dev Team",
    spawnCode: "flrp_bcso_tahoe",
    available: true,
    category: "Law enforcement",
    image: null,
    source: "",
  },
  {
    id: "veh-explorer-mpd",
    name: "Ford Explorer — MPD",
    year: "2023",
    developer: "FLRP Dev Team",
    spawnCode: "flrp_mpd_explorer",
    available: true,
    category: "Law enforcement",
    image: null,
    source: "",
  },
  {
    id: "veh-unmarked-charger",
    name: "Unmarked Charger — CIU",
    year: "2021",
    developer: "FLRP Dev Team",
    spawnCode: "flrp_unmarked_charger",
    available: true,
    category: "Unmarked",
    image: null,
    source: "",
  },
  {
    id: "veh-civ-sedan",
    name: "BMW M5 — Civilian",
    year: "2022",
    developer: "Community",
    spawnCode: "flrp_civ_m5",
    available: true,
    category: "Civilian",
    image: null,
    source: "",
  },
  {
    id: "veh-fire-engine",
    name: "Pierce Fire Engine",
    year: "2020",
    developer: "FLRP Dev Team",
    spawnCode: "flrp_fire_engine",
    available: false,
    category: "Fire / EMS",
    image: null,
    source: "",
  },
];

/** Help Center — popular articles. */
export const ARTICLES = [
  {
    id: "siren-plugin",
    icon: "Siren",
    title: "Emergency lights not working (siren plugin fix)",
    excerpt: "Install the siren client plugin for FiveM so your lightbar and siren work in game.",
  },
  {
    id: "request-status",
    icon: "Activity",
    title: "Checking your request status",
    excerpt: "How to track a request you submitted and what each status means.",
  },
  {
    id: "tebex-link",
    icon: "Link",
    title: "Linking your Tebex email",
    excerpt: "Give us the email tied to your Tebex purchases so a request resolves faster.",
  },
  {
    id: "before-you-buy",
    icon: "ShoppingCart",
    title: "Don't buy before approval",
    excerpt: "Wait for the team to approve your request before purchasing anything, or it may need redoing.",
  },
];

/** A couple of sample requests, so the queue and My Requests are not empty. */
export const REQUESTS = [
  {
    id: "DEV-260827-A1",
    type: "leo_personal",
    subject: "Personal marked FHP Charger",
    status: "pending",
    priority: "normal",
    department: "FHP",
    details: {
      tebex_email: "member@example.com",
      vehicle_link: "https://example.com/fhp-charger",
      department: "FHP",
      liveries: "MARKED FHP",
    },
    openedByDiscordId: "0",
    openedByName: "Sample Member",
    assignedToDiscordId: null,
    assignedToName: null,
    history: [{ action: "opened", actor: "Sample Member", details: "LEO Personal Vehicle", at: "2026-08-27T08:45:00Z" }],
    lastMessageAt: "2026-08-27T08:45:00Z",
    createdAt: "2026-08-27T08:45:00Z",
  },
  {
    id: "DEV-260826-B2",
    type: "department_work",
    subject: "BCSO fleet livery refresh",
    status: "in_progress",
    priority: "high",
    department: "BCSO",
    details: { department: "BCSO", work_type: "Livery", liveries: "New 2026 scheme, all units" },
    openedByDiscordId: "0",
    openedByName: "BCSO Command",
    assignedToDiscordId: null,
    assignedToName: "FLRP Dev Team",
    history: [{ action: "opened", actor: "BCSO Command", details: "Department Work", at: "2026-08-26T14:00:00Z" }],
    lastMessageAt: "2026-08-26T18:00:00Z",
    createdAt: "2026-08-26T14:00:00Z",
  },
];

/** Opening auto-reply plus any seeded thread messages. */
export const MESSAGES = [
  {
    id: "dm-a1",
    requestId: "DEV-260827-A1",
    internal: false,
    authorId: "bot",
    authorName: "FLRP Dev Hub",
    authorRole: null,
    authorAvatar: null,
    body:
      "Thanks for your request. Please don't purchase any vehicles or store items for this until a team member tells you to — buying early can delay the request or need redoing. We'll review and reply here.",
    createdAt: "2026-08-27T08:45:00Z",
  },
];

/** Landing "Latest dev log" card. */
export const LATEST_DEV_LOG = {
  tag: "Latest dev log",
  title: "Development Hub is live — request vehicles, liveries and more here",
  href: "",
};

export const DEV_FEEDBACK = [];
