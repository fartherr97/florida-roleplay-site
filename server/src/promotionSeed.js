/**
 * Promotion board seed — nominations, ballots and the live-visibility rules.
 *
 * An exact copy of client/src/data/promotionData.js; change one and change the
 * other. People and ranks match the staff roster, so the board reads as the same
 * team the rest of the site shows.
 *
 * Dates are relative to load rather than fixed, so the seed always has one vote
 * genuinely open and one genuinely closed — a board where every nomination
 * expired months ago shows none of the states that matter.
 */

const HOUR = 3_600_000;
const now = Date.now();
const iso = (offsetHours) => new Date(now + offsetHours * HOUR).toISOString();

/**
 * Who may watch a result before it is published. Senior Admins see moderator
 * votes live but not votes on their own peers; Head Admin sees everything, which
 * is what `promotions.manage` already grants — the rule is here so the intent is
 * visible on the page rather than implied by a permission.
 */
export const visibilityRules = [
  { roleKey: "senior_admin", maxRoleKey: "senior_mod" },
  { roleKey: "head_admin", maxRoleKey: "" },
];

export const votes = [
  {
    id: "vote-open-1",
    name: "Jacob Reyna",
    discordId: "402118844500000912",
    currentRoleKey: "mod",
    proposedRoleKey: "senior_mod",
    reason:
      "Six months at Moderator with the highest claim count on the team and no escalations against him. Covers the late shift nobody else wants and has been informally mentoring the current trial intake already.",
    createdBy: { name: "Alex Duarte", discordId: "402118844500000902" },
    createdAt: iso(-18),
    opensAt: iso(-18),
    closesAt: iso(54),
    published: false,
    ballots: [
      { voter: { name: "Marcus Reyes", discordId: "402118844500000900" }, choice: "approve", reason: "", at: iso(-16) },
      { voter: { name: "Sam Bennett", discordId: "402118844500000905" }, choice: "approve", reason: "Ready.", at: iso(-14) },
      { voter: { name: "Noor Haddad", discordId: "402118844500000906" }, choice: "abstain", reason: "Haven't worked a shift with him.", at: iso(-9) },
    ],
  },
  {
    id: "vote-open-2",
    name: "Mira Solberg",
    discordId: "402118844500000909",
    currentRoleKey: "junior_admin",
    proposedRoleKey: "admin",
    reason:
      "Has been carrying the appeals queue since Theo went on leave, and the turnaround has actually improved. The rank should follow the work she is already doing.",
    createdBy: { name: "Dana Whitfield", discordId: "402118844500000901" },
    createdAt: iso(-40),
    opensAt: iso(-40),
    closesAt: iso(32),
    published: false,
    ballots: [
      { voter: { name: "Marcus Reyes", discordId: "402118844500000900" }, choice: "approve", reason: "", at: iso(-38) },
      { voter: { name: "Alex Duarte", discordId: "402118844500000902" }, choice: "approve", reason: "", at: iso(-30) },
      { voter: { name: "Ines Okafor", discordId: "402118844500000904" }, choice: "deny", reason: "Would rather see another month at Jr. Admin first.", at: iso(-21) },
    ],
  },
  {
    id: "vote-closed-1",
    name: "Ellis Prator",
    discordId: "402118844500000911",
    currentRoleKey: "mod",
    proposedRoleKey: "senior_mod",
    reason:
      "Steady, unflashy and the person everyone asks when they are unsure. Long overdue.",
    createdBy: { name: "Marcus Reyes", discordId: "402118844500000900" },
    createdAt: iso(-200),
    opensAt: iso(-200),
    closesAt: iso(-128),
    published: true,
    publishedAt: iso(-126),
    ballots: [
      { voter: { name: "Dana Whitfield", discordId: "402118844500000901" }, choice: "approve", reason: "", at: iso(-198) },
      { voter: { name: "Alex Duarte", discordId: "402118844500000902" }, choice: "approve", reason: "", at: iso(-190) },
      { voter: { name: "Sam Bennett", discordId: "402118844500000905" }, choice: "approve", reason: "", at: iso(-180) },
      { voter: { name: "Noor Haddad", discordId: "402118844500000906" }, choice: "abstain", reason: "", at: iso(-160) },
    ],
  },
  {
    id: "vote-closed-2",
    name: "Toby Marsh",
    discordId: "402118844500000915",
    currentRoleKey: "mod",
    proposedRoleKey: "senior_mod",
    reason: "Nominated on claim volume alone.",
    createdBy: { name: "Ines Okafor", discordId: "402118844500000904" },
    createdAt: iso(-320),
    opensAt: iso(-320),
    closesAt: iso(-248),
    published: true,
    publishedAt: iso(-246),
    ballots: [
      { voter: { name: "Marcus Reyes", discordId: "402118844500000900" }, choice: "deny", reason: "Activity has dropped off since the nomination opened.", at: iso(-300) },
      { voter: { name: "Dana Whitfield", discordId: "402118844500000901" }, choice: "deny", reason: "", at: iso(-290) },
      { voter: { name: "Alex Duarte", discordId: "402118844500000902" }, choice: "approve", reason: "", at: iso(-280) },
    ],
  },
];
