/**
 * Seed transfer tickets, so the portal has a queue to render before anybody has
 * raised one and the whole flow is demonstrable with no database.
 *
 * The three cover the states that look different from each other: one waiting on
 * both departments, one where the outgoing department has signed and the
 * receiving one has not, and one already processed. A queue of three identical
 * pending tickets would show none of what the screen actually does.
 *
 * Ranks and departments are Florida's own, read off the same role map the
 * roster uses. Mirrored at client/src/data/transferSeed.js.
 */

const HOUR = 3_600_000;
const now = Date.now();
const iso = (hoursAgo) => new Date(now - hoursAgo * HOUR).toISOString();

export const TRANSFERS = [
  {
    id: "TR-2601",
    memberName: "Owen Brady",
    memberDiscordId: "402118844500000921",
    currentRank: "Senior Trooper",
    fromDept: "fhp",
    toDept: "hcso",
    reason:
      "I have run interstate patrol for eight months and want the county side — marine, K9 and the calls that are not traffic. Spoken to both sides already.",
    status: "pending",
    removeRoles: true,
    assignVisitorPass: true,
    assignRetired: false,
    assignedRank: null,
    employmentType: null,
    retiredMember: false,
    rejectionReason: null,
    approvals: [],
    history: [],
    raisedBy: "402118844500000921",
    createdAt: iso(6),
  },
  {
    id: "TR-2602",
    memberName: "Priya Raman",
    memberDiscordId: "402118844500000922",
    currentRank: "Firefighter/Paramedic",
    fromDept: "hcfr",
    toDept: "dhs",
    reason:
      "Federal side has been recruiting medics for the response team and my shift pattern suits it better. Happy to keep covering HCFR shifts part time.",
    status: "pending",
    removeRoles: false,
    assignVisitorPass: true,
    assignRetired: false,
    assignedRank: null,
    employmentType: null,
    retiredMember: false,
    rejectionReason: null,
    approvals: [
      {
        dept: "hcfr",
        actorId: "402118844500000931",
        actorName: "Ada Wren",
        approvedAt: iso(3),
      },
    ],
    history: [
      { action: "approved", actor: "Ada Wren", details: "HCFR approved the transfer", at: iso(3) },
    ],
    raisedBy: "402118844500000922",
    createdAt: iso(30),
  },
  {
    id: "TR-2603",
    memberName: "Kai Lindqvist",
    memberDiscordId: "402118844500000923",
    currentRank: "Officer",
    fromDept: "tpd",
    toDept: "fhp",
    reason:
      "Moved to nights and TPD's city beat does not have the coverage at that hour. Highway does.",
    status: "completed",
    removeRoles: true,
    assignVisitorPass: true,
    assignRetired: false,
    assignedRank: "Trooper",
    employmentType: "fulltime",
    retiredMember: false,
    rejectionReason: null,
    approvals: [
      { dept: "tpd", actorId: "402118844500000932", actorName: "Marcus Reyes", approvedAt: iso(52) },
      { dept: "fhp", actorId: "402118844500000933", actorName: "Rex Vance", approvedAt: iso(50) },
    ],
    history: [
      { action: "approved", actor: "Marcus Reyes", details: "TPD approved the transfer", at: iso(52) },
      { action: "approved", actor: "Rex Vance", details: "FHP approved the transfer", at: iso(50) },
      {
        action: "completed",
        actor: "Rex Vance",
        details: "Processed by Rex Vance · assigned rank: Trooper, Full time",
        at: iso(48),
      },
    ],
    raisedBy: "402118844500000923",
    createdAt: iso(72),
  },
];

/** Seeded chat, so the two threads are visibly different from each other. */
export const MESSAGES = [
  {
    id: "tm-1",
    transferId: "TR-2602",
    internal: false,
    authorId: "402118844500000931",
    authorName: "Ada Wren",
    body: "Signed off from our side. You have been solid on the medic rotation — sorry to lose you.",
    createdAt: iso(3),
  },
  {
    id: "tm-2",
    transferId: "TR-2602",
    internal: true,
    authorId: "402118844500000931",
    authorName: "Ada Wren",
    body: "No disciplinary history, nothing outstanding. Happy for DHS to take her whenever they are ready.",
    createdAt: iso(3),
  },
];
