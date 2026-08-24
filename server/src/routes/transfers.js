/**
 * The /api/transfers router — the Emergency Services transfer portal.
 *
 * Ported from fartherr97/es-transfer-portal, where each of these was a Next.js
 * route handler. Two things are done differently here, and both are why the
 * port was worth doing rather than deploying that app beside this one:
 *
 * - **The caller is this site's session.** The original carried its own Discord
 *   OAuth and its own role-map file to decide who was a department head. Here it
 *   is the same `resolveUser` and the same permission table as every other
 *   route, so there is one answer to "who is this" rather than two.
 * - **Every gate is re-checked here.** The original's UI hid what you could not
 *   do; so does this one, but hiding a button has never prevented anything. The
 *   department a caller signs for is derived from their roles, never read from
 *   the request body.
 *
 * Settings moved from a process global to a table on the way across. A webhook
 * URL a director typed in should survive a restart.
 */
import { Router } from "express";
import { query, changedRows } from "../db.js";
import * as seed from "../transferSeed.js";
import { loadGrants } from "../middleware/requirePermission.js";
import { resolveUser } from "../middleware/requireRole.js";
import { permissionsFor } from "../permissions.js";
import { str } from "../validate.js";
import {
  TRANSFER_DEPARTMENT_IDS,
  DEFAULT_WEBHOOK,
  applyApproval,
  applyRevoke,
  approvalState,
  buildWebhookPayload,
  canCloseTicket,
  canManageTicket,
  canViewTicket,
  cleanWebhookUrl,
  departmentAbbr,
  headOf,
  isManagement,
  isTerminal,
  signingDepartmentFor,
  validateRequest,
  visibleTickets,
  EMPLOYMENT_TYPES,
} from "../lib/transferPortal.js";

const router = Router();

/* ------------------------------------------------------------------ *
 * Caller context
 * ------------------------------------------------------------------ */

async function contextFor(req) {
  const user = req.user ?? (await resolveUser(req));
  req.user = user;
  const roleKeys = user?.roles ?? [];
  return { user, roleKeys, permissions: permissionsFor(roleKeys, await loadGrants()) };
}

function requireSignIn(ctx, res) {
  if (ctx.user) return false;
  res.status(403).json({
    ok: false,
    code: "AUTH_SIGNED_OUT",
    message: "Sign in with Discord to use the transfer portal.",
  });
  return true;
}

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

const TICKET_COLUMNS = `
  id, member_name AS memberName, member_discord_id AS memberDiscordId,
  current_rank AS currentRank, from_dept AS fromDept, to_dept AS toDept, reason, status,
  remove_roles AS removeRoles, assign_visitor_pass AS assignVisitorPass,
  assign_retired AS assignRetired, assigned_rank AS assignedRank,
  employment_type AS employmentType, retired_member AS retiredMember,
  rejection_reason AS rejectionReason, approvals, history,
  raised_by AS raisedBy, created_at AS createdAt, updated_at AS updatedAt`;

function shapeTicket(row) {
  return {
    ...row,
    removeRoles: Boolean(row.removeRoles),
    assignVisitorPass: Boolean(row.assignVisitorPass),
    assignRetired: Boolean(row.assignRetired),
    retiredMember: Boolean(row.retiredMember),
    approvals: parseJson(row.approvals, []),
    history: parseJson(row.history, []),
  };
}

/**
 * Every ticket. Falls back to the seeds like every other read on this site, so
 * the portal renders before a database exists — writes do not, and say so.
 */
async function loadTickets() {
  try {
    const rows = await query(`SELECT ${TICKET_COLUMNS} FROM transfers ORDER BY created_at DESC`);
    if (rows.length) return rows.map(shapeTicket);
  } catch {
    // No database — the seeds stand.
  }
  return seed.TRANSFERS;
}

async function loadTicket(id) {
  return (await loadTickets()).find((ticket) => ticket.id === id) ?? null;
}

/** Persists the whole ticket. The engine decided what it should be; this writes it. */
async function saveTicket(ticket) {
  const result = await query(
    `UPDATE transfers
        SET status = ?, approvals = ?, history = ?, rejection_reason = ?,
            assigned_rank = ?, employment_type = ?, retired_member = ?
      WHERE id = ?`,
    [
      ticket.status,
      JSON.stringify(ticket.approvals ?? []),
      JSON.stringify(ticket.history ?? []),
      ticket.rejectionReason ?? null,
      ticket.assignedRank ?? null,
      ticket.employmentType ?? null,
      ticket.retiredMember ? 1 : 0,
      ticket.id,
    ],
  );
  return changedRows(result) > 0;
}

/** The one shape every write path answers with, so the client never guesses. */
function noStore(res) {
  return res.status(503).json({
    ok: false,
    code: "TRANSFERS_NO_STORE",
    message: "The transfer portal needs a database to record that. Nothing was written.",
  });
}

/* ------------------------------------------------------------------ *
 * Tickets
 * ------------------------------------------------------------------ */

/** The queue, already filtered to what this caller may see. */
router.get("/", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const tickets = visibleTickets(await loadTickets(), ctx);
  res.json({
    tickets,
    me: {
      departments: headOf(ctx),
      management: isManagement(ctx),
    },
  });
});

/** One ticket. */
router.get("/:id", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const ticket = await loadTicket(str(req.params.id));
  if (!ticket) return res.status(404).json({ ok: false, message: "No such transfer." });
  if (!canViewTicket(ticket, ctx)) {
    return res.status(403).json({
      ok: false,
      code: "AUTH_ROLE_MISSING",
      message: "That transfer is between two departments you do not command.",
    });
  }
  res.json({
    ticket,
    can: {
      manage: canManageTicket(ticket, ctx),
      internal: canManageTicket(ticket, ctx),
      close: canCloseTicket(ctx),
      signFor: signingDepartmentFor(ticket, ctx),
    },
  });
});

/**
 * Raise one.
 *
 * A department head may raise a transfer on somebody's behalf; anybody else may
 * only raise their own, and `memberDiscordId` is forced to their own id rather
 * than taken from the body. Otherwise the form would be a way to file a
 * transfer in someone else's name.
 */
router.post("/", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;

  const body = req.body ?? {};
  const onBehalf = canManageTicketAnywhere(ctx);
  const draft = {
    memberName: str(body.memberName).slice(0, 128),
    memberDiscordId: onBehalf ? str(body.memberDiscordId).trim() : ctx.user.id,
    currentRank: str(body.currentRank).slice(0, 128),
    fromDept: str(body.fromDept),
    toDept: str(body.toDept),
    reason: str(body.reason).slice(0, 4000),
    removeRoles: body.removeRoles !== false,
    assignVisitorPass: body.assignVisitorPass !== false,
    assignRetired: body.assignRetired === true,
  };

  const { errors, ok } = validateRequest(draft);
  if (!ok) return res.status(400).json({ ok: false, code: "TRANSFER_INVALID", errors });

  const id = `TR-${Date.now().toString(36).toUpperCase()}`;
  const history = [
    {
      action: "raised",
      actor: ctx.user.displayName ?? ctx.user.username ?? "Unknown",
      details: `${departmentAbbr(draft.fromDept)} → ${departmentAbbr(draft.toDept)}`,
      at: new Date().toISOString(),
    },
  ];

  try {
    await query(
      `INSERT INTO transfers
         (id, member_name, member_discord_id, current_rank, from_dept, to_dept, reason,
          status, remove_roles, assign_visitor_pass, assign_retired, approvals, history, raised_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, '[]', ?, ?)`,
      [
        id, draft.memberName, draft.memberDiscordId || null, draft.currentRank,
        draft.fromDept, draft.toDept, draft.reason,
        draft.removeRoles ? 1 : 0, draft.assignVisitorPass ? 1 : 0, draft.assignRetired ? 1 : 0,
        JSON.stringify(history), ctx.user.id,
      ],
    );
  } catch {
    return noStore(res);
  }

  const ticket = { id, ...draft, status: "pending", approvals: [], history, createdAt: new Date().toISOString() };
  // Fire-and-forget: a webhook that will not send must never cost somebody
  // their transfer request.
  notifyDepartments(ticket).catch(() => {});
  res.status(201).json({ ok: true, ticket });
});

/** True when the caller heads any department or oversees them all. */
function canManageTicketAnywhere(ctx) {
  return isManagement(ctx) || headOf(ctx).length > 0;
}

/* ------------------------------------------------------------------ *
 * Signing
 * ------------------------------------------------------------------ */

/**
 * Approve, on behalf of the department the caller actually heads.
 *
 * The department is resolved from their roles rather than read from the body —
 * otherwise a Fire Chief could post `{ dept: "fhp" }` and sign for the Highway
 * Patrol.
 */
router.post("/:id/approve", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const ticket = await loadTicket(str(req.params.id));
  if (!ticket) return res.status(404).json({ ok: false, message: "No such transfer." });
  if (!canManageTicket(ticket, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "You do not sign for either department on this transfer." });
  }
  if (isTerminal(ticket.status)) {
    return res.status(409).json({ ok: false, code: "TRANSFER_CLOSED", message: `That transfer is already ${ticket.status}.` });
  }

  const dept = signingDepartmentFor(ticket, ctx);
  if (!dept) {
    return res.status(409).json({ ok: false, code: "TRANSFER_ALREADY_SIGNED", message: "Both departments have already signed." });
  }

  const next = applyApproval(ticket, {
    dept,
    actorId: ctx.user.id,
    actorName: ctx.user.displayName ?? ctx.user.username,
  });
  try {
    if (!(await saveTicket(next))) return res.status(404).json({ ok: false, message: "Nothing was updated." });
  } catch {
    return noStore(res);
  }
  res.json({ ok: true, ticket: next });
});

/** Withdraw a signature. Only the department that gave it may take it back. */
router.post("/:id/revoke", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const ticket = await loadTicket(str(req.params.id));
  if (!ticket) return res.status(404).json({ ok: false, message: "No such transfer." });
  if (!canManageTicket(ticket, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "You do not sign for either department on this transfer." });
  }
  if (isTerminal(ticket.status)) {
    return res.status(409).json({ ok: false, code: "TRANSFER_CLOSED", message: `That transfer is already ${ticket.status}.` });
  }

  const mine = headOf(ctx);
  const signed = new Set((ticket.approvals ?? []).map((a) => a.dept));
  const dept = isManagement(ctx)
    ? [ticket.fromDept, ticket.toDept].find((d) => signed.has(d))
    : mine.find((d) => signed.has(d));
  if (!dept) {
    return res.status(409).json({ ok: false, code: "TRANSFER_NOT_SIGNED", message: "There is no approval of yours to withdraw." });
  }

  const next = applyRevoke(ticket, { dept, actorName: ctx.user.displayName ?? ctx.user.username });
  try {
    if (!(await saveTicket(next))) return res.status(404).json({ ok: false, message: "Nothing was updated." });
  } catch {
    return noStore(res);
  }
  res.json({ ok: true, ticket: next });
});

/** Refuse it, with a reason. Either department can, at any point before completion. */
router.post("/:id/reject", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const ticket = await loadTicket(str(req.params.id));
  if (!ticket) return res.status(404).json({ ok: false, message: "No such transfer." });
  if (!canManageTicket(ticket, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "You do not sign for either department on this transfer." });
  }
  if (isTerminal(ticket.status)) {
    return res.status(409).json({ ok: false, code: "TRANSFER_CLOSED", message: `That transfer is already ${ticket.status}.` });
  }

  const reason = str(req.body?.reason).slice(0, 512).trim();
  if (reason.length < 10) {
    return res.status(400).json({ ok: false, code: "TRANSFER_INVALID", errors: { reason: "Say why — the member reads this." } });
  }

  const dept = headOf(ctx)[0] ?? ticket.fromDept;
  const actor = ctx.user.displayName ?? ctx.user.username;
  const next = {
    ...ticket,
    status: "rejected",
    rejectionReason: reason,
    history: [
      ...(ticket.history ?? []),
      { action: "rejected", actor, details: `${departmentAbbr(dept)} rejected: ${reason}`, at: new Date().toISOString() },
    ],
  };
  try {
    if (!(await saveTicket(next))) return res.status(404).json({ ok: false, message: "Nothing was updated." });
  } catch {
    return noStore(res);
  }
  res.json({ ok: true, ticket: next });
});

/**
 * Process it: the receiving department assigns a rank and completes the move.
 *
 * Refused until both departments have signed. That is the point of the dual
 * approval — a member cannot be moved because one side was keen.
 */
router.post("/:id/process", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const ticket = await loadTicket(str(req.params.id));
  if (!ticket) return res.status(404).json({ ok: false, message: "No such transfer." });
  if (!canManageTicket(ticket, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "You do not sign for either department on this transfer." });
  }
  if (isTerminal(ticket.status)) {
    return res.status(409).json({ ok: false, code: "TRANSFER_CLOSED", message: `That transfer is already ${ticket.status}.` });
  }
  if (!approvalState(ticket).both) {
    return res.status(409).json({
      ok: false,
      code: "TRANSFER_UNAPPROVED",
      message: "Both departments have to sign before it can be processed.",
    });
  }

  const assignedRank = str(req.body?.assignedRank).slice(0, 128).trim();
  if (!assignedRank) {
    return res.status(400).json({ ok: false, code: "TRANSFER_INVALID", errors: { assignedRank: "Pick the rank they start on." } });
  }
  const employmentType = EMPLOYMENT_TYPES.some((t) => t.id === req.body?.employmentType)
    ? req.body.employmentType
    : "fulltime";
  const retiredMember = req.body?.retiredMember === true;

  const actor = ctx.user.displayName ?? ctx.user.username;
  const label = EMPLOYMENT_TYPES.find((t) => t.id === employmentType).label;
  const next = {
    ...ticket,
    status: "completed",
    assignedRank,
    employmentType,
    retiredMember,
    history: [
      ...(ticket.history ?? []),
      {
        action: "completed",
        actor,
        details: `Processed by ${actor} · starts as ${assignedRank}, ${label}${retiredMember ? ", marked retired with the outgoing department" : ""}`,
        at: new Date().toISOString(),
      },
    ],
  };
  try {
    if (!(await saveTicket(next))) return res.status(404).json({ ok: false, message: "Nothing was updated." });
  } catch {
    return noStore(res);
  }
  res.json({ ok: true, ticket: next });
});

/** Close or reopen. Directorship only — it is the undo for everything above. */
router.post("/:id/state", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  if (!canCloseTicket(ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Only Directorship closes and reopens transfers." });
  }
  const ticket = await loadTicket(str(req.params.id));
  if (!ticket) return res.status(404).json({ ok: false, message: "No such transfer." });

  const action = req.body?.action;
  if (action !== "close" && action !== "reopen") {
    return res.status(400).json({ ok: false, message: "That is either close or reopen." });
  }
  const actor = ctx.user.displayName ?? ctx.user.username;
  const next = {
    ...ticket,
    status: action === "close" ? "closed" : "pending",
    history: [
      ...(ticket.history ?? []),
      {
        action: action === "close" ? "closed" : "reopened",
        actor,
        details: action === "close" ? "Ticket closed" : "Ticket reopened for review",
        at: new Date().toISOString(),
      },
    ],
  };
  try {
    if (!(await saveTicket(next))) return res.status(404).json({ ok: false, message: "Nothing was updated." });
  } catch {
    return noStore(res);
  }
  res.json({ ok: true, ticket: next });
});

/* ------------------------------------------------------------------ *
 * Chat
 * ------------------------------------------------------------------ */

/**
 * Both threads, or only the public one.
 *
 * The internal thread is filtered out in the query rather than in the client,
 * because a staff note that reaches the browser has already leaked whatever it
 * says — hiding it in the UI afterwards is not a control.
 */
router.get("/:id/messages", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const ticket = await loadTicket(str(req.params.id));
  if (!ticket) return res.status(404).json({ ok: false, message: "No such transfer." });
  if (!canViewTicket(ticket, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That transfer is not yours to read." });
  }

  const internal = canManageTicket(ticket, ctx);
  try {
    const rows = await query(
      `SELECT id, internal, author_id AS authorId, author_name AS authorName, body, created_at AS createdAt
         FROM transfer_messages
        WHERE transfer_id = ?${internal ? "" : " AND internal = 0"}
        ORDER BY created_at ASC
        LIMIT 500`,
      [ticket.id],
    );
    return res.json({ messages: rows.map((row) => ({ ...row, internal: Boolean(row.internal) })) });
  } catch {
    return res.json({
      messages: seed.MESSAGES.filter((m) => m.transferId === ticket.id && (internal || !m.internal)),
    });
  }
});

/** Post one. Which thread is decided here, never taken on trust from the body. */
router.post("/:id/messages", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const ticket = await loadTicket(str(req.params.id));
  if (!ticket) return res.status(404).json({ ok: false, message: "No such transfer." });
  if (!canViewTicket(ticket, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That transfer is not yours to read." });
  }

  const body = str(req.body?.body).slice(0, 2000).trim();
  if (!body) return res.status(400).json({ ok: false, message: "The message is empty." });

  // Asking for the internal thread without the standing to use it is a denial,
  // not a quiet downgrade to the public one — silently posting a staff note
  // where the member can read it is the worse failure.
  const wantsInternal = req.body?.internal === true;
  if (wantsInternal && !canManageTicket(ticket, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "The internal thread is for the two departments only." });
  }

  const message = {
    id: `tm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    transferId: ticket.id,
    internal: wantsInternal,
    authorId: ctx.user.id,
    authorName: ctx.user.displayName ?? ctx.user.username ?? "Unknown",
    body,
    createdAt: new Date().toISOString(),
  };

  try {
    await query(
      `INSERT INTO transfer_messages (id, transfer_id, internal, author_id, author_name, body)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [message.id, ticket.id, message.internal ? 1 : 0, message.authorId, message.authorName, body],
    );
  } catch {
    return noStore(res);
  }
  res.status(201).json({ ok: true, message });
});

/* ------------------------------------------------------------------ *
 * Presence
 * ------------------------------------------------------------------ */

const PRESENCE_TTL_SECONDS = 25;

/**
 * Who else has this ticket open.
 *
 * One call does both halves: it records that the caller is here and answers
 * with everybody who is. The original polled two endpoints on the same timer,
 * which doubled the traffic to say the same thing.
 */
router.post("/:id/presence", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const ticket = await loadTicket(str(req.params.id));
  if (!ticket) return res.status(404).json({ ok: false, message: "No such transfer." });
  if (!canViewTicket(ticket, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That transfer is not yours to read." });
  }

  const name = ctx.user.displayName ?? ctx.user.username ?? "Unknown";
  try {
    await query(
      `INSERT INTO transfer_viewers (transfer_id, viewer_id, viewer_name)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE viewer_name = VALUES(viewer_name), last_seen = CURRENT_TIMESTAMP`,
      [ticket.id, ctx.user.id, name],
    );
    const rows = await query(
      `SELECT viewer_id AS id, viewer_name AS name
         FROM transfer_viewers
        WHERE transfer_id = ? AND last_seen > (NOW() - INTERVAL ? SECOND)
        ORDER BY viewer_name`,
      [ticket.id, PRESENCE_TTL_SECONDS],
    );
    return res.json({ viewers: rows });
  } catch {
    // Without a database there is nobody to be present with. Reporting just the
    // caller would be inventing company.
    return res.json({ viewers: [] });
  }
});

/* ------------------------------------------------------------------ *
 * Webhook settings
 * ------------------------------------------------------------------ */

async function loadWebhooks() {
  const configs = Object.fromEntries(
    TRANSFER_DEPARTMENT_IDS.map((id) => [id, { ...DEFAULT_WEBHOOK }]),
  );
  try {
    const rows = await query("SELECT department_id AS id, config FROM transfer_webhooks");
    rows.forEach((row) => {
      if (configs[row.id]) configs[row.id] = { ...DEFAULT_WEBHOOK, ...parseJson(row.config, {}) };
    });
  } catch {
    // No database — the defaults stand, with no URL, so nothing is sent.
  }
  return configs;
}

/**
 * The configuration, with the URLs withheld.
 *
 * A webhook URL is a credential: anybody holding it can post into that channel
 * as the department, forever, with no further authentication. So the API answers
 * with whether one is set, never with what it is — even to the Directorship
 * that just typed it in.
 */
router.get("/settings/webhooks", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  if (!isManagement(ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Webhook settings are Directorship only." });
  }
  const configs = await loadWebhooks();
  const redacted = Object.fromEntries(
    Object.entries(configs).map(([id, config]) => [id, { ...config, url: undefined, hasUrl: Boolean(config.url) }]),
  );
  res.json({ webhooks: redacted, variables: DEFAULT_WEBHOOK });
});

/** Save one department's configuration. */
router.put("/settings/webhooks/:deptId", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  if (!isManagement(ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Webhook settings are Directorship only." });
  }
  const deptId = str(req.params.deptId);
  if (!TRANSFER_DEPARTMENT_IDS.includes(deptId)) {
    return res.status(400).json({ ok: false, message: "No such department." });
  }

  const incoming = req.body?.config ?? {};
  const existing = (await loadWebhooks())[deptId];

  // An empty url means "leave it alone" — the client never received the real
  // one, so it cannot send it back, and treating blank as a deletion would wipe
  // the webhook every time somebody edited the footer.
  let url = existing.url;
  if (typeof incoming.url === "string" && incoming.url.trim()) {
    url = cleanWebhookUrl(incoming.url);
    if (url === null) {
      return res.status(400).json({
        ok: false,
        code: "TRANSFER_BAD_WEBHOOK",
        errors: { url: "That is not a Discord webhook URL." },
      });
    }
  }
  if (incoming.clearUrl === true) url = "";

  const config = {
    url,
    username: str(incoming.username).slice(0, 80),
    avatarUrl: str(incoming.avatarUrl).slice(0, 512),
    color: /^#?[0-9a-f]{6}$/i.test(String(incoming.color ?? "")) ? String(incoming.color) : "",
    embedTitle: str(incoming.embedTitle).slice(0, 256),
    embedDescription: str(incoming.embedDescription).slice(0, 4000),
    footer: str(incoming.footer).slice(0, 2048),
    footerIconUrl: str(incoming.footerIconUrl).slice(0, 512),
  };

  try {
    await query(
      `INSERT INTO transfer_webhooks (department_id, config, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE config = VALUES(config), updated_by = VALUES(updated_by)`,
      [deptId, JSON.stringify(config), ctx.user.id],
    );
  } catch {
    return noStore(res);
  }
  res.json({ ok: true, config: { ...config, url: undefined, hasUrl: Boolean(config.url) } });
});

/** Send a sample to the configured webhook, so it is tested before it matters. */
router.post("/settings/webhooks/:deptId/test", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  if (!isManagement(ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Webhook settings are Directorship only." });
  }
  const deptId = str(req.params.deptId);
  const config = (await loadWebhooks())[deptId];
  if (!config?.url) {
    return res.status(400).json({ ok: false, message: "No webhook URL is set for that department." });
  }

  const sample = {
    id: "TR-SAMPLE",
    memberName: ctx.user.displayName ?? "A Member",
    memberDiscordId: ctx.user.id,
    currentRank: "Sergeant",
    fromDept: deptId,
    toDept: TRANSFER_DEPARTMENT_IDS.find((id) => id !== deptId),
    reason: "This is a test from the transfer portal's settings page.",
    createdAt: new Date().toISOString(),
  };

  const outcome = await postWebhook(config, sample);
  if (!outcome.ok) return res.status(502).json({ ok: false, message: outcome.message });
  res.json({ ok: true, message: "Sent. Check the channel." });
});

/** One POST to Discord. Never throws — the caller decides what a failure means. */
async function postWebhook(config, ticket) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(config.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildWebhookPayload(config, ticket)),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (response.ok) return { ok: true };
    return { ok: false, message: `Discord answered ${response.status}.` };
  } catch (err) {
    return { ok: false, message: String(err?.message ?? "The webhook could not be reached.").slice(0, 200) };
  }
}

/** Notify both departments that a ticket exists. Failures are logged, never raised. */
async function notifyDepartments(ticket) {
  const configs = await loadWebhooks();
  for (const dept of [...new Set([ticket.fromDept, ticket.toDept])]) {
    const config = configs[dept];
    if (!config?.url) continue;
    const outcome = await postWebhook(config, ticket);
    if (!outcome.ok) console.error(`[transfers] ${dept} webhook: ${outcome.message}`);
  }
}

export default router;
