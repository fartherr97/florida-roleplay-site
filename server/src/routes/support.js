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
import { rankFor, resolveUser } from "../middleware/requireRole.js";
import { permissionsFor } from "../permissions.js";
import { fetchGuildMembers } from "../lib/discord.js";
import { str } from "../validate.js";
import {
  DEFAULT_TICKET_TYPES,
  PRIORITY_MAP,
  STATUS_MAP,
  canConfigureTypes,
  canOpenType,
  canViewTicket,
  canWorkTicket,
  cleanDetails,
  isAgent,
  isSupportLead,
  makeTicketId,
  normalizeFlow,
  normalizeTicketTypes,
  typeMapOf,
  validateFlow,
  validateTicket,
  validateTicketType,
} from "../lib/support.js";

const router = Router();

/* ------------------------------------------------------------------ *
 * Context and loading
 * ------------------------------------------------------------------ */

async function contextFor(req) {
  const user = req.user ?? (await resolveUser(req));
  req.user = user;
  const roleKeys = user?.roles ?? [];
  return {
    user,
    roleKeys,
    permissions: permissionsFor(roleKeys, await loadGrants()),
    // The live ticket-category catalogue, so routing honours a renamed or newly
    // added department queue rather than only the built-in defaults.
    types: await loadTypes(),
  };
}

/**
 * The configured ticket categories, or the built-in defaults when none are
 * stored (or there is no database). One singleton row holds the whole ordered
 * catalogue, which keeps reordering and atomic edits trivial.
 */
async function loadTypes() {
  try {
    const rows = await query("SELECT document FROM support_type_config WHERE id = 'default' LIMIT 1");
    const stored = rows[0] ? normalizeTicketTypes(parseJson(rows[0].document, null)) : [];
    if (stored.length) return stored;
  } catch {
    // No database — the defaults stand, so the portal renders without one.
  }
  return DEFAULT_TICKET_TYPES;
}

/**
 * The name a member speaks under in a thread: their Discord display name in the
 * main guild — "100 | Owner | Mike" — which the bot already keeps in the format
 * the community uses. It is mirrored into the synced roster as display_name, so
 * that is the one source of truth here. Best-effort: with no roster row (or no
 * database) it falls back to the member's profile name, so nothing renders blank.
 */
async function rosterNameFor(user) {
  const fallback = user?.displayName ?? user?.username ?? "Unknown";
  try {
    const rows = await query(
      `SELECT display_name AS "displayName"
         FROM roster_members
        WHERE discord_id = $1 AND display_name IS NOT NULL AND display_name <> ''
        ORDER BY synced_at DESC LIMIT 1`,
      [user.id],
    );
    if (rows[0]?.displayName) return rows[0].displayName;
  } catch {
    // No database — the profile name stands.
  }
  return fallback;
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
  const agent = isAgent(ctx, ctx.types);

  if (req.query.scope === "mine" || !agent) {
    return res.json({ tickets: mine, scope: "mine", agent, lead: isSupportLead(ctx) });
  }

  // The queue, minus the categories this agent may not work — a department queue
  // is only theirs, and a staff report is not triaged by the staff team.
  const queue = all.filter((ticket) => canViewTicket(ticket, ctx, ctx.types));
  res.json({ tickets: queue, mine, scope: "queue", agent: true, lead: isSupportLead(ctx) });
});

/** One ticket, with what this caller may do to it. */
router.get("/:id", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const ticket = await loadTicket(str(req.params.id));
  if (!ticket) return res.status(404).json({ ok: false, message: "No such ticket." });
  if (!canViewTicket(ticket, ctx, ctx.types)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That ticket is not yours." });
  }
  res.json({
    ticket,
    can: { work: canWorkTicket(ticket, ctx, ctx.types), lead: isSupportLead(ctx) },
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

  const type = typeMapOf(ctx.types)[draft.type];
  if (!type || !canOpenType(type, ctx.permissions)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That is not a ticket type you can open." });
  }

  const { errors, ok } = validateTicket(draft, ctx.types);
  if (!ok) return res.status(400).json({ ok: false, code: "SUPPORT_INVALID", errors });

  const id = makeTicketId();
  const name = ctx.user.displayName ?? ctx.user.username ?? "Unknown";
  // The opener speaks in the thread under their roster name; the ticket itself
  // records their plain name, so the queue and the greeting read "Mike" rather
  // than "100 | Owner | Mike".
  const speakerName = await rosterNameFor(ctx.user);
  const details = cleanDetails(draft.type, draft.details, ctx.types);
  const history = [{ action: "opened", actor: name, details: type.label, at: new Date().toISOString() }];

  try {
    await query(`INSERT INTO support_tickets
         (id, type, subject, status, priority, details, opened_by_discord_id, opened_by_name, history, last_message_at)
       VALUES ($1, $2, $3, 'open', 'normal', $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [id, draft.type, draft.subject, JSON.stringify(details), ctx.user.id, name, JSON.stringify(history)],
    );
    // The opening message is the first post in the thread, so the conversation
    // reads as one rather than starting with a reply to something invisible.
    await query(`INSERT INTO support_messages (id, ticket_id, internal, author_id, author_name, author_role, author_avatar, body)
       VALUES ($1, $2, false, $3, $4, $5, $6, $7)`,
      [`sm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, id, ctx.user.id, speakerName, ctx.user.rank ?? null, ctx.user.avatar ?? null, draft.body],
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
  if (!canWorkTicket(ticket, ctx, ctx.types)) {
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
  if (!canViewTicket(ticket, ctx, ctx.types)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That ticket is not yours." });
  }

  const internal = canWorkTicket(ticket, ctx, ctx.types);
  try {
    const rows = await query(`SELECT id, internal, author_id AS "authorId", author_name AS "authorName",
              author_role AS "authorRole", author_avatar AS "authorAvatar", body,
              reply_to_id AS "replyToId", created_at AS "createdAt"
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
  if (!canViewTicket(ticket, ctx, ctx.types)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That ticket is not yours." });
  }
  if (ticket.status === "closed" && !canWorkTicket(ticket, ctx, ctx.types)) {
    return res.status(409).json({ ok: false, code: "SUPPORT_CLOSED", message: "This ticket is closed. Open a new one and reference this ID." });
  }

  const body = str(req.body?.body, 8000).trim();
  if (!body) return res.status(400).json({ ok: false, message: "The message is empty." });

  const wantsInternal = req.body?.internal === true;
  if (wantsInternal && !canWorkTicket(ticket, ctx, ctx.types)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Internal notes are for the support team." });
  }

  const message = {
    id: `sm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ticketId: ticket.id,
    internal: wantsInternal,
    authorId: ctx.user.id,
    authorName: await rosterNameFor(ctx.user),
    authorRole: ctx.user.rank ?? null,
    authorAvatar: ctx.user.avatar ?? null,
    body,
    replyToId: str(req.body?.replyToId, 48) || null,
    createdAt: new Date().toISOString(),
  };

  try {
    await query(`INSERT INTO support_messages (id, ticket_id, internal, author_id, author_name, author_role, author_avatar, body, reply_to_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [message.id, ticket.id, Boolean(message.internal), message.authorId, message.authorName, message.authorRole, message.authorAvatar, body, message.replyToId],
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
 * Presence
 * ------------------------------------------------------------------ *
 *
 * Who is looking at a ticket, and who is mid-reply. The open page beats a
 * heartbeat here every few seconds carrying its typing state; the response is
 * the current set of viewers, so one call both check in and reads the room. It
 * is polled, not a socket: a support thread holds a handful of people, and the
 * cost of a socket server for that is not worth paying.
 */
router.post("/:id/presence", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const ticket = await loadTicket(str(req.params.id));
  if (!ticket) return res.status(404).json({ ok: false, message: "No such ticket." });
  if (!canViewTicket(ticket, ctx, ctx.types)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That ticket is not yours." });
  }

  const name = await rosterNameFor(ctx.user);
  const typing = req.body?.typing === true;
  const leaving = req.body?.leaving === true;

  try {
    if (leaving) {
      await execute("DELETE FROM support_presence WHERE ticket_id = $1 AND discord_id = $2", [ticket.id, ctx.user.id]);
    } else {
      await query(
        `INSERT INTO support_presence (ticket_id, discord_id, name, avatar, typing, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (ticket_id, discord_id)
         DO UPDATE SET name = EXCLUDED.name, avatar = EXCLUDED.avatar,
           typing = EXCLUDED.typing, updated_at = CURRENT_TIMESTAMP`,
        [ticket.id, ctx.user.id, name, ctx.user.avatar ?? null, typing],
      );
    }

    // A viewer who has not checked in for a while has closed the tab — drop them
    // so the room does not fill with ghosts.
    await execute("DELETE FROM support_presence WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '30 seconds'");

    const rows = await query(
      `SELECT discord_id AS "discordId", name, avatar,
              (typing AND updated_at > CURRENT_TIMESTAMP - INTERVAL '7 seconds') AS typing
         FROM support_presence
        WHERE ticket_id = $1 AND updated_at > CURRENT_TIMESTAMP - INTERVAL '20 seconds'
        ORDER BY updated_at DESC`,
      [ticket.id],
    );
    return res.json({
      ok: true,
      viewers: rows.map((row) => ({ ...row, typing: Boolean(row.typing), self: row.discordId === ctx.user.id })),
    });
  } catch {
    // No database — presence is best-effort, so report just the caller.
    return res.json({
      ok: true,
      viewers: leaving ? [] : [{ discordId: ctx.user.id, name, avatar: ctx.user.avatar ?? null, typing, self: true }],
    });
  }
});

/* ------------------------------------------------------------------ *
 * Assignable staff
 * ------------------------------------------------------------------ *
 *
 * Who a lead may hand a ticket to: the senior tiers — Admin, Sr. Admin, Head
 * Admin, Directorship and Ownership — read straight from the roles people hold,
 * so the list follows promotions and demotions with nothing to maintain. The
 * callsign is filled in from the synced roster when there is one, so an option
 * reads "100 | Owner | Mike".
 */
// The permissions that make somebody a hand-off target: anyone who works the
// support queue at all, however their Discord roles are mapped. Keyed off the
// permission rather than a fixed rank, so a community that grants support.work
// to its own "Support Team" role sees those people here without renaming a thing.
const ASSIGNABLE_PERMISSIONS = ["support.work", "support.manage", "support.escalated"];

/**
 * Discord roles whose holders can be assigned a support ticket. The reassign picker lists
 * everyone in the main guild holding any of these, by their main-guild display name.
 */
const ASSIGNABLE_ROLE_IDS = [
  "1534380748247666796",
  "1534911171319042159",
  "1542234301322629130",
];

let staffCache = { at: 0, list: null };
const STAFF_CACHE_MS = 60_000;

/**
 * The assignable staff, read live from the main guild so it is everyone holding one of the
 * roles — not only people who have signed into the site — and named by their real main-guild
 * display name ("100 | Owner | Mike"). Cached briefly. Returns null when the member list
 * cannot be read (no bot token, or the Server Members Intent is off), so the caller falls
 * back to what the database knows.
 */
async function assignableFromGuild() {
  if (staffCache.list && Date.now() - staffCache.at < STAFF_CACHE_MS) return staffCache.list;
  const members = await fetchGuildMembers().catch(() => null); // main guild (DISCORD_GUILD_ID)
  if (!members) return null;

  const wanted = new Set(ASSIGNABLE_ROLE_IDS);
  const staff = members
    .filter((m) => (m.roles ?? []).some((r) => wanted.has(String(r))))
    .map((m) => {
      const name = (m.nick && m.nick.trim()) || m.displayName || m.username || "Unknown";
      return { discordId: String(m.id), name, rank: null, avatar: m.avatar ?? null, label: name };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  staffCache = { at: Date.now(), list: staff };
  return staff;
}

/** Fallback when the guild can't be read live: the permission-holders the database knows. */
async function assignableFromDatabase() {
  const grants = await loadGrants();
  const roleKeys = new Set(["ownership"]); // ownership implicitly holds everything
  for (const perm of ASSIGNABLE_PERMISSIONS) {
    for (const key of grants[perm] ?? []) roleKeys.add(key);
  }

  const rows = await query(
    `SELECT u.id AS "discordId", u.display_name AS "displayName", u.username, u.avatar,
            ARRAY(SELECT role FROM user_roles WHERE user_id = u.id) AS roles,
            (SELECT display_name FROM roster_members
               WHERE discord_id = u.id AND display_name IS NOT NULL AND display_name <> ''
               ORDER BY synced_at DESC LIMIT 1) AS "rosterName"
       FROM users u
      WHERE EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = ANY($1))`,
    [[...roleKeys]],
  );

  return rows
    .map((row) => {
      const rank = rankFor(row.roles ?? []) ?? null;
      const name = row.displayName ?? row.username ?? "Unknown";
      return {
        discordId: row.discordId,
        name,
        rank,
        avatar: row.avatar ?? null,
        label: row.rosterName || (rank ? `${rank} | ${name}` : name),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

router.get("/staff/list", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  if (!isSupportLead(ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Reassigning to somebody else needs support.manage." });
  }

  try {
    const live = await assignableFromGuild();
    if (live) return res.json({ staff: live });
    return res.json({ staff: await assignableFromDatabase() });
  } catch {
    // No database and no live read — nothing to offer.
    return res.json({ staff: [] });
  }
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
  if (!isAgent(ctx, ctx.types)) {
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

/* ------------------------------------------------------------------ *
 * Ticket categories (configuration)
 * ------------------------------------------------------------------ *
 *
 * The catalogue is not sensitive to read — every signed-in member needs it to
 * open a ticket and to see a category's name on their own ticket. Editing it is
 * gated on `support.configure`. A two-segment path keeps it clear of the
 * `/:id` ticket route.
 */
router.get("/config/ticket-types", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  res.json({ types: ctx.types, canConfigure: canConfigureTypes(ctx) });
});

router.put("/config/ticket-types", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  if (!canConfigureTypes(ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Configuring ticket categories needs support.configure." });
  }

  const types = normalizeTicketTypes(req.body?.types);
  if (types.length === 0) {
    return res.status(400).json({ ok: false, code: "SUPPORT_TYPES_EMPTY", message: "Keep at least one ticket category." });
  }
  // An enabled category must be valid; a disabled one may be a work-in-progress.
  const problems = types.flatMap((type) =>
    type.enabled ? validateTicketType(type).map((p) => `${type.label || type.id}: ${p}`) : [],
  );
  if (problems.length) {
    return res.status(400).json({ ok: false, code: "SUPPORT_TYPES_INVALID", problems });
  }

  try {
    await query(`INSERT INTO support_type_config (id, document, updated_by)
       VALUES ('default', $1, $2)
       ON CONFLICT (id) DO UPDATE SET document = EXCLUDED.document, updated_by = EXCLUDED.updated_by`,
      [JSON.stringify(types), ctx.user.id],
    );
  } catch {
    return noStore(res);
  }
  res.json({ ok: true, types });
});

export default router;
