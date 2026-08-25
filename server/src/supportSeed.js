/**
 * Seed tickets, thread and flows, so the portal renders before anybody has
 * opened one and the whole flow is demonstrable with no database.
 *
 * The three tickets are deliberately in different states — one waiting on the
 * team, one waiting on the member, one resolved — because a queue of three
 * identical open tickets shows none of what the right-hand rail does.
 *
 * Mirrored at client/src/data/supportSeed.js.
 */


export const TICKETS = [];

export const MESSAGES = [];

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
