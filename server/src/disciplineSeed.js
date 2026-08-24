/**
 * Seed disciplinary actions, so the DA Hub and `/bgcheck` both render before
 * anybody has filed one and the whole flow is demonstrable with no database.
 *
 * Deliberately spread across bodies, types and dates: one member carries a
 * record that spans the staff team and a department, one action is inside the
 * six-month window and one falls outside it, and one is voided. A seed where
 * every row looks the same shows none of what the background check does.
 *
 * Mirrored at client/src/data/disciplineSeed.js.
 */

const DAY = 86_400_000;
const now = Date.now();
const iso = (daysAgo) => new Date(now - daysAgo * DAY).toISOString();
const inDays = (days) => new Date(now + days * DAY).toISOString();

export const ACTIONS = [
  {
    id: 2451,
    type: "suspension",
    bodyId: "fhp",
    targetName: "C. Alex",
    targetDiscordId: "402118844500000940",
    issuedByName: "Rex Vance",
    issuedByDiscordId: "402118844500000933",
    reason: "Received a staff strike as a civilian. Two day PTO restriction per ES guidelines.",
    expiresAt: inDays(1),
    createdAt: iso(3),
  },
  {
    id: 2448,
    type: "verbal_warning",
    bodyId: "staff",
    targetName: "C. Alex",
    targetDiscordId: "402118844500000940",
    issuedByName: "Marcus Reyes",
    issuedByDiscordId: "402118844500000900",
    reason: "PoorRP during a traffic stop. Coached on the standard rather than written up.",
    createdAt: iso(11),
  },
  {
    id: 2447,
    type: "written_warning",
    bodyId: "hcso",
    targetName: "H. Dewster",
    targetDiscordId: "402118844500000941",
    issuedByName: "Dana Reyes",
    issuedByDiscordId: "402118844500000903",
    reason: "ES 2.1 violation — disrespected TPD command on a scene.",
    createdAt: iso(28),
  },
  {
    id: 2411,
    type: "strike",
    bodyId: "staff",
    targetName: "J. Hurbert",
    targetDiscordId: "402118844500000942",
    issuedByName: "Marcus Reyes",
    issuedByDiscordId: "402118844500000900",
    reason: "Second strike. Two day PTO restriction per ES guideline 2.7.",
    createdAt: iso(41),
  },
  {
    id: 2404,
    type: "termination",
    bodyId: "management",
    targetName: "C. Williams",
    targetDiscordId: "402118844500000943",
    issuedByName: "Nick Alvarez",
    issuedByDiscordId: "402118844500000905",
    reason: "ES 2.2 — abuse of power and integrity.",
    createdAt: iso(96),
  },
  {
    id: 2396,
    type: "written_warning",
    bodyId: "tpd",
    targetName: "C. Alex",
    targetDiscordId: "402118844500000940",
    issuedByName: "Ivy Cole",
    issuedByDiscordId: "402118844500000944",
    reason: "Left a scene without clearing with the on-scene supervisor.",
    createdAt: iso(150),
    voided: true,
    voidReason: "Overturned on appeal — the supervisor had cleared them on radio.",
  },
  {
    // Outside the six-month window, so a background check should not list it.
    id: 1820,
    type: "demotion",
    bodyId: "fhp",
    targetName: "C. Alex",
    targetDiscordId: "402118844500000940",
    issuedByName: "Rex Vance",
    issuedByDiscordId: "402118844500000933",
    reason: "Personal vehicle policy violation — unauthorised usage.",
    createdAt: iso(240),
  },
];
