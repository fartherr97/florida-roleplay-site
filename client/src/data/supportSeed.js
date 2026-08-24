/**
 * Seed tickets, thread and flows, so the portal renders before anybody has
 * opened one and the whole flow is demonstrable with no database.
 *
 * The three tickets are deliberately in different states — one waiting on the
 * team, one waiting on the member, one resolved — because a queue of three
 * identical open tickets shows none of what the right-hand rail does.
 *
 * Mirrored from server/src/supportSeed.js.
 */

const HOUR = 3_600_000;
const now = Date.now();
const iso = (hoursAgo) => new Date(now - hoursAgo * HOUR).toISOString();

export const TICKETS = [
  {
    id: "TKT-260824-K4M",
    type: "ban_appeal",
    subject: "Appealing a permanent ban from the FiveM server",
    status: "open",
    priority: "high",
    details: { where: "FiveM server", when: "2026-08-19", reason_given: "Trolling / PoorRP" },
    openedByDiscordId: "402118844500000921",
    openedByName: "B. Oshelski",
    assignedToDiscordId: null,
    assignedToName: null,
    history: [{ action: "opened", actor: "B. Oshelski", details: "Ban appeal", at: iso(26) }],
    lastMessageAt: iso(2),
    createdAt: iso(26),
  },
  {
    id: "TKT-260823-P1X",
    type: "bug",
    subject: "Roster page will not load on mobile",
    status: "pending",
    priority: "normal",
    details: { where: "On the website", steps: "Opened the community roster on my phone and it spun forever." },
    openedByDiscordId: "402118844500000922",
    openedByName: "Priya Raman",
    assignedToDiscordId: "402118844500000900",
    assignedToName: "Marcus Reyes",
    history: [
      { action: "opened", actor: "Priya Raman", details: "Bug or technical issue", at: iso(50) },
      { action: "assigned", actor: "Marcus Reyes", details: "took the ticket", at: iso(48) },
      { action: "status", actor: "Marcus Reyes", details: "Open → Waiting on member", at: iso(47) },
    ],
    lastMessageAt: iso(47),
    createdAt: iso(50),
  },
  {
    id: "TKT-260820-B9C",
    type: "billing",
    subject: "Donation package did not apply in game",
    status: "resolved",
    priority: "normal",
    details: { order: "TBX-99201" },
    openedByDiscordId: "402118844500000923",
    openedByName: "Kai Lindqvist",
    assignedToDiscordId: "402118844500000902",
    assignedToName: "Alex Duarte",
    history: [
      { action: "opened", actor: "Kai Lindqvist", details: "Store or donation", at: iso(96) },
      { action: "assigned", actor: "Alex Duarte", details: "took the ticket", at: iso(94) },
      { action: "status", actor: "Alex Duarte", details: "Open → Resolved", at: iso(90) },
    ],
    lastMessageAt: iso(90),
    createdAt: iso(96),
  },
];

export const MESSAGES = [
  {
    id: "sm-1",
    ticketId: "TKT-260824-K4M",
    internal: false,
    authorId: "402118844500000921",
    authorName: "B. Oshelski",
    authorRole: "Lieutenant",
    body:
      "I am still unclear on what rule was violated or how it was considered Trolling/PoorRP. Looking back at the clip, the original reason to follow the officer and take photos was a roleplay we were conducting — auditing roleplay, where myself and the staff member involved were taking photos of law enforcement. Are you able to clarify the moments in the interaction where it would have been considered PoorRP?",
    replyToId: null,
    createdAt: iso(2),
  },
  {
    id: "sm-2",
    ticketId: "TKT-260824-K4M",
    internal: true,
    authorId: "402118844500000905",
    authorName: "Nick Alvarez",
    authorRole: "Asst. Director",
    body: "Pull the clip before we answer this one — if the audit RP checks out the ban does not stand.",
    replyToId: "sm-1",
    createdAt: iso(2),
  },
  {
    id: "sm-3",
    ticketId: "TKT-260823-P1X",
    internal: false,
    authorId: "402118844500000900",
    authorName: "Marcus Reyes",
    authorRole: "Head Admin",
    body: "Thanks for the report. Which browser and phone are you on? I cannot reproduce it on iOS Safari.",
    replyToId: null,
    createdAt: iso(47),
  },
];

/**
 * A seeded flow, so the builder opens on something real rather than an empty
 * outline. Ban appeals are the obvious first one: the answer always depends on
 * where the ban was and whether it was permanent.
 */
export const FLOWS = [
  {
    version: 1,
    id: "flow_ban_appeal",
    name: "Ban appeal",
    ticketTypes: ["ban_appeal"],
    enabled: true,
    rootId: "n_root",
    nodes: [
      {
        id: "n_root",
        type: "prompt",
        label: "Where were they banned?",
        choices: [
          { label: "FiveM server", nextId: "n_fivem" },
          { label: "Discord", nextId: "n_discord" },
        ],
      },
      {
        id: "n_fivem",
        type: "prompt",
        label: "Was it a permanent ban?",
        choices: [
          { label: "Yes, permanent", nextId: "n_perm" },
          { label: "No, temporary", nextId: "n_temp" },
        ],
      },
      {
        id: "n_perm",
        type: "reply",
        label: "Permanent — needs directorship",
        body:
          "Hi {user},\n\nThanks for appealing. Permanent bans are reviewed by the directorship rather than by the staff team, so I have escalated this and somebody will pick it up.\n\nWe review every appeal properly — you will get an answer either way.\n\n— {agent}",
      },
      {
        id: "n_temp",
        type: "reply",
        label: "Temporary — explain the expiry",
        body:
          "Hi {user},\n\nThanks for reaching out. This was a temporary ban rather than a permanent one, so it lifts on its own without any action from you.\n\nIf you would still like it reviewed, reply here and we will take another look at the clip.\n\n— {agent}",
      },
      {
        id: "n_discord",
        type: "reply",
        label: "Discord ban",
        body:
          "Hi {user},\n\nDiscord bans are handled separately from the game server. I have passed this to the moderation team and they will review it here.\n\n— {agent}",
      },
    ],
  },
];
