/**
 * The /api/support router.
 *
 * Two audiences, and the split between them is the design. A member sees their
 * own tickets, the public thread, and the status. An agent sees the queue, the
 * internal notes, and the controls that change either.
 *
 * The rule that matters: **the internal thread is filtered out in the query.**
 * A staff note that reaches the browser has already leaked whatever it says, so
 * hiding it in the UI afterwards is not a control. Asking to post one without
 * the standing is a denial rather than a quiet downgrade to the public thread —
 * silently publishing a staff note where the member reads it is the worse
 * failure of the two.
 *
 * The second rule: every state change writes history. Who reassigned a ticket
 * and when is the first thing anybody asks when one goes wrong.
 */
import { Router } from "express";
import { execute, query, changedRows } from "../db.js";
import * as seed from "../supportSeed.js";
import { loadGrants } from "../middleware/requirePermission.js";
import { resolveUser } from "../middleware/requireRole.js";
import { permissionsFor } from "../permissions.js";
import { str } from "../validate.js";
import {
  PRIORITY_MAP,
  STATUS_MAP,
  TYPE_MAP,
  canViewTicket,
  canWorkTicket,
  cleanDetails,
  isAgent,
  isSupportLead,
  makeTicketId,
  normalizeFlow,
  validateFlow,
  validateTicket,
} from "../lib/support.js";

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

function requireSignIn(ctx, res) {
  if (ctx.user) return false;
  res.status(403).json({ ok: false, code: "AUTH_SIGNED_OUT", message: "Sign in with Discord to use support." });
  return true;
}

function parseJson(value, fallback) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const TICKET_COLUMNS = `
  id, type, subject, status, priority, details,
  opened_by_discord_id AS "openedByDiscordId", opened_by_name AS "openedByName",
  assigned_to_discord_id AS "assignedToDiscordId", assigned_to_name AS "assignedToName",
  history, last_message_at AS "lastMessageAt", created_at AS "createdAt", updated_at AS "updatedAt"`;

function shapeTicket(row) {
  return { ...row, details: parseJson(row.details, {}), history: parseJson(row.history, []) };
}

async function loadTickets() {
  try {
    const rows = await query(`SELECT ${TICKET_COLUMNS} FROM support_tickets ORDER BY COALESCE(last_message_at, created_at) DESC LIMIT 1000`,
    );
    if (rows.length) return rows.map(shapeTicket);
  } catch {
    // No database — the seeds stand, so the portal renders without one.
  }
  return seed.TICKETS;
}

async function loadTicket(id) {
  return (await loadTickets()).find((ticket) => ticket.id === id) ?? null;
}

function noStore(res) {
  return res.status(503).json({
    ok: false,
    code: "SUPPORT_NO_STORE",
    message: "Support needs a database to record that. Nothing was written.",
  });
}

/** Appends to a ticket's history and persists it alongside whatever changed. */
function withHistory(ticket, entry) {
  return [...(ticket.history ?? []), { ...entry, at: new Date().toISOString() }];
}

/* ------------------------------------------------------------------ *
 * Tickets
 * ------------------------------------------------------------------ */

/**
 * A member's own tickets, or the whole queue for an agent.
 *
 * `scope=mine` is what the member's own page asks for even when they are an
 * agent — somebody working support still needs to see the tickets they opened
 * as a person.
 */
router.get("/", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;

  const all = await loadTickets();
  const mine = all.filter((t) => t.openedByDiscordId === ctx.user.id);

  if (req.query.scope === "mine" || !isAgent(ctx)) {
    return res.json({ tickets: mine, scope: "mine", agent: isAgent(ctx), lead: isSupportLead(ctx) });
  }

  // The queue, minus the types this agent may not work — a staff report is not
  // triaged by the staff team.
  const queue = all.filter((ticket) => canViewTicket(ticket, ctx));
  res.json({ tickets: queue, mine, scope: "queue", agent: true, lead: isSupportLead(ctx) });
});

/** One ticket, with what this caller may do to it. */
router.get("/:id", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const ticket = await loadTicket(str(req.params.id));
  if (!ticket) return res.status(404).json({ ok: false, message: "No such ticket." });
  if (!canViewTicket(ticket, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That ticket is not yours." });
  }
  res.json({
    ticket,
    can: { work: canWorkTicket(ticket, ctx), lead: isSupportLead(ctx) },
  });
});

/** Open one. */
router.post("/", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;

  const body = req.body ?? {};
  const draft = {
    type: str(body.type, 32),
    subject: str(body.subject, 200).trim(),
    body: str(body.body, 8000).trim(),
    details: body.details ?? {},
  };

  const type = TYPE_MAP[draft.type];
  if (type?.restrictedTo && !ctx.permissions.has(type.restrictedTo)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That is not a ticket type you can open." });
  }

  const { errors, ok } = validateTicket(draft);
  if (!ok) return res.status(400).json({ ok: false, code: "SUPPORT_INVALID", errors });

  const id = makeTicketId();
  const name = ctx.user.displayName ?? ctx.user.username ?? "Unknown";
  const details = cleanDetails(draft.type, draft.details);
  const history = [{ action: "opened", actor: name, details: TYPE_MAP[draft.type].label, at: new Date().toISOString() }];

  try {
    await query(`INSERT INTO support_tickets
         (id, type, subject, status, priority, details, opened_by_discord_id, opened_by_name, history, last_message_at)
       VALUES ($1, $2, $3, 'open', 'normal', $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [id, draft.type, draft.subject, JSON.stringify(details), ctx.user.id, name, JSON.stringify(history)],
    );
    // The opening message is the first post in the thread, so the conversation
    // reads as one rather than starting with a reply to something invisible.
    await query(`INSERT INTO support_messages (id, ticket_id, internal, author_id, author_name, body)
       VALUES ($1, $2, false, $3, $4, $5)`,
      [`sm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, id, ctx.user.id, name, draft.body],
    );
  } catch {
    return noStore(res);
  }

  res.status(201).json({ ok: true, ticket: { id, ...draft, details, status: "open", priority: "normal", openedByName: name, history } });
});

/**
 * Status, priority and assignment — the right-hand rail.
 *
 * One endpoint rather than three because they are one action in practice:
 * picking a ticket up usually means assigning it to yourself and moving it off
 * `open` in the same breath, and two round trips would leave a window where it
 * is assigned but untouched.
 */
router.patch("/:id", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const ticket = await loadTicket(str(req.params.id));
  if (!ticket) return res.status(404).json({ ok: false, message: "No such ticket." });
  if (!canWorkTicket(ticket, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Only the support team changes a ticket." });
  }

  const body = req.body ?? {};
  const actor = ctx.user.displayName ?? ctx.user.username;
  let history = ticket.history ?? [];
  const next = { status: ticket.status, priority: ticket.priority, assignedToDiscordId: ticket.assignedToDiscordId, assignedToName: ticket.assignedToName };

  if (body.status && body.status !== ticket.status) {
    if (!STATUS_MAP[body.status]) return res.status(400).json({ ok: false, message: "No such status." });
    next.status = body.status;
    history = withHistory({ history }, { action: "status", actor, details: `${STATUS_MAP[ticket.status]?.label ?? ticket.status} → ${STATUS_MAP[body.status].label}` });
  }

  if (body.priority && body.priority !== ticket.priority) {
    if (!PRIORITY_MAP[body.priority]) return res.status(400).json({ ok: false, message: "No such priority." });
    next.priority = body.priority;
    history = withHistory({ history }, { action: "priority", actor, details: `set to ${PRIORITY_MAP[body.priority].label}` });
  }

  // "claim" is the common case and needs no id — an agent taking a ticket.
  if (body.assign === "me") {
    next.assignedToDiscordId = ctx.user.id;
    next.assignedToName = actor;
    history = withHistory({ history }, { action: "assigned", actor, details: `took the ticket` });
  } else if (body.assign === "none") {
    next.assignedToDiscordId = null;
    next.assignedToName = null;
    history = withHistory({ history }, { action: "assigned", actor, details: "put it back in the queue" });
  } else if (body.assign && typeof body.assign === "object") {
    // Handing a ticket to somebody else is the lead's call — otherwise an agent
    // can clear their own queue by pushing everything onto a colleague.
    if (!isSupportLead(ctx)) {
      return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Reassigning to somebody else needs support.manage." });
    }
    const toId = str(body.assign.discordId).trim();
    if (!/^\d{17,20}$/.test(toId)) return res.status(400).json({ ok: false, message: "That is not a Discord ID." });
    next.assignedToDiscordId = toId;
    next.assignedToName = str(body.assign.name, 128) || toId;
    history = withHistory({ history }, { action: "assigned", actor, details: `handed to ${next.assignedToName}` });
  }

  try {
    const result = await execute(`UPDATE support_tickets
          SET status = $1, priority = $2, assigned_to_discord_id = $3, assigned_to_name = $4, history = $5
        WHERE id = $6`,
      [next.status, next.priority, next.assignedToDiscordId, next.assignedToName, JSON.stringify(history), ticket.id],
    );
    if (!changedRows(result)) return res.status(404).json({ ok: false, message: "Nothing was updated." });
  } catch {
    return noStore(res);
  }
  res.json({ ok: true, ticket: { ...ticket, ...next, history } });
});

/* ------------------------------------------------------------------ *
 * The thread
 * ------------------------------------------------------------------ */

router.get("/:id/messages", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const ticket = await loadTicket(str(req.params.id));
  if (!ticket) return res.status(404).json({ ok: false, message: "No such ticket." });
  if (!canViewTicket(ticket, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That ticket is not yours." });
  }

  const internal = canWorkTicket(ticket, ctx);
  try {
    const rows = await query(`SELECT id, internal, author_id AS "authorId", author_name AS "authorName",
              author_role AS "authorRole", body, reply_to_id AS "replyToId", created_at AS "createdAt"
         FROM support_messages
        WHERE ticket_id = $1${internal ? "" : " AND internal = false"}
        ORDER BY created_at ASC
        LIMIT 500`,
      [ticket.id],
    );
    return res.json({ messages: rows.map((row) => ({ ...row, internal: Boolean(row.internal) })) });
  } catch {
    return res.json({
      messages: seed.MESSAGES.filter((m) => m.ticketId === ticket.id && (internal || !m.internal)),
    });
  }
});

router.post("/:id/messages", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const ticket = await loadTicket(str(req.params.id));
  if (!ticket) return res.status(404).json({ ok: false, message: "No such ticket." });
  if (!canViewTicket(ticket, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That ticket is not yours." });
  }
  if (ticket.status === "closed" && !canWorkTicket(ticket, ctx)) {
    return res.status(409).json({ ok: false, code: "SUPPORT_CLOSED", message: "This ticket is closed. Open a new one and reference this ID." });
  }

  const body = str(req.body?.body, 8000).trim();
  if (!body) return res.status(400).json({ ok: false, message: "The message is empty." });

  const wantsInternal = req.body?.internal === true;
  if (wantsInternal && !canWorkTicket(ticket, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Internal notes are for the support team." });
  }

  const message = {
    id: `sm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ticketId: ticket.id,
    internal: wantsInternal,
    authorId: ctx.user.id,
    authorName: ctx.user.displayName ?? ctx.user.username ?? "Unknown",
    authorRole: ctx.user.rank ?? null,
    body,
    replyToId: str(req.body?.replyToId, 48) || null,
    createdAt: new Date().toISOString(),
  };

  try {
    await query(`INSERT INTO support_messages (id, ticket_id, internal, author_id, author_name, author_role, body, reply_to_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [message.id, ticket.id, Boolean(message.internal), message.authorId, message.authorName, message.authorRole, body, message.replyToId],
    );
    // An internal note is not the member replying, so it must not move the
    // ticket off "waiting on member" or bump it up the queue.
    if (!message.internal) {
      const isMember = ticket.openedByDiscordId === ctx.user.id;
      const nextStatus =
        isMember && ticket.status === "pending"
          ? "open"
          : !isMember && ticket.status === "open"
            ? "pending"
            : ticket.status;
      await query("UPDATE support_tickets SET last_message_at = CURRENT_TIMESTAMP, status = $1 WHERE id = $2",
        [nextStatus, ticket.id],
      );
    }
  } catch {
    return noStore(res);
  }
  res.status(201).json({ ok: true, message });
});

/* ------------------------------------------------------------------ *
 * Response flows
 * ------------------------------------------------------------------ */

async function loadFlows() {
  try {
    const rows = await query("SELECT document FROM support_flows ORDER BY name");
    if (rows.length) return rows.map((row) => normalizeFlow(parseJson(row.document, null))).filter((f) => f.id);
  } catch {
    // No database — the seeds stand.
  }
  return seed.FLOWS.map(normalizeFlow);
}

/** The flows an agent may walk. Not offered to members — these are staff tools. */
router.get("/flows/list", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  if (!isAgent(ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Response flows are a support team tool." });
  }
  res.json({ flows: await loadFlows(), canEdit: isSupportLead(ctx) });
});

router.put("/flows/:id", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  if (!isSupportLead(ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Editing flows needs support.manage." });
  }
  const flow = normalizeFlow({ ...(req.body?.flow ?? {}), id: str(req.params.id, 64) });
  const problems = validateFlow(flow);
  if (flow.enabled && problems.some((p) => p.level === "error")) {
    return res.status(400).json({ ok: false, code: "SUPPORT_FLOW_INVALID", problems });
  }

  try {
    await query(`INSERT INTO support_flows (id, name, enabled, document, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, enabled = EXCLUDED.enabled,
         document = EXCLUDED.document, updated_by = EXCLUDED.updated_by`,
      [flow.id, flow.name, Boolean(flow.enabled), JSON.stringify(flow), ctx.user.id],
    );
  } catch {
    return noStore(res);
  }
  res.json({ ok: true, flow, problems });
});

router.delete("/flows/:id", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  if (!isSupportLead(ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Editing flows needs support.manage." });
  }
  try {
    const result = await execute("DELETE FROM support_flows WHERE id = $1", [str(req.params.id, 64)]);
    if (!changedRows(result)) return res.status(404).json({ ok: false, message: "No such flow." });
  } catch {
    return noStore(res);
  }
  res.json({ ok: true });
});

export default router;
