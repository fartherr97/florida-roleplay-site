/**
 * The /api/development router.
 *
 * A development request is a support ticket for a build: a member opens one for
 * a personal vehicle, a department livery or a script, and the dev team works it
 * to done. The split is the same as support — a member sees their own requests
 * and the public thread; the dev team sees the whole queue, the internal notes
 * and the controls. Alongside it sit the vehicle library (reference, with spawn
 * codes) and a suggestions/bug box.
 *
 * Every state change writes history, and internal notes are filtered out in the
 * query rather than hidden in the UI — a note that reaches the browser has
 * already leaked.
 */
import { Router } from "express";
import { execute, query, changedRows } from "../db.js";
import * as seed from "../devHubSeed.js";
import { loadGrants } from "../middleware/requirePermission.js";
import { rankFor, resolveUser } from "../middleware/requireRole.js";
import { permissionsFor } from "../permissions.js";
import { str } from "../validate.js";
import {
  DEFAULT_REQUEST_TYPES,
  DEV_PRIORITY_MAP,
  DEV_STATUS_MAP,
  FEEDBACK_TYPE_MAP,
  canManageDev,
  canOpenRequest,
  cleanRequestDetails,
  isDevTeam,
  makeRequestId,
  normalizeRequestTypes,
  requestTypeMapOf,
  validateFeedback,
  validateRequest,
  validateRequestType,
} from "../lib/devhub.js";

const router = Router();

/* ------------------------------------------------------------------ *
 * Context
 * ------------------------------------------------------------------ */

async function contextFor(req) {
  const user = req.user ?? (await resolveUser(req));
  req.user = user;
  const roleKeys = user?.roles ?? [];
  return { user, roleKeys, permissions: permissionsFor(roleKeys, await loadGrants()) };
}

function requireSignIn(ctx, res) {
  if (ctx.user) return false;
  res.status(403).json({ ok: false, code: "AUTH_SIGNED_OUT", message: "Sign in with Discord to use the Development Hub." });
  return true;
}

function noStore(res) {
  return res.status(503).json({
    ok: false,
    code: "DEV_NO_STORE",
    message: "The Development Hub needs a database to record that. Nothing was written.",
  });
}

function parseJson(value, fallback) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** The member's guild display name — "100 | Owner | Mike" — for thread posts. */
async function rosterNameFor(user) {
  const fallback = user?.displayName ?? user?.username ?? "Unknown";
  try {
    const rows = await query(
      `SELECT display_name AS "displayName" FROM roster_members
        WHERE discord_id = $1 AND display_name IS NOT NULL AND display_name <> ''
        ORDER BY synced_at DESC LIMIT 1`,
      [user.id],
    );
    if (rows[0]?.displayName) return rows[0].displayName;
  } catch {
    /* no database */
  }
  return fallback;
}

/**
 * The live request-type catalogue: the stored document if the manager has edited
 * it, otherwise the built-in defaults. One singleton row holds the whole ordered
 * catalogue.
 */
async function loadTypes() {
  try {
    const rows = await query("SELECT document FROM dev_type_config WHERE id = 'default' LIMIT 1");
    const stored = rows[0] ? normalizeRequestTypes(parseJson(rows[0].document, null)) : [];
    if (stored.length) return stored;
  } catch {
    // No database — the defaults stand.
  }
  return DEFAULT_REQUEST_TYPES;
}

/* ------------------------------------------------------------------ *
 * Requests
 * ------------------------------------------------------------------ */

const REQUEST_COLUMNS = `
  id, type, subject, status, priority, department, details,
  opened_by_discord_id AS "openedByDiscordId", opened_by_name AS "openedByName",
  assigned_to_discord_id AS "assignedToDiscordId", assigned_to_name AS "assignedToName",
  history, last_message_at AS "lastMessageAt", created_at AS "createdAt", updated_at AS "updatedAt"`;

function shapeRequest(row) {
  return { ...row, details: parseJson(row.details, {}), history: parseJson(row.history, []) };
}

async function loadRequests() {
  try {
    const rows = await query(
      `SELECT ${REQUEST_COLUMNS} FROM dev_requests ORDER BY COALESCE(last_message_at, created_at) DESC LIMIT 1000`,
    );
    if (rows.length) return rows.map(shapeRequest);
  } catch {
    /* no database — the seeds stand */
  }
  return seed.REQUESTS;
}

async function loadRequest(id) {
  return (await loadRequests()).find((r) => r.id === id) ?? null;
}

/** Whether this caller may see a request: the opener, or the dev team. */
function canViewRequest(request, ctx) {
  if (!request) return false;
  if (request.openedByDiscordId && request.openedByDiscordId === ctx.user?.id) return true;
  return isDevTeam(ctx);
}

function withHistory(request, entry) {
  return [...(request.history ?? []), { ...entry, at: new Date().toISOString() }];
}

/** A member's own requests, or the whole queue for the dev team. */
router.get("/", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;

  const all = await loadRequests();
  const mine = all.filter((r) => r.openedByDiscordId === ctx.user.id);
  const team = isDevTeam(ctx);

  if (req.query.scope === "mine" || !team) {
    return res.json({ requests: mine, scope: "mine", team });
  }
  res.json({ requests: all, mine, scope: "queue", team: true });
});

/** One request, with what this caller may do to it. */
router.get("/requests/:id", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const request = await loadRequest(str(req.params.id));
  if (!request) return res.status(404).json({ ok: false, message: "No such request." });
  if (!canViewRequest(request, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That request is not yours." });
  }
  res.json({ request, can: { work: isDevTeam(ctx), manage: canManageDev(ctx) } });
});

/** Open a request. */
router.post("/", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;

  const types = await loadTypes();
  const body = req.body ?? {};
  const draft = {
    type: str(body.type, 48),
    subject: str(body.subject, 200).trim(),
    body: str(body.body, 8000).trim(),
    details: body.details ?? {},
  };

  const type = requestTypeMapOf(types)[draft.type];
  if (!type || !canOpenRequest(type, ctx.permissions)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That is not a request you can open." });
  }

  const { errors, ok } = validateRequest(draft, types);
  if (!ok) return res.status(400).json({ ok: false, code: "DEV_INVALID", errors });

  const id = makeRequestId();
  const name = ctx.user.displayName ?? ctx.user.username ?? "Unknown";
  const speakerName = await rosterNameFor(ctx.user);
  const details = cleanRequestDetails(draft.type, draft.details, types);
  const department = str(details.department, 32) || null;
  const history = [{ action: "opened", actor: name, details: type.label, at: new Date().toISOString() }];

  const greeting =
    `Thanks for your request. Please don't purchase any vehicles, roles or store items for this ` +
    `until a team member tells you to — buying early can delay the request or need redoing. ` +
    `We'll review it and reply here.`;

  try {
    await query(
      `INSERT INTO dev_requests
         (id, type, subject, status, priority, department, details, opened_by_discord_id, opened_by_name, history, last_message_at)
       VALUES ($1, $2, $3, 'pending', 'normal', $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
      [id, draft.type, draft.subject, department, JSON.stringify(details), ctx.user.id, name, JSON.stringify(history)],
    );
    // The opening message, then the team greeting, so the thread reads whole.
    await query(
      `INSERT INTO dev_request_messages (id, request_id, internal, author_id, author_name, author_role, author_avatar, body)
       VALUES ($1, $2, false, $3, $4, $5, $6, $7)`,
      [`drm-${Date.now().toString(36)}-a`, id, ctx.user.id, speakerName, ctx.user.rank ?? null, ctx.user.avatar ?? null, draft.body],
    );
    await query(
      `INSERT INTO dev_request_messages (id, request_id, internal, author_id, author_name, body)
       VALUES ($1, $2, false, NULL, $3, $4)`,
      [`drm-${Date.now().toString(36)}-b`, id, "FLRP Dev Hub", greeting],
    );
  } catch {
    return noStore(res);
  }

  res.status(201).json({
    ok: true,
    request: { id, ...draft, details, department, status: "pending", priority: "normal", openedByName: name, history },
  });
});

/** Status, priority and assignment — the dev team's rail. */
router.patch("/requests/:id", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const request = await loadRequest(str(req.params.id));
  if (!request) return res.status(404).json({ ok: false, message: "No such request." });
  if (!isDevTeam(ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Only the dev team changes a request." });
  }

  const body = req.body ?? {};
  const actor = ctx.user.displayName ?? ctx.user.username;
  let history = request.history ?? [];
  const next = {
    status: request.status,
    priority: request.priority,
    assignedToDiscordId: request.assignedToDiscordId,
    assignedToName: request.assignedToName,
  };

  if (body.status && body.status !== request.status) {
    if (!DEV_STATUS_MAP[body.status]) return res.status(400).json({ ok: false, message: "No such status." });
    next.status = body.status;
    history = withHistory({ history }, { action: "status", actor, details: `${DEV_STATUS_MAP[request.status]?.label ?? request.status} → ${DEV_STATUS_MAP[body.status].label}` });
  }
  if (body.priority && body.priority !== request.priority) {
    if (!DEV_PRIORITY_MAP[body.priority]) return res.status(400).json({ ok: false, message: "No such priority." });
    next.priority = body.priority;
    history = withHistory({ history }, { action: "priority", actor, details: `set to ${DEV_PRIORITY_MAP[body.priority].label}` });
  }
  if (body.assign === "me") {
    next.assignedToDiscordId = ctx.user.id;
    next.assignedToName = await rosterNameFor(ctx.user);
    history = withHistory({ history }, { action: "assigned", actor, details: "took the request" });
  } else if (body.assign === "none") {
    next.assignedToDiscordId = null;
    next.assignedToName = null;
    history = withHistory({ history }, { action: "assigned", actor, details: "put it back in the queue" });
  }

  try {
    const result = await execute(
      `UPDATE dev_requests SET status = $1, priority = $2, assigned_to_discord_id = $3, assigned_to_name = $4, history = $5 WHERE id = $6`,
      [next.status, next.priority, next.assignedToDiscordId, next.assignedToName, JSON.stringify(history), request.id],
    );
    if (!changedRows(result)) return res.status(404).json({ ok: false, message: "Nothing was updated." });
  } catch {
    return noStore(res);
  }
  res.json({ ok: true, request: { ...request, ...next, history } });
});

/* ------------------------------------------------------------------ *
 * Thread
 * ------------------------------------------------------------------ */

router.get("/requests/:id/messages", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const request = await loadRequest(str(req.params.id));
  if (!request) return res.status(404).json({ ok: false, message: "No such request." });
  if (!canViewRequest(request, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That request is not yours." });
  }

  const internal = isDevTeam(ctx);
  try {
    const rows = await query(
      `SELECT id, internal, author_id AS "authorId", author_name AS "authorName",
              author_role AS "authorRole", author_avatar AS "authorAvatar", body,
              reply_to_id AS "replyToId", created_at AS "createdAt"
         FROM dev_request_messages
        WHERE request_id = $1${internal ? "" : " AND internal = false"}
        ORDER BY created_at ASC LIMIT 500`,
      [request.id],
    );
    return res.json({ messages: rows.map((row) => ({ ...row, internal: Boolean(row.internal) })) });
  } catch {
    return res.json({ messages: seed.MESSAGES.filter((m) => m.requestId === request.id && (internal || !m.internal)) });
  }
});

router.post("/requests/:id/messages", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const request = await loadRequest(str(req.params.id));
  if (!request) return res.status(404).json({ ok: false, message: "No such request." });
  if (!canViewRequest(request, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That request is not yours." });
  }
  if (request.status === "closed" && !isDevTeam(ctx)) {
    return res.status(409).json({ ok: false, code: "DEV_CLOSED", message: "This request is closed. Open a new one and reference this ID." });
  }

  const body = str(req.body?.body, 8000).trim();
  if (!body) return res.status(400).json({ ok: false, message: "The message is empty." });

  const wantsInternal = req.body?.internal === true;
  if (wantsInternal && !isDevTeam(ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Internal notes are for the dev team." });
  }

  const message = {
    id: `drm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    requestId: request.id,
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
    await query(
      `INSERT INTO dev_request_messages (id, request_id, internal, author_id, author_name, author_role, author_avatar, body, reply_to_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [message.id, request.id, Boolean(message.internal), message.authorId, message.authorName, message.authorRole, message.authorAvatar, body, message.replyToId],
    );
    if (!message.internal) {
      await query("UPDATE dev_requests SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1", [request.id]);
    }
  } catch {
    return noStore(res);
  }
  res.status(201).json({ ok: true, message });
});

/* ------------------------------------------------------------------ *
 * Vehicle library
 * ------------------------------------------------------------------ */

const VEHICLE_COLUMNS = `
  id, name, year, developer, spawn_code AS "spawnCode", available,
  category, image_url AS "image", source_url AS "source"`;

async function loadVehicles() {
  try {
    const rows = await query(`SELECT ${VEHICLE_COLUMNS} FROM dev_vehicles ORDER BY sort_order, name`);
    if (rows.length) return rows.map((r) => ({ ...r, available: Boolean(r.available) }));
  } catch {
    /* no database */
  }
  return seed.VEHICLES;
}

/** The vehicle library — public to anyone signed in. */
router.get("/vehicles", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  res.json({ vehicles: await loadVehicles(), canManage: canManageDev(ctx) });
});

router.put("/vehicles/:id", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  if (!canManageDev(ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Managing the vehicle library needs development.manage." });
  }
  const b = req.body ?? {};
  const vehicle = {
    id: str(req.params.id, 64) || `veh-${Date.now().toString(36)}`,
    name: str(b.name, 160).trim(),
    year: str(b.year, 8),
    developer: str(b.developer, 160),
    spawnCode: str(b.spawnCode, 80),
    available: b.available !== false,
    category: str(b.category, 48),
    image: str(b.image, 2000),
    source: str(b.source, 2000),
    sortOrder: Number.isFinite(b.sortOrder) ? b.sortOrder : 0,
  };
  if (!vehicle.name) return res.status(400).json({ ok: false, message: "A vehicle needs a name." });

  try {
    await query(
      `INSERT INTO dev_vehicles (id, name, year, developer, spawn_code, available, category, image_url, source_url, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, year = EXCLUDED.year, developer = EXCLUDED.developer,
         spawn_code = EXCLUDED.spawn_code, available = EXCLUDED.available, category = EXCLUDED.category,
         image_url = EXCLUDED.image_url, source_url = EXCLUDED.source_url, sort_order = EXCLUDED.sort_order`,
      [vehicle.id, vehicle.name, vehicle.year, vehicle.developer, vehicle.spawnCode, vehicle.available, vehicle.category, vehicle.image, vehicle.source, vehicle.sortOrder],
    );
  } catch {
    return noStore(res);
  }
  res.json({ ok: true, vehicle });
});

router.delete("/vehicles/:id", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  if (!canManageDev(ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Managing the vehicle library needs development.manage." });
  }
  try {
    const result = await execute("DELETE FROM dev_vehicles WHERE id = $1", [str(req.params.id, 64)]);
    if (!changedRows(result)) return res.status(404).json({ ok: false, message: "No such vehicle." });
  } catch {
    return noStore(res);
  }
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ *
 * Feedback (suggestions and bug reports)
 * ------------------------------------------------------------------ */

router.get("/feedback", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  if (!isDevTeam(ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Submitted feedback is read by the dev team." });
  }
  try {
    const rows = await query(
      `SELECT id, type, title, body, status, opened_by_name AS "openedByName", created_at AS "createdAt"
         FROM dev_feedback ORDER BY created_at DESC LIMIT 500`,
    );
    return res.json({ feedback: rows });
  } catch {
    return res.json({ feedback: seed.DEV_FEEDBACK });
  }
});

router.post("/feedback", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  const b = req.body ?? {};
  const draft = { type: str(b.type, 24), title: str(b.title, 200).trim(), body: str(b.body, 8000).trim() };
  if (!FEEDBACK_TYPE_MAP[draft.type]) draft.type = "other";
  const { errors, ok } = validateFeedback(draft);
  if (!ok) return res.status(400).json({ ok: false, code: "DEV_INVALID", errors });

  const name = ctx.user.displayName ?? ctx.user.username ?? "Unknown";
  try {
    await query(
      `INSERT INTO dev_feedback (type, title, body, opened_by_discord_id, opened_by_name)
       VALUES ($1, $2, $3, $4, $5)`,
      [draft.type, draft.title, draft.body, ctx.user.id, name],
    );
  } catch {
    return noStore(res);
  }
  res.status(201).json({ ok: true });
});

/* ------------------------------------------------------------------ *
 * Request-type catalogue
 * ------------------------------------------------------------------ */

router.get("/config/request-types", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  res.json({ types: await loadTypes(), canManage: canManageDev(ctx) });
});

router.put("/config/request-types", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  if (!canManageDev(ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Configuring request categories needs development.manage." });
  }

  const types = normalizeRequestTypes(req.body?.types);
  if (types.length === 0) {
    return res.status(400).json({ ok: false, code: "DEV_TYPES_EMPTY", message: "Keep at least one request category." });
  }
  const problems = types.flatMap((type) =>
    type.enabled ? validateRequestType(type).map((p) => `${type.label || type.id}: ${p}`) : [],
  );
  if (problems.length) {
    return res.status(400).json({ ok: false, code: "DEV_TYPES_INVALID", problems });
  }

  try {
    await query(
      `INSERT INTO dev_type_config (id, document, updated_by)
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
