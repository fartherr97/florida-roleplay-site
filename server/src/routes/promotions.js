/**
 * The /api/promotions router — the promotion board.
 *
 * Two things are enforced here rather than trusted from the client:
 *
 *  1. **Result visibility.** Ballots and tallies are stripped from any vote the
 *     caller may not watch live. Hiding them only in the UI would leave the
 *     whole board readable in the network tab, which defeats the point of
 *     hiding them at all.
 *  2. **The window.** A ballot posted after a vote closes is refused. The
 *     countdown in the UI is a courtesy; this is the deadline.
 */
import { Router } from "express";
import { execute, query, changedRows } from "../db.js";
import * as seed from "../promotionSeed.js";
import { ROLE_MAP } from "../rosterSeed.js";
import { requirePermission, loadGrants } from "../middleware/requirePermission.js";
import { resolveUser } from "../middleware/requireRole.js";
import { permissionsFor } from "../permissions.js";
import { collect, isDiscordId, str } from "../validate.js";
import {
  CHOICES,
  canSeeResults,
  castBallot,
  isOpen,
  newVote,
  publicStatus,
  tally,
  validateNomination,
} from "../lib/promotionBoard.js";

const router = Router();

const NOT_PERSISTED =
  "Accepted, but not persisted — no database is configured, so this will reset on reload.";

/* ------------------------------------------------------------------ *
 * Loading
 * ------------------------------------------------------------------ */

function parseJson(value, fallback) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Votes with their ballots. Ballots live in their own table rather than inside
 * the vote document because voting is the concurrent operation here — two
 * people voting at once on one JSON blob would lose a ballot.
 */
async function loadVotes() {
  try {
    const rows = await query("SELECT * FROM promotion_votes ORDER BY created_at DESC");
    if (rows.length) {
      const ballots = await query("SELECT * FROM promotion_ballots");
      const byVote = new Map();
      ballots.forEach((row) => {
        if (!byVote.has(row.vote_id)) byVote.set(row.vote_id, []);
        byVote.get(row.vote_id).push({
          voter: { name: row.voter_name, discordId: row.voter_discord_id },
          choice: row.choice,
          reason: row.reason ?? "",
          at: row.cast_at instanceof Date ? row.cast_at.toISOString() : row.cast_at,
        });
      });
      return rows.map((row) => ({
        id: row.id,
        name: row.nominee_name,
        discordId: row.nominee_discord_id,
        currentRoleKey: row.current_role_key,
        proposedRoleKey: row.proposed_role_key,
        reason: row.reason,
        createdBy: { name: row.created_by_name, discordId: row.created_by },
        createdAt: iso(row.created_at),
        opensAt: iso(row.opens_at),
        closesAt: iso(row.closes_at),
        published: Boolean(row.published),
        publishedAt: iso(row.published_at),
        status: row.cancelled ? "cancelled" : undefined,
        ballots: byVote.get(row.id) ?? [],
      }));
    }
  } catch {
    // No database — the seeds stand.
  }
  return seed.votes;
}

function iso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

async function loadRules() {
  try {
    const rows = await query("SELECT value FROM promotion_settings WHERE name = 'visibilityRules' LIMIT 1",
    );
    if (rows.length) return parseJson(rows[0].value, seed.visibilityRules);
  } catch {
    // No database — the seeds stand.
  }
  return seed.visibilityRules;
}

async function loadRoleMap() {
  try {
    const rows = await query("SELECT role_key, rank_label, rank_full, sort_order FROM roster_role_map");
    if (rows.length) {
      return rows.map((row) => ({
        key: row.role_key,
        rank: row.rank_label,
        rankFull: row.rank_full,
        order: row.sort_order,
      }));
    }
  } catch {
    // No database — the seeds stand.
  }
  return ROLE_MAP;
}

async function withCaller(req, _res, next) {
  const user = req.user ?? (await resolveUser(req));
  req.user = user;
  const [grants, roleMap, rules] = await Promise.all([loadGrants(), loadRoleMap(), loadRules()]);
  req.board = {
    roleKeys: user?.roles ?? [],
    permissions: permissionsFor(user?.roles ?? [], grants),
    roleMap,
    rules,
  };
  next();
}

/**
 * Shape a vote to the caller. Without result access the ballots and the tally
 * are removed outright, and the status reads as open — an unpublished outcome
 * must not leak from a badge or a count.
 */
function shape(vote, context) {
  const visible = canSeeResults(vote, context);
  const status = publicStatus(vote, context);
  const base = {
    id: vote.id,
    name: vote.name,
    discordId: vote.discordId,
    currentRoleKey: vote.currentRoleKey,
    proposedRoleKey: vote.proposedRoleKey,
    reason: vote.reason,
    createdBy: vote.createdBy,
    createdAt: vote.createdAt,
    opensAt: vote.opensAt,
    closesAt: vote.closesAt,
    published: !!vote.published,
    publishedAt: vote.publishedAt ?? null,
    status,
    resultsVisible: visible,
  };
  if (!visible) {
    // Turnout is safe to show and useful — "12 have voted" says nothing about
    // which way, and it is what tells someone whether the board is engaged.
    return { ...base, turnout: (vote.ballots ?? []).length, ballots: [], tally: null };
  }
  return { ...base, ballots: vote.ballots ?? [], tally: tally(vote), turnout: (vote.ballots ?? []).length };
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

router.get("/", requirePermission("promotions.view"), withCaller, async (req, res) => {
  const votes = await loadVotes();
  res.json({
    votes: votes.map((vote) => shape(vote, req.board)),
    rules: req.board.permissions.has("promotions.manage") ? req.board.rules : undefined,
  });
});

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

router.post("/", requirePermission("promotions.nominate"), withCaller, async (req, res) => {
  const body = req.body ?? {};
  const errors = validateNomination(body).concat(
    collect([
      [
        !body.discordId || isDiscordId(str(body.discordId)),
        "The nominee's Discord ID must be 17–20 digits.",
      ],
      [
        req.board.roleMap.some((role) => role.key === str(body.proposedRoleKey)),
        "That proposed rank is not in the Discord role map.",
      ],
    ]),
  );
  if (errors.length > 0) return res.status(400).json({ ok: false, errors });

  const vote = newVote({
    name: str(body.name),
    discordId: str(body.discordId),
    currentRoleKey: str(body.currentRoleKey),
    proposedRoleKey: str(body.proposedRoleKey),
    reason: str(body.reason),
    hours: Number(body.hours),
    createdBy: {
      name: req.user?.displayName || req.user?.username || "Unknown",
      discordId: req.user?.id ?? null,
    },
  });

  try {
    await query(`INSERT INTO promotion_votes
        (id, nominee_name, nominee_discord_id, current_role_key, proposed_role_key,
         reason, created_by, created_by_name, opens_at, closes_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        vote.id,
        vote.name,
        vote.discordId || null,
        vote.currentRoleKey || null,
        vote.proposedRoleKey,
        vote.reason,
        vote.createdBy.discordId,
        vote.createdBy.name,
        vote.opensAt.slice(0, 19).replace("T", " "),
        vote.closesAt.slice(0, 19).replace("T", " "),
      ],
    );
  } catch {
    return res.status(201).json({ ok: true, vote: shape(vote, req.board), message: NOT_PERSISTED });
  }
  res.status(201).json({ ok: true, vote: shape(vote, req.board) });
});

/** Cast or change a ballot. Refused once the window has closed. */
router.post("/:voteId/ballot", requirePermission("promotions.vote"), withCaller, async (req, res) => {
  const votes = await loadVotes();
  const vote = votes.find((entry) => entry.id === req.params.voteId);
  if (!vote) return res.status(404).json({ ok: false, message: "No such nomination." });

  const choice = str(req.body?.choice);
  const errors = collect([
    [CHOICES.some((entry) => entry.id === choice), "Choose approve, deny or abstain."],
    [isOpen(vote), "That nomination has closed."],
    [str(req.body?.reason).length <= 500, "Keep the reason under 500 characters."],
  ]);
  if (errors.length > 0) return res.status(400).json({ ok: false, errors });

  const voter = {
    name: req.user?.displayName || req.user?.username || "Unknown",
    discordId: req.user?.id ?? null,
  };

  try {
    await query(`INSERT INTO promotion_ballots (vote_id, voter_discord_id, voter_name, choice, reason)
            VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (vote_id, voter_discord_id) DO UPDATE SET choice = EXCLUDED.choice, reason = EXCLUDED.reason,
                               voter_name = EXCLUDED.voter_name, cast_at = CURRENT_TIMESTAMP`,
      [vote.id, voter.discordId, voter.name, choice, str(req.body?.reason)],
    );
  } catch {
    return res.json({
      ok: true,
      vote: shape(castBallot(vote, voter, choice, str(req.body?.reason)), req.board),
      message: NOT_PERSISTED,
    });
  }

  const updated = castBallot(vote, voter, choice, str(req.body?.reason));
  res.json({ ok: true, vote: shape(updated, req.board) });
});

/**
 * Publish a closed vote, or withdraw one. Two routes rather than one with a
 * parameter, so the allowed actions are the route table rather than a regex.
 */
function resolveAction(publish) {
  return async (req, res) => {
    const votes = await loadVotes();
    const vote = votes.find((entry) => entry.id === req.params.voteId);
    if (!vote) return res.status(404).json({ ok: false, message: "No such nomination." });

    if (publish && isOpen(vote)) {
      return res.status(400).json({
        ok: false,
        errors: ["That nomination is still open — publishing it now would end the vote early."],
      });
    }

    try {
      const result = await execute(
        publish
          ? "UPDATE promotion_votes SET published = TRUE, published_at = CURRENT_TIMESTAMP WHERE id = $1"
          : "UPDATE promotion_votes SET cancelled = TRUE WHERE id = $1",
        [vote.id],
      );
      // A seeded nomination has no row of its own, so the update matches
      // nothing. Saying "done" there would leave the board unchanged with no
      // explanation of why.
      if (!changedRows(result)) {
        return res.json({
          ok: false,
          message:
            "Not saved: this is a seeded example nomination with no stored record, " +
            "so there was nothing to change. Nominations opened here can be published.",
        });
      }
    } catch {
      return res.json({ ok: true, message: NOT_PERSISTED });
    }
    return res.json({ ok: true });
  };
}

router.post("/:voteId/publish", requirePermission("promotions.manage"), withCaller, resolveAction(true));
router.post("/:voteId/withdraw", requirePermission("promotions.manage"), withCaller, resolveAction(false));

/** Who may watch a result before it is published. */
router.put("/rules", requirePermission("promotions.manage"), withCaller, async (req, res) => {
  const rules = req.body?.rules;
  if (!Array.isArray(rules)) {
    return res.status(400).json({ ok: false, errors: ["A rules array is required."] });
  }
  const keys = new Set(req.board.roleMap.map((role) => role.key));
  const errors = collect(
    rules.map((rule) => [
      keys.has(str(rule.roleKey)) && (!rule.maxRoleKey || keys.has(str(rule.maxRoleKey))),
      "Every rule must name Discord roles from the role map.",
    ]),
  );
  if (errors.length > 0) return res.status(400).json({ ok: false, errors });

  try {
    await query(`INSERT INTO promotion_settings (name, value) VALUES ('visibilityRules', $1)
       ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(rules)],
    );
  } catch {
    return res.json({ ok: true, rules, message: NOT_PERSISTED });
  }
  res.json({ ok: true, rules });
});

export default router;
