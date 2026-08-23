/**
 * The promotion board.
 *
 * Someone nominates a member for a rank, a timed vote opens, and the nomination
 * carries when approval clears the threshold. Ported from
 * fartherr97/ssrp-department-hub, with the group-and-level model swapped for the
 * community's Discord role keys.
 *
 * The part worth keeping deliberately is the **result gating**. Live tallies and
 * ballots stay hidden until a vote is published, so people vote on the merits
 * rather than piling onto whichever way it is already going. Two exceptions:
 * anyone who can manage the board always sees live, and a configurable rule can
 * grant a role live sight of votes up to a rank ceiling — a Senior Admin
 * watching moderator votes, without seeing the vote on their own peers.
 *
 * An exact copy of client/src/lib/promotionBoard.js. The server re-tallies and
 * re-checks visibility rather than trusting the client, so the two must stay
 * identical — change one and change the other.
 */

/** How long a nomination stays open by default. */
export const DEFAULT_VOTE_HOURS = 72;

/** Share of decisive (non-abstain) ballots needed to carry. */
export const APPROVAL_THRESHOLD = 50;

export const VOTE_STATUSES = [
  { id: "pending", label: "Open", tone: "amber", color: "#f59e0b" },
  { id: "approved", label: "Approved", tone: "green", color: "#10b981" },
  { id: "denied", label: "Denied", tone: "rose", color: "#f43f5e" },
  { id: "published", label: "Published", tone: "brand", color: "#3b82f6" },
  { id: "cancelled", label: "Withdrawn", tone: "slate", color: "#94a3b8" },
];

export function statusMeta(id) {
  return VOTE_STATUSES.find((status) => status.id === id) ?? VOTE_STATUSES[0];
}

export const CHOICES = [
  { id: "approve", label: "Approve", tone: "green", color: "#10b981" },
  { id: "deny", label: "Deny", tone: "rose", color: "#f43f5e" },
  { id: "abstain", label: "Abstain", tone: "amber", color: "#f59e0b" },
];

let sequence = 0;

export function boardId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  sequence += 1;
  return `${prefix}-${sequence.toString(36)}-${Date.now().toString(36)}`;
}

/* ------------------------------------------------------------------ *
 * Counting
 * ------------------------------------------------------------------ */

/**
 * Abstentions count toward turnout but not toward the outcome — someone
 * declaring they have no view should not drag a nomination down the way a "deny"
 * would.
 */
export function tally(vote) {
  const ballots = vote?.ballots ?? [];
  const approve = ballots.filter((ballot) => ballot.choice === "approve").length;
  const deny = ballots.filter((ballot) => ballot.choice === "deny").length;
  const abstain = ballots.filter((ballot) => ballot.choice === "abstain").length;
  const decisive = approve + deny;
  const approval = decisive > 0 ? Math.round((approve / decisive) * 100) : 0;
  return {
    approve,
    deny,
    abstain,
    total: ballots.length,
    decisive,
    approval,
    passing: decisive > 0 && approval >= APPROVAL_THRESHOLD,
  };
}

/** The true state of a vote, whoever is asking. */
export function voteStatus(vote, now = Date.now()) {
  if (vote?.status === "cancelled") return "cancelled";
  if (vote?.published) return "published";
  const closes = new Date(vote?.closesAt).getTime();
  if (!Number.isNaN(closes) && now < closes) return "pending";
  return tally(vote).passing ? "approved" : "denied";
}

export function isOpen(vote, now = Date.now()) {
  return voteStatus(vote, now) === "pending";
}

const keyOf = (person) => String(person?.discordId || person?.id || "");

/** The caller's own ballot, so the UI can show what they picked. */
export function myBallot(vote, user) {
  const key = keyOf(user);
  if (!key) return null;
  return (vote?.ballots ?? []).find((ballot) => keyOf(ballot.voter) === key) ?? null;
}

/* ------------------------------------------------------------------ *
 * Result visibility
 * ------------------------------------------------------------------ */

/**
 * Seniority of a rank, as its `order` in the Discord role map — higher is more
 * senior. Unknown ranks sort to the bottom, so a rule never accidentally grants
 * sight of a rank it does not recognise.
 */
export function rankOrder(roleMap, roleKey) {
  return (roleMap ?? []).find((role) => role.key === roleKey)?.order ?? -1;
}

/**
 * The most senior rank order a caller may watch live, or null for none.
 * `Infinity` means every vote.
 *
 * `rules` is `[{ roleKey, maxRoleKey }]`: holding `roleKey` grants live sight of
 * votes proposing `maxRoleKey` or anything below it. An empty `maxRoleKey`
 * means no ceiling.
 */
export function liveCeiling(roleKeys, roleMap, rules) {
  const held = new Set(roleKeys ?? []);
  let ceiling = null;
  for (const rule of rules ?? []) {
    if (!held.has(rule.roleKey)) continue;
    const limit = rule.maxRoleKey ? rankOrder(roleMap, rule.maxRoleKey) : Infinity;
    ceiling = ceiling === null ? limit : Math.max(ceiling, limit);
  }
  return ceiling;
}

/** Whether the caller may see the tally and the ballots before publication. */
export function canSeeResults(vote, { roleKeys = [], permissions = new Set(), roleMap = [], rules = [] } = {}) {
  const perms = permissions instanceof Set ? permissions : new Set(permissions);
  if (perms.has("promotions.manage")) return true;
  if (vote?.published) return true;
  const ceiling = liveCeiling(roleKeys, roleMap, rules);
  if (ceiling === null) return false;
  if (ceiling === Infinity) return true;
  return rankOrder(roleMap, vote?.proposedRoleKey) <= ceiling;
}

/**
 * The status the caller is allowed to see. Without result access an unpublished
 * vote reads as open even after it closes — otherwise the outcome would leak
 * from the badge alone.
 */
export function publicStatus(vote, context, now = Date.now()) {
  if (canSeeResults(vote, context)) return voteStatus(vote, now);
  if (vote?.status === "cancelled") return "cancelled";
  if (vote?.published) return "published";
  return "pending";
}

export function boardStats(votes, now = Date.now()) {
  const stats = { pending: 0, approved: 0, denied: 0, published: 0, cancelled: 0 };
  (votes ?? []).forEach((vote) => {
    stats[voteStatus(vote, now)] += 1;
  });
  return { ...stats, total: (votes ?? []).length };
}

/* ------------------------------------------------------------------ *
 * Time
 * ------------------------------------------------------------------ */

/** "2d 3h 9m" until close, or "Closed". */
export function countdown(closesAt, now = Date.now()) {
  let ms = new Date(closesAt).getTime() - now;
  if (Number.isNaN(ms) || ms <= 0) return "Closed";
  const days = Math.floor(ms / 86_400_000);
  ms -= days * 86_400_000;
  const hours = Math.floor(ms / 3_600_000);
  ms -= hours * 3_600_000;
  const minutes = Math.floor(ms / 60_000);
  return [days ? `${days}d` : null, `${hours}h`, `${minutes}m`].filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ *
 * Creating
 * ------------------------------------------------------------------ */

export function newVote({
  name,
  discordId,
  currentRoleKey,
  proposedRoleKey,
  reason,
  createdBy,
  hours = DEFAULT_VOTE_HOURS,
  now = Date.now(),
}) {
  const opensAt = new Date(now).toISOString();
  return {
    id: boardId("vote"),
    name: String(name ?? "").trim(),
    discordId: String(discordId ?? "").trim(),
    currentRoleKey: currentRoleKey ?? "",
    proposedRoleKey: proposedRoleKey ?? "",
    reason: String(reason ?? "").trim(),
    createdBy,
    createdAt: opensAt,
    opensAt,
    closesAt: new Date(now + hours * 3_600_000).toISOString(),
    published: false,
    ballots: [],
  };
}

/**
 * Record a ballot, replacing the voter's previous one. Changing your mind while
 * a vote is open is allowed on purpose — a board where a misclick is permanent
 * gets fewer honest votes, not more.
 */
export function castBallot(vote, voter, choice, reason = "", now = new Date().toISOString()) {
  const key = keyOf(voter);
  const ballots = (vote.ballots ?? []).filter((ballot) => keyOf(ballot.voter) !== key);
  return {
    ...vote,
    ballots: [...ballots, { voter, choice, reason: String(reason ?? "").trim(), at: now }],
  };
}

/** Errors that would make a nomination meaningless, checked on both sides. */
export function validateNomination({ name, proposedRoleKey, reason, hours }) {
  const errors = [];
  if (String(name ?? "").trim().length < 2) errors.push("A nominee name is required.");
  if (!proposedRoleKey) errors.push("Choose the rank being proposed.");
  if (String(reason ?? "").trim().length < 20) {
    errors.push("Give at least a sentence of reasoning — people are voting on it.");
  }
  const window_ = Number(hours);
  if (!Number.isFinite(window_) || window_ < 1 || window_ > 336) {
    errors.push("The voting window must be between 1 and 336 hours.");
  }
  return errors;
}
