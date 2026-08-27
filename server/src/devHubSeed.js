/**
 * Development Hub seed data.
 *
 * Mirrors server/src/devHubSeed.js and stands in whenever the API has no
 * database, so the hub renders with something real to look at. Vehicle images
 * are left null on purpose — the cards fall back to a branded placeholder rather
 * than hot-linking an image host.
 */

/** The vehicle library — filled from the database; managers add real vehicles. */
export const VEHICLES = [];

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

/** Requests come from the database — no sample records. */
export const REQUESTS = [];
export const MESSAGES = [];

/** Landing "Latest dev log" card. */
export const LATEST_DEV_LOG = {
  tag: "Latest dev log",
  title: "Development Hub is live — request vehicles, liveries and more here",
  href: "",
};

export const DEV_FEEDBACK = [];
