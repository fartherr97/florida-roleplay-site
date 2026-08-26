/**
 * The /api/discipline router — the DA Hub's store, and the record `/bgcheck`
 * reads in Discord.
 *
 * The rule that matters: **who filed it is taken from the session, never from
 * the body.** An action is a record about a person, and a record that can be
 * filed under somebody else's name is not a record.
 *
 * The second rule: nothing here is ever deleted outright. Voiding marks the row
 * and keeps it, because an action that was withdrawn is part of the history and
 * a background check that silently omits it reads as a clean sheet.
 */
import { Router } from "express";
import { execute, query, changedRows } from "../db.js";
import * as seed from "../disciplineSeed.js";
import { loadGrants } from "../middleware/requirePermission.js";
import { resolveUser } from "../middleware/requireRole.js";
import { permissionsFor } from "../permissions.js";
import { requireBot } from "../middleware/requireBot.js";
import { fetchMemberRoles } from "../lib/discord.js";
import { resolveRoleKeys } from "../lib/roleSync.js";
import { str } from "../validate.js";
import {
  ACTION_TYPE_MAP,
  ACTION_BODY_MAP,
  DEFAULT_WINDOW_DAYS,
  backgroundFor,
  buildBackgroundEmbed,
  canEditAction,
  canFileFor,
  canViewAll,
  normalizeAction,
  validateAction,
} from "../lib/discipline.js";

const router = Router();

/* ------------------------------------------------------------------ *
 * Context and loading
 * ------------------------------------------------------------------ */

async function contextFor(req) {
  const user = req.user ?? (await resolveUser(req));
  req.user = user;
  const roleKeys = user?.roles ?? [];
  return { user, roleKeys, permissions: permissionsFor(roleKeys, await loadGrants()) };
}

const COLUMNS = `
  id, type, body_id AS "bodyId", target_name AS "targetName",
  target_discord_id AS "targetDiscordId", issued_by_name AS "issuedByName",
  issued_by_discord_id AS "issuedByDiscordId", reason, expires_at AS "expiresAt",
  voided, void_reason AS "voidReason", created_at AS "createdAt", updated_at AS "updatedAt"`;

async function loadActions({ targetDiscordId, since } = {}) {
  // Postgres numbers its placeholders, so a clause is written after its value is
  // pushed and reads its own position off the array. Building the two lists
  // independently is how a filter ends up bound to the wrong value.
  const where = [];
  const params = [];
  if (targetDiscordId) {
    params.push(targetDiscordId);
    where.push(`target_discord_id = $${params.length}`);
  }
  if (since) {
    params.push(since);
    where.push(`created_at >= $${params.length}`);
  }
  try {
    const rows = await query(
      `SELECT ${COLUMNS} FROM disciplinary_actions${where.length ? ` WHERE ${where.join(" AND ")}` : ""}
       ORDER BY created_at DESC LIMIT 2000`,
      params,
    );
    if (rows.length) return rows.map((row) => normalizeAction({ ...row, voided: Boolean(row.voided) }));
  } catch {
    // No database — the seeds stand, so the hub and the embed both render.
  }
  return seed.ACTIONS.map(normalizeAction).filter(
    (a) => !targetDiscordId || a.targetDiscordId === targetDiscordId,
  );
}

function noStore(res) {
  return res.status(503).json({
    ok: false,
    code: "DA_NO_STORE",
    message: "Disciplinary actions need a database to record. Nothing was written.",
  });
}

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

/**
 * The hub's two tabs in one call: everything the caller may read, plus the
 * subset they filed themselves.
 *
 * `mine` is computed here rather than filtered in the browser, because somebody
 * who may only see their own must not receive everybody else's to filter.
 */
router.get("/", async (req, res) => {
  const ctx = await contextFor(req);
  if (!ctx.user) {
    return res.status(403).json({ ok: false, code: "AUTH_SIGNED_OUT", message: "Sign in to open the DA Hub." });
  }
  const all = await loadActions();
  const mine = all.filter((a) => a.issuedByDiscordId === ctx.user.id);

  if (!canViewAll(ctx)) {
    return res.json({ actions: mine, mine, canViewAll: false, totals: { mine: mine.length, all: mine.length } });
  }
  res.json({
    actions: all,
    mine,
    canViewAll: true,
    totals: { mine: mine.length, all: all.length },
  });
});

/** One member's folded record — the same shape /bgcheck renders. */
router.get("/background/:discordId", async (req, res) => {
  const ctx = await contextFor(req);
  if (!canViewAll(ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Reading somebody's record needs discipline.view." });
  }
  const discordId = str(req.params.discordId);
  if (!/^\d{17,20}$/.test(discordId)) {
    return res.status(400).json({ ok: false, message: "That is not a Discord ID." });
  }
  const windowDays = clampWindow(req.query.days);
  const actions = await loadActions({ targetDiscordId: discordId });
  res.json({ background: backgroundFor(actions, { discordId, windowDays }) });
});

function clampWindow(value) {
  const days = Number(value);
  return Number.isFinite(days) ? Math.min(3650, Math.max(1, Math.trunc(days))) : DEFAULT_WINDOW_DAYS;
}

/* ------------------------------------------------------------------ *
 * Filing
 * ------------------------------------------------------------------ */

router.post("/", async (req, res) => {
  const ctx = await contextFor(req);
  if (!ctx.user) {
    return res.status(403).json({ ok: false, code: "AUTH_SIGNED_OUT", message: "Sign in to file an action." });
  }

  const body = req.body ?? {};
  const draft = {
    type: str(body.type),
    bodyId: str(body.bodyId),
    targetName: str(body.targetName).slice(0, 128),
    targetDiscordId: str(body.targetDiscordId).trim(),
    reason: str(body.reason).slice(0, 1000),
    expiresAt: body.expiresAt || null,
  };

  const { errors, ok } = validateAction(draft);
  if (!ok) return res.status(400).json({ ok: false, code: "DA_INVALID", errors });

  if (!canFileFor(draft.bodyId, ctx)) {
    return res.status(403).json({
      ok: false,
      code: "AUTH_ROLE_MISSING",
      message: `You cannot file on behalf of ${ACTION_BODY_MAP[draft.bodyId]?.label ?? "that body"}.`,
    });
  }

  // Filing one against yourself is always a mistake — either a misread ID or
  // somebody papering their own record.
  if (draft.targetDiscordId === ctx.user.id) {
    return res.status(400).json({
      ok: false,
      code: "DA_INVALID",
      errors: { targetDiscordId: "That is your own Discord ID." },
    });
  }

  let insertId = null;
  try {
    const result = await query(`INSERT INTO disciplinary_actions
         (type, body_id, target_name, target_discord_id, issued_by_name, issued_by_discord_id, reason, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        draft.type, draft.bodyId, draft.targetName, draft.targetDiscordId,
        ctx.user.displayName ?? ctx.user.username ?? "Unknown", ctx.user.id,
        draft.reason, draft.expiresAt ? new Date(draft.expiresAt) : null,
      ],
    );
    // Postgres has no "last insert id" to ask for afterwards — the INSERT says
    // what it made, which is also the only version that is safe under
    // concurrency.
    insertId = result[0]?.id ?? null;
  } catch {
    return noStore(res);
  }

  res.status(201).json({
    ok: true,
    action: normalizeAction({
      ...draft,
      id: insertId,
      issuedByName: ctx.user.displayName ?? ctx.user.username,
      issuedByDiscordId: ctx.user.id,
      createdAt: new Date().toISOString(),
    }),
  });
});

/** Correct one. Whoever filed it may fix their own; `discipline.manage` may fix any. */
router.put("/:id", async (req, res) => {
  const ctx = await contextFor(req);
  if (!ctx.user) {
    return res.status(403).json({ ok: false, code: "AUTH_SIGNED_OUT", message: "Sign in first." });
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, message: "Invalid id." });

  const existing = (await loadActions()).find((a) => Number(a.id) === id);
  if (!existing) return res.status(404).json({ ok: false, message: "No such action." });
  if (!canEditAction(existing, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That is not yours to edit." });
  }

  const body = req.body ?? {};
  const next = {
    type: ACTION_TYPE_MAP[body.type] ? body.type : existing.type,
    bodyId: ACTION_BODY_MAP[body.bodyId] ? body.bodyId : existing.bodyId,
    targetName: str(body.targetName).slice(0, 128) || existing.targetName,
    reason: str(body.reason).slice(0, 1000) || existing.reason,
    expiresAt: body.expiresAt === null ? null : body.expiresAt || existing.expiresAt,
  };
  // Moving an action to a body you cannot file for would be filing for it.
  if (next.bodyId !== existing.bodyId && !canFileFor(next.bodyId, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "You cannot move it to that body." });
  }

  try {
    const result = await execute(`UPDATE disciplinary_actions
          SET type = $1, body_id = $2, target_name = $3, reason = $4, expires_at = $5
        WHERE id = $6`,
      [next.type, next.bodyId, next.targetName, next.reason, next.expiresAt ? new Date(next.expiresAt) : null, id],
    );
    if (!changedRows(result)) return res.status(404).json({ ok: false, message: "Nothing was updated." });
  } catch {
    return noStore(res);
  }
  res.json({ ok: true, action: normalizeAction({ ...existing, ...next, id }) });
});

/**
 * Void one.
 *
 * This is what the hub's delete button does. The row stays and the record keeps
 * showing it, struck through with the reason — an action that quietly vanished
 * is indistinguishable from one that never happened, and the difference matters
 * to whoever it was filed against.
 */
router.post("/:id/void", async (req, res) => {
  const ctx = await contextFor(req);
  if (!ctx.user) {
    return res.status(403).json({ ok: false, code: "AUTH_SIGNED_OUT", message: "Sign in first." });
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, message: "Invalid id." });

  const existing = (await loadActions()).find((a) => Number(a.id) === id);
  if (!existing) return res.status(404).json({ ok: false, message: "No such action." });
  if (!canEditAction(existing, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That is not yours to void." });
  }

  const reason = str(req.body?.reason).slice(0, 500).trim();
  if (reason.length < 5) {
    return res.status(400).json({ ok: false, code: "DA_INVALID", errors: { reason: "Say why it is being withdrawn." } });
  }

  try {
    const result = await execute("UPDATE disciplinary_actions SET voided = TRUE, void_reason = $1 WHERE id = $2 AND voided = FALSE",
      [reason, id],
    );
    if (!changedRows(result)) {
      return res.status(409).json({ ok: false, message: "That one was already voided." });
    }
  } catch {
    return noStore(res);
  }
  res.json({ ok: true, action: normalizeAction({ ...existing, voided: true, voidReason: reason }) });
});

/* ------------------------------------------------------------------ *
 * The bot
 * ------------------------------------------------------------------ */

/**
 * Resolves whether the Discord user who invoked `/bgcheck` may read records.
 *
 * A background check is staff-only, exactly as the DA Hub is: the bot token proves
 * the request came from our bot, but the *person* who ran the command still has to
 * hold `discipline.view`. We own that decision here rather than in the bot, off the
 * caller's live Discord roles — so it can never disagree with the hub, and it works
 * even for a staff member who has never opened the website. Fails closed: no id, not
 * in the guild, or an unreadable role list all deny.
 *
 * @returns {Promise<boolean>}
 */
async function actorMayViewRecords(actorDiscordId) {
  if (!/^\d{17,20}$/.test(actorDiscordId)) return false;
  try {
    const membership = await fetchMemberRoles(actorDiscordId);
    if (membership === null) return false; // not in the guild
    const roleKeys = await resolveRoleKeys(membership.roles);
    const permissions = permissionsFor(roleKeys, await loadGrants());
    return canViewAll({ permissions });
  } catch {
    return false; // could not verify — deny
  }
}

/**
 * What `/bgcheck` calls.
 *
 * Answers with both the folded record and the finished embed. The bot may post
 * the embed as it stands or build its own from the data — but the default costs
 * it nothing, and it means the site owns what a record looks like rather than
 * two renderers drifting apart.
 *
 * The bot passes the invoking user's Discord id as `actor`; only a caller who holds
 * `discipline.view` is answered, so the bot never has to reimplement the DA Hub's
 * permission model.
 */
router.get("/bot/background/:discordId", requireBot, async (req, res) => {
  const discordId = str(req.params.discordId);
  if (!/^\d{17,20}$/.test(discordId)) {
    return res.status(400).json({ ok: false, message: "That is not a Discord ID." });
  }
  if (!(await actorMayViewRecords(str(req.query.actor)))) {
    return res.status(403).json({
      ok: false,
      code: "AUTH_ROLE_MISSING",
      message: "You don't have permission to run background checks.",
    });
  }
  const windowDays = clampWindow(req.query.days);
  const actions = await loadActions({ targetDiscordId: discordId });
  const background = backgroundFor(actions, { discordId, windowDays });

  // The name off the most recent action, so the embed has something to title
  // itself with even when the bot only had an id to go on.
  const memberName = str(req.query.name) || actions.find((a) => a.targetName)?.targetName || null;

  res.json({
    background,
    memberName,
    message: buildBackgroundEmbed(background, { memberName }),
  });
});

export default router;
