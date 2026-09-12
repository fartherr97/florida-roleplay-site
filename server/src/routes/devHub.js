import {ensureMessageEdits,editMessage} from "../lib/messageEdits.js";
import { personalTypes, activeStatuses, modelApprover, liveryApprover, approvalViewer, approvalData, approveTicket, claimInTicket, ensureApprovals } from "../lib/devApprovals.js";
import { guildDisplayName as rosterNameFor, withGuildNames } from "../lib/guildDisplayName.js";
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
  VEHICLE_LIBRARIES,
  vehicleDisplayName,
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
  return isDevTeam(ctx) || approvalViewer(request,ctx);
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
  const team = isDevTeam(ctx) || liveryApprover(ctx);

  if (req.query.scope === "mine" || !team) {
    return res.json({ requests: mine, scope: "mine", team });
  }
  res.json({ requests: all.filter(r => canViewRequest(r,ctx)), mine, scope: "queue", team: true });
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
  try {
    const review = await approvalData(request.id);
    res.json({request,...review,can:{work:isDevTeam(ctx),manage:canManageDev(ctx),approveModel:modelApprover(ctx),approveLiveries:liveryApprover(ctx)}});
  } catch { return noStore(res); }
});

router.get('/claim-targets', async (req,res) => {
  const ctx=await contextFor(req); if(requireSignIn(ctx,res))return;
  try {
    const rows=await query(`SELECT id,subject,type FROM dev_requests WHERE opened_by_discord_id=$1 AND type=ANY($2::text[]) AND status=ANY($3::text[]) ORDER BY created_at DESC`,[ctx.user.id,personalTypes,activeStatuses]);
    res.json({requests:rows});
  } catch { return noStore(res); }
});
router.post('/requests/:id/approvals', async(req,res) => {
  const ctx=await contextFor(req);if(requireSignIn(ctx,res))return;
  try {res.json(await approveTicket(ctx,str(req.params.id,40),str(req.body?.kind,16),str(req.body?.action || 'approve',16),str(req.body?.approvalId,40)));}
  catch(error){res.status(error.status || 503).json({ok:false,message:error.status ? error.message : 'Approval could not be saved.'});}
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
    await ensureMessageEdits("development");
    const rows = await query(
      `SELECT id, internal, author_id AS "authorId", author_name AS "authorName",
              author_role AS "authorRole", author_avatar AS "authorAvatar", body,
              reply_to_id AS "replyToId", created_at AS "createdAt", edited_at AS "editedAt", NOT system_generated AS editable
         FROM dev_request_messages
        WHERE request_id = $1${internal ? "" : " AND internal = false"}
        ORDER BY created_at ASC LIMIT 500`,
      [request.id],
    );
    return res.json({ messages: await withGuildNames(rows) });
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
  id, name, year, make, model, developer, spawn_code AS "spawnCode", available,
  category, library, claimable, resource, confidence, notes, liveries,
  image_url AS "image", source_url AS "source", sort_order AS "sortOrder"`;

const CLAIM_COLUMNS = `
  c.request_id AS "requestId", c.id, c.vehicle_id AS "vehicleId", c.discord_id AS "discordId", c.member_name AS "memberName",
  c.status, c.note, c.decision_note AS "decisionNote", c.decided_by_name AS "decidedByName",
  c.decided_at AS "decidedAt", c.created_at AS "createdAt"`;

const LIBRARY_IDS = new Set(VEHICLE_LIBRARIES.map((l) => l.id));
const CONFIDENCE_IDS = new Set(["high", "medium", "low"]);

function clip(value, max) {
  return str(value).slice(0, max);
}

function shapeVehicle(row) {
  return {
    ...row,
    available: Boolean(row.available),
    claimable: Boolean(row.claimable),
    library: row.library || null,
    name: vehicleDisplayName(row),
  };
}

async function loadVehicles() {
  try {
    const rows = await query(`SELECT ${VEHICLE_COLUMNS} FROM dev_vehicles ORDER BY sort_order, name`);
    if (rows.length) return rows.map(shapeVehicle);
  } catch {
    /* no database */
  }
  return seed.VEHICLES.map(shapeVehicle);
}

async function loadVehicle(id) {
  try {
    const rows = await query(`SELECT ${VEHICLE_COLUMNS} FROM dev_vehicles WHERE id = $1 LIMIT 1`, [id]);
    return rows[0] ? shapeVehicle(rows[0]) : null;
  } catch {
    return null;
  }
}

/** Every pending or active claim: at most one per vehicle, by the partial unique index. */
async function loadOpenClaims() {
  try {
    return await query(
      `SELECT ${CLAIM_COLUMNS} FROM dev_vehicle_claims c
        WHERE c.status IN ('pending', 'active') ORDER BY c.created_at ASC LIMIT 2000`,
    );
  } catch {
    return [];
  }
}

/** A member's own claims, newest first, history included so a denial is visible. */
async function loadClaimsFor(discordId) {
  try {
    return await query(
      `SELECT ${CLAIM_COLUMNS} FROM dev_vehicle_claims c
        WHERE c.discord_id = $1 ORDER BY c.created_at DESC LIMIT 100`,
      [discordId],
    );
  } catch {
    return [];
  }
}

async function loadClaim(id) {
  try {
    const rows = await query(`SELECT ${CLAIM_COLUMNS} FROM dev_vehicle_claims c WHERE c.id = $1 LIMIT 1`, [id]);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** The public face of a claim: who holds it and since when, never their Discord id. */
function publicClaim(claim, ctx) {
  if (!claim) return null;
  return {
    id: claim.id,
    status: claim.status,
    memberName: claim.memberName,
    createdAt: claim.createdAt,
    mine: Boolean(ctx.user) && claim.discordId === ctx.user.id,
  };
}

/**
 * The library, public to anyone signed in. The spawn code of a claimable
 * personal is withheld unless the caller manages the hub, activates claims, or
 * holds the ACTIVATED claim on that very car. It is filtered here rather than
 * hidden in the UI, so a code that reaches the browser was already theirs.
 */
router.get("/vehicles", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;

  const canManage = canManageDev(ctx);
  const canActivate = modelApprover(ctx);
  const privileged = canManage || canActivate;
  try { await ensureApprovals(); } catch { return noStore(res); }
  const [vehicles, open, mine] = await Promise.all([loadVehicles(), loadOpenClaims(), loadClaimsFor(ctx.user.id)]);
  const byId = new Map(vehicles.map((v) => [v.id, v]));
  const openByVehicle = new Map(open.map((c) => [c.vehicleId, c]));

  const shaped = vehicles.map((v) => {
    const claim = openByVehicle.get(v.id) ?? null;
    const isMine = Boolean(claim) && claim.discordId === ctx.user.id;
    const showCode = !v.claimable || privileged || (isMine && claim.status === "active");
    const out = { ...v, spawnCode: showCode ? v.spawnCode : null, claim: publicClaim(claim, ctx) };
    if (!privileged) {
      delete out.notes;
      delete out.confidence;
      delete out.resource;
    }
    return out;
  });

  const withVehicle = (c) => {
    const v = byId.get(c.vehicleId);
    return {
      ...c,
      vehicle: v
        ? {
            id: v.id,
            name: v.name,
            year: v.year,
            make: v.make,
            model: v.model,
            library: v.library,
            liveries: v.liveries,
            spawnCode: c.status === "active" || privileged ? v.spawnCode : null,
          }
        : { id: c.vehicleId, name: "Removed vehicle", spawnCode: null },
    };
  };

  res.json({
    vehicles: shaped,
    libraries: VEHICLE_LIBRARIES,
    myClaims: mine.map((c) => ({ ...withVehicle(c), discordId: undefined })),
    claims: privileged ? open.map(withVehicle) : [],
    canManage,
    canActivate,
  });
});

/** Claim a personal vehicle for yourself. It then waits on a Director or Owner. */
router.post("/vehicles/:id/claim", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;

  try {
    const claim = await claimInTicket(ctx,clip(req.params.id,64),clip(req.body?.requestId,40),clip(req.body?.note,500));
    res.status(201).json({ok:true,claim});
  } catch(error) { res.status(error.status || (error.code === '23505' ? 409 : 503)).json({ok:false,message:error.status ? error.message : 'Could not reserve this vehicle. Refresh and try again.'}); }

});

/** Withdraw your own pending claim. An activated claim is released by a Director or Owner. */
router.delete("/vehicles/:id/claim", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  try {
    const result = await execute(
      `UPDATE dev_vehicle_claims SET status = 'released', updated_at = CURRENT_TIMESTAMP
        WHERE vehicle_id = $1 AND discord_id = $2 AND status = 'pending'`,
      [clip(req.params.id, 64), ctx.user.id],
    );
    if (!changedRows(result)) {
      return res.status(404).json({ ok: false, message: "You have no pending claim on that vehicle." });
    }
  } catch {
    return noStore(res);
  }
  res.json({ ok: true });
});

const CLAIM_ACTIONS = {
  activate: { from: ["pending"], to: "active", past: "activated" },
  deny: { from: ["pending"], to: "denied", past: "denied" },
  release: { from: ["pending", "active"], to: "released", past: "released" },
};

/** Activate, deny or release a claim: Directors and Owners (development.claims.manage). */
router.post("/vehicles/claims/:claimId", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  if (!modelApprover(ctx)) {
    return res.status(403).json({
      ok: false,
      code: "AUTH_ROLE_MISSING",
      message: "Activating vehicle claims needs development.claims.manage.",
    });
  }
  const action = CLAIM_ACTIONS[str(req.body?.action)];
  if (!action) return res.status(400).json({ ok: false, message: "Unknown claim action." });

  try { await ensureApprovals(); } catch { return noStore(res); }
  const claim = await loadClaim(clip(req.params.claimId, 40));
  if (!claim) return res.status(404).json({ ok: false, message: "No such claim." });
  if (!action.from.includes(claim.status)) {
    return res.status(409).json({
      ok: false,
      code: "CLAIM_STATE",
      message: `That claim is already ${claim.status}, so it cannot be ${action.past}.`,
    });
  }

  if (action.to === 'active' && claim.requestId) {
    try { return res.json(await approveTicket(ctx,claim.requestId,'model')); }
    catch(error) { return res.status(error.status || 503).json({ok:false,message:error.message}); }
  }
  const decidedBy = await rosterNameFor(ctx.user);
  try {
    const updated = await query(
      `UPDATE dev_vehicle_claims
          SET status = $2, decision_note = $3, decided_by_id = $4, decided_by_name = $5,
              decided_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = ANY($6::text[]) RETURNING id`,
      [claim.id, action.to, clip(req.body?.note, 500) || null, ctx.user.id, decidedBy, action.from],
    );
    if (!updated.length) return res.status(409).json({ok:false,message:'This claim changed. Refresh before deciding.'});
  } catch {
    return noStore(res);
  }
  res.json({ ok: true, claim: { ...claim, discordId: undefined, status: action.to, decidedByName: decidedBy } });
});

router.put("/vehicles/:id", async (req, res) => {
  const ctx = await contextFor(req);
  if (requireSignIn(ctx, res)) return;
  if (!canManageDev(ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "Managing the vehicle library needs development.manage." });
  }
  const b = req.body ?? {};
  const library = LIBRARY_IDS.has(str(b.library)) ? str(b.library) : null;
  const confidence = CONFIDENCE_IDS.has(str(b.confidence)) ? str(b.confidence) : null;
  const vehicle = {
    id: clip(req.params.id, 64) || `veh-${Date.now().toString(36)}`,
    name: clip(b.name, 160),
    year: clip(b.year, 8),
    make: clip(b.make, 64),
    model: clip(b.model, 96),
    developer: clip(b.developer, 160),
    spawnCode: clip(b.spawnCode, 80),
    available: b.available !== false,
    category: clip(b.category, 48),
    library,
    claimable: b.claimable === true,
    resource: clip(b.resource, 96),
    confidence,
    notes: clip(b.notes, 2000),
    liveries: clip(b.liveries, 160),
    image: clip(b.image, 2000),
    source: clip(b.source, 2000),
    sortOrder: Number.isFinite(b.sortOrder) ? b.sortOrder : 0,
  };
  if (!vehicle.name && !(vehicle.make || vehicle.model)) {
    return res.status(400).json({ ok: false, message: "A vehicle needs a name, or a make and model." });
  }
  if (!vehicle.name) vehicle.name = vehicleDisplayName(vehicle);
  if (!vehicle.category) vehicle.category = library === "leo" ? "Law enforcement" : library === "civ" ? "Civilian" : "";

  try {
    await query(
      `INSERT INTO dev_vehicles
         (id, name, year, make, model, developer, spawn_code, available, category, library, claimable,
          resource, confidence, notes, liveries, image_url, source_url, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, year = EXCLUDED.year, make = EXCLUDED.make,
         model = EXCLUDED.model, developer = EXCLUDED.developer, spawn_code = EXCLUDED.spawn_code,
         available = EXCLUDED.available, category = EXCLUDED.category, library = EXCLUDED.library,
         claimable = EXCLUDED.claimable, resource = EXCLUDED.resource, confidence = EXCLUDED.confidence,
         notes = EXCLUDED.notes, liveries = EXCLUDED.liveries, image_url = EXCLUDED.image_url,
         source_url = EXCLUDED.source_url, sort_order = EXCLUDED.sort_order, updated_at = CURRENT_TIMESTAMP`,
      [
        vehicle.id, vehicle.name, vehicle.year, vehicle.make, vehicle.model, vehicle.developer, vehicle.spawnCode,
        vehicle.available, vehicle.category, vehicle.library, vehicle.claimable, vehicle.resource, vehicle.confidence,
        vehicle.notes, vehicle.liveries, vehicle.image, vehicle.source, vehicle.sortOrder,
      ],
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
    const result = await execute("DELETE FROM dev_vehicles WHERE id = $1", [clip(req.params.id, 64)]);
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

router.patch('/requests/:id/messages/:messageId',async(req,res)=>{
 const ctx=await contextFor(req);if(requireSignIn(ctx,res))return;
 const request=await loadRequest(str(req.params.id));
 if(!request || !canViewRequest(request,ctx))return res.status(403).json({ok:false,message:'This ticket is not available to you.'});
 const work=isDevTeam(ctx);
 if(request.status==='closed' && !work)return res.status(409).json({ok:false,message:'This ticket is closed.'});
 try{res.json(await editMessage('development',request.id,str(req.params.messageId,48),ctx.user.id,req.body?.body,req.body?.originalBody,work));}
 catch(error){res.status(error.status || 503).json({ok:false,message:error.status ? error.message : 'Message could not be saved.'});}
});
