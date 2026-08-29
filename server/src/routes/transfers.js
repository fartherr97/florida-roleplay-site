/**
 * The /api/transfers router — the Emergency Services transfer portal.
 *
 * A port of fartherr97/es-transfer-portal: lib/transfers.js, lib/chat.js,
 * lib/presence.js and lib/settings.js, behind the same endpoints its Next.js
 * route handlers served. The request and response shapes are the originals, so
 * the ported UI talks to this the way it talked to that:
 *
 *   GET    /                      list, scoped to the session
 *   POST   /                      create (409 existing_ticket for non-staff)
 *   GET    /settings              webhook config
 *   POST   /settings              save it (management only)
 *   POST   /settings/test-webhook send a sample embed (management only)
 *   GET    /chat?transfer=ID      messages, internal ones only for staff
 *   POST   /chat                  post a message
 *   POST   /chat/read             mark a thread read (see transfer_reads)
 *   GET    /:id                   one ticket
 *   PATCH  /:id                   approve · revoke-approval · reject · close ·
 *                                 reopen · process
 *   GET    /:id/presence          who is viewing
 *   POST   /:id/presence          heartbeat, returns the viewer list
 *
 * Three things are done differently, and each is why the port was worth doing
 * rather than deploying that app beside this one:
 *
 * - **The caller is this site's session.** The original carried its own Discord
 *   OAuth and its own role-map file to decide who was a department head. Here
 *   it is the same `resolveUser` as every other route, mapped onto the
 *   original's session shape in lib/portal.js, so there is one answer to "who
 *   is this" rather than two.
 * - **Settings are a table, not a process global.** Upstream stores webhook
 *   config on `globalThis` and says so in a comment; a URL a director typed in
 *   should survive a restart.
 * - **Two upstream bugs are fixed here**, both described at their fix site
 *   below: transferees losing access to their own ticket, and the unread badge
 *   forgetting what you had read.
 *
 * The named routes are declared before `/:id` so no ticket id can shadow them.
 */
import { Router } from "express";
import { query } from "../db.js";
import { resolveUser } from "../middleware/requireRole.js";
import { str } from "../validate.js";
import { loadActions } from "../lib/disciplineData.js";
import { backgroundFor } from "../lib/discipline.js";
import {
  DEFAULT_WEBHOOK_CFG,
  DEPT_KEYS,
  buildPayload,
  canManageTicket,
  canUseInternal,
  canViewTicket,
  cleanWebhookUrl,
  isOwnTicket,
  isStaff,
  sessionFrom,
  sendTransferWebhooks,
  visibleTransfers,
} from "../lib/portal.js";

const router = Router();

/** A viewer counts as present while their last heartbeat is inside this. */
const PRESENCE_TTL_SECONDS = 15;

const STATUSES = ["pending", "approved", "completed", "rejected", "closed"];
const TERMINAL = ["completed", "closed", "rejected"];

const MIN_REASON = 150;
const MIN_REJECTION = 20;

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

/** The portal session for a request, or null when nobody is signed in. */
async function sessionFor(req) {
  return sessionFrom(await resolveUser(req));
}

function unauthorized(res) {
  return res.status(401).json({ error: "unauthorized" });
}

function forbidden(res) {
  return res.status(403).json({ error: "forbidden" });
}

/** Maps a snake_case DB row to the camelCase transfer object the UI reads. */
function rowToTransfer(row) {
  return {
    id: row.id,
    member: row.member_name,
    discord: row.discord_username,
    createdById: row.created_by_id ?? null,
    rank: row.current_rank,
    fromDept: row.from_dept,
    toDept: row.to_dept,
    reason: row.reason,
    status: row.status,
    removeRoles: !!row.remove_roles,
    assignVisitorPass: !!row.assign_visitor_pass,
    assignRetired: !!row.assign_retired,
    requireBotConfirm: !!row.require_bot_confirm,
    createdAt: row.created_at,
    approvals: parseJson(row.approvals, []),
    rejectionReason: row.rejection_reason ?? null,
    assignedRank: row.assigned_rank ?? null,
    retiredMember: !!row.retired_member,
    employmentType: row.employment_type ?? null,
    history: parseJson(row.history, []),
  };
}

/** JSONB comes back parsed; a TEXT column holding JSON does not. */
function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowToMessage(r) {
  return {
    id: r.id,
    transferId: r.transfer_id,
    internal: !!r.internal,
    authorId: r.author_id,
    author: r.author_name,
    authorAvatar: r.author_avatar,
    message: r.body,
    createdAt: r.created_at,
  };
}

async function listTransfers() {
  const rows = await query("SELECT * FROM transfers ORDER BY created_at DESC");
  return rows.map(rowToTransfer);
}

async function getTransfer(id) {
  const rows = await query("SELECT * FROM transfers WHERE id = $1 LIMIT 1", [id]);
  return rows[0] ? rowToTransfer(rows[0]) : null;
}

/**
 * Whether this session opened this ticket.
 *
 * **Upstream bug, fixed here.** lib/access.js decides this by comparing the
 * viewer's Discord username and display name against the strings stored on the
 * row. Both of those change: somebody renames themselves in Discord, or a
 * department head corrects a typo in the member field, and the comparison stops
 * matching — so the person who opened the ticket is refused their own ticket
 * while it is still open, which is exactly what was reported. The submitter's
 * user id is recorded at creation and matched first; the name comparison is
 * kept underneath it so tickets created before the column still resolve.
 */
function ownsTicket(session, transfer) {
  if (!session || !transfer) return false;
  if (transfer.createdById && session.id) return transfer.createdById === session.id;
  return isOwnTicket(session, transfer);
}

function canView(session, transfer) {
  return canViewTicket(session, transfer) || ownsTicket(session, transfer);
}

function nowIso() {
  return new Date().toISOString();
}

async function saveApprovals(id, approvals, history, status) {
  if (status) {
    await query("UPDATE transfers SET approvals = $1, history = $2, status = $3 WHERE id = $4",
      [JSON.stringify(approvals), JSON.stringify(history), status, id],
    );
    return;
  }
  await query("UPDATE transfers SET approvals = $1, history = $2 WHERE id = $3", [
    JSON.stringify(approvals),
    JSON.stringify(history),
    id,
  ]);
}

/** Chat messages are informational — never let a failure here block an action. */
async function tryAddMessage(args) {
  try {
    await addMessage(args);
  } catch (err) {
    console.error("[transfers] addMessage failed:", err?.message);
  }
}

async function addMessage({
  transferId,
  internal = false,
  authorId = null,
  author,
  authorAvatar = null,
  message,
}) {
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await query(`INSERT INTO transfer_messages
       (id, transfer_id, internal, author_id, author_name, author_avatar, body)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, transferId, Boolean(internal), authorId, author, authorAvatar, message],
  );
  return {
    id,
    transferId,
    internal: !!internal,
    authorId,
    author,
    authorAvatar,
    message,
    createdAt: nowIso(),
  };
}

async function loadSettings() {
  const webhooks = {};
  for (const dept of DEPT_KEYS) webhooks[dept] = { ...DEFAULT_WEBHOOK_CFG };
  try {
    const rows = await query("SELECT department_id, config FROM transfer_webhooks");
    for (const row of rows) {
      if (!webhooks[row.department_id]) continue;
      webhooks[row.department_id] = {
        ...DEFAULT_WEBHOOK_CFG,
        ...parseJson(row.config, {}),
      };
    }
  } catch {
    // No table yet — the defaults above are a complete, usable config.
  }
  return { webhooks };
}

/**
 * The webhook config as the client may see it.
 *
 * A webhook URL is a credential: anyone holding it can post to that channel as
 * the bot. It is write-only — the client is told whether one is set, never what
 * it is — so a director's screen share does not hand it out.
 */
function redactSettings(settings) {
  const webhooks = {};
  for (const [dept, cfg] of Object.entries(settings.webhooks)) {
    webhooks[dept] = { ...cfg, url: "", hasUrl: Boolean(cfg.url) };
  }
  return { webhooks };
}

/* ─── GET / ─── list all transfers visible to the current session ──────────── */

router.get("/", async (req, res) => {
  const session = await sessionFor(req);
  if (!session) return unauthorized(res);
  try {
    const transfers = await listTransfers();
    const mine = transfers.filter((t) => ownsTicket(session, t));
    const visible = visibleTransfers(session, transfers);
    // Union: `visibleTransfers` uses the name comparison, `mine` the id.
    const seen = new Set(visible.map((t) => t.id));
    return res.json([...visible, ...mine.filter((t) => !seen.has(t.id))]);
  } catch {
    return res.status(503).json({ error: "unavailable", message: "Transfers need a database." });
  }
});

/* ─── POST / ─── create a new transfer request ────────────────────────────── */

router.post("/", async (req, res) => {
  const session = await sessionFor(req);
  if (!session) return unauthorized(res);

  const body = req.body ?? {};
  const member = str(body.member);
  const discord = str(body.discord);
  const rank = str(body.rank);
  const fromDept = str(body.fromDept);
  const toDept = str(body.toDept);
  const reason = str(body.reason);

  const errors = {};
  if (!member) errors.member = "Who is transferring?";
  if (!discord) errors.discord = "A Discord username is required.";
  if (!rank) errors.rank = "What rank do they hold?";
  if (!DEPT_KEYS.includes(fromDept)) errors.fromDept = "Pick a leaving department.";
  if (!DEPT_KEYS.includes(toDept)) errors.toDept = "Pick a destination department.";
  if (fromDept && fromDept === toDept) {
    errors.toDept = "Leaving and destination cannot be the same department.";
  }
  if (reason.length < MIN_REASON) {
    errors.reason = `The reason must be at least ${MIN_REASON} characters.`;
  }
  if (Object.keys(errors).length > 0) return res.status(400).json({ error: "invalid", errors });

  try {
    // Transferees may only have one active ticket at a time (spam prevention).
    if (!isStaff(session)) {
      const all = await listTransfers();
      const hasOpen = all.some(
        (t) => (t.status === "pending" || t.status === "approved") && ownsTicket(session, t),
      );
      if (hasOpen) return res.status(409).json({ error: "existing_ticket" });
    }

    const id = `TR-${Date.now()}`;
    await query(`INSERT INTO transfers
         (id, member_name, discord_username, created_by_id, current_rank, from_dept, to_dept,
          reason, status, remove_roles, assign_visitor_pass, assign_retired,
          require_bot_confirm, approvals, history)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, $12, '[]', '[]')`,
      [
        id,
        member,
        discord,
        session.id,
        rank,
        fromDept,
        toDept,
        reason,
        Boolean(body.removeRoles),
        Boolean(body.assignVisitorPass),
        Boolean(body.assignRetired),
        Boolean(body.requireBotConfirm),
      ],
    );

    const transfer = await getTransfer(id);

    // Fire Discord webhooks to both departments — non-fatal.
    loadSettings()
      .then((settings) => sendTransferWebhooks(transfer, settings))
      .catch((err) => console.error("[transfers] sendTransferWebhooks failed:", err?.message));

    return res.status(201).json(transfer);
  } catch (err) {
    console.error("[transfers] create failed:", err?.message);
    return res
      .status(503)
      .json({ error: "unavailable", message: "Transfers need a database. Nothing was saved." });
  }
});

/* ─── Settings ─────────────────────────────────────────────────────────────── */

router.get("/settings", async (req, res) => {
  const session = await sessionFor(req);
  if (!session) return unauthorized(res);
  return res.json(redactSettings(await loadSettings()));
});

router.post("/settings", async (req, res) => {
  const session = await sessionFor(req);
  if (!session) return unauthorized(res);
  if (!session.isManagement) return forbidden(res);

  const incoming = req.body?.webhooks ?? {};
  const current = await loadSettings();

  try {
    for (const dept of DEPT_KEYS) {
      const patch = incoming[dept];
      if (!patch) continue;
      // An empty url means "leave it alone" — the client never receives the
      // stored one, so it cannot send it back and would otherwise blank it.
      const url = patch.url ? cleanWebhookUrl(patch.url) : current.webhooks[dept].url;
      if (patch.url && !url) {
        return res.status(400).json({
          error: "invalid",
          message: `${dept}'s webhook must be a https://discord.com/api/webhooks/ URL.`,
        });
      }
      const cfg = {
        ...DEFAULT_WEBHOOK_CFG,
        ...current.webhooks[dept],
        ...patch,
        url,
      };
      delete cfg.hasUrl;
      // Manual upsert rather than ON CONFLICT: the latter needs a unique/primary-key
      // constraint on department_id, and a table carried over from the MariaDB→Postgres
      // move can be missing it — in which case ON CONFLICT throws and every save is lost.
      // Update first, insert only when no row was touched, so persistence never depends on
      // the constraint being present.
      const updated = await query(
        `UPDATE transfer_webhooks SET config = $2, updated_by = $3
         WHERE department_id = $1 RETURNING department_id`,
        [dept, JSON.stringify(cfg), session.id],
      );
      if (updated.length === 0) {
        await query(
          `INSERT INTO transfer_webhooks (department_id, config, updated_by) VALUES ($1, $2, $3)`,
          [dept, JSON.stringify(cfg), session.id],
        );
      }
    }
  } catch (err) {
    console.error("[transfers] settings save failed:", err?.message);
    return res
      .status(503)
      .json({ error: "unavailable", message: "Settings need a database. Nothing was saved." });
  }

  return res.json(redactSettings(await loadSettings()));
});

router.post("/settings/test-webhook", async (req, res) => {
  const session = await sessionFor(req);
  if (!session) return unauthorized(res);
  if (!session.isManagement) return forbidden(res);

  const dept = str(req.body?.dept);
  if (!DEPT_KEYS.includes(dept)) return res.status(400).json({ error: "dept required" });

  const settings = await loadSettings();
  const cfg = settings.webhooks[dept];
  const url = cleanWebhookUrl(cfg?.url);
  if (!url) {
    return res
      .status(400)
      .json({ error: "no webhook URL configured for this dept" });
  }

  const vars = {
    member: "TestMember",
    discord: "testuser",
    rank: "Sergeant",
    fromDept: dept,
    toDept: DEPT_KEYS.find((d) => d !== dept) ?? dept,
    ticketId: "TR-TEST",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(cfg, vars)),
    });
    if (!response.ok) {
      return res.status(502).json({ ok: false, status: response.status });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(502).json({ ok: false, message: err?.message });
  }
});

/* ─── Chat ─────────────────────────────────────────────────────────────────── */

router.get("/chat", async (req, res) => {
  const session = await sessionFor(req);
  if (!session) return unauthorized(res);

  const transferId = str(req.query?.transfer);
  if (!transferId) return res.status(400).json({ error: "transfer required" });

  const transfer = await getTransfer(transferId).catch(() => null);
  if (!transfer || !canView(session, transfer)) return forbidden(res);

  const includeInternal = canUseInternal(session, transfer);
  const rows = await query(
    includeInternal
      ? "SELECT * FROM transfer_messages WHERE transfer_id = $1 ORDER BY created_at ASC"
      : "SELECT * FROM transfer_messages WHERE transfer_id = $1 AND internal = false ORDER BY created_at ASC",
    [transferId],
  );
  const messages = rows.map(rowToMessage);

  // How much of each thread this viewer has already read. See POST /chat/read.
  const seen = await readMarks(transferId, session.id);
  return res.json({ messages, seen });
});

router.post("/chat", async (req, res) => {
  const session = await sessionFor(req);
  if (!session) return unauthorized(res);

  const transferId = str(req.body?.transferId);
  const message = str(req.body?.message);
  if (!transferId || !message) {
    return res.status(400).json({ error: "transferId and message required" });
  }

  const transfer = await getTransfer(transferId).catch(() => null);
  if (!transfer || !canView(session, transfer)) return forbidden(res);

  // Only staff with internal access may post internal notes. The flag is
  // re-decided here rather than trusted: the composer hides the toggle, which
  // has never stopped anybody sending the request without it.
  const isInternal = Boolean(req.body?.internal) && canUseInternal(session, transfer);

  const saved = await addMessage({
    transferId,
    internal: isInternal,
    authorId: session.id,
    author: session.displayName || session.username,
    authorAvatar: session.avatar ?? null,
    message,
  });
  return res.status(201).json(saved);
});

/**
 * Mark a thread read up to `count` messages.
 *
 * **Upstream bug, fixed here.** app/page.jsx tracks read counts in a `useRef`
 * seeded at `{ public: 0, internal: 0 }` and never persists them, so the
 * baseline dies with the component: close the ticket, come back, and five
 * internal notes you have already read count as five unread again. It is also
 * wrong within a single visit — the tab you are not looking at shows its entire
 * history as new, because its baseline never moved off zero.
 *
 * Stored per viewer per ticket so the badge means "since you last looked", and
 * so it follows the person rather than the browser they read it in.
 */
router.post("/chat/read", async (req, res) => {
  const session = await sessionFor(req);
  if (!session) return unauthorized(res);
  if (!session.id) return res.json({ ok: true });

  const transferId = str(req.body?.transferId);
  const thread = str(req.body?.thread);
  const count = Number(req.body?.count);
  if (!transferId || !["public", "internal"].includes(thread) || !Number.isFinite(count)) {
    return res.status(400).json({ error: "transferId, thread and count required" });
  }

  const transfer = await getTransfer(transferId).catch(() => null);
  if (!transfer || !canView(session, transfer)) return forbidden(res);
  if (thread === "internal" && !canUseInternal(session, transfer)) return forbidden(res);

  const column = thread === "internal" ? "internal_seen" : "public_seen";
  const value = Math.max(0, Math.trunc(count));
  try {
    // GREATEST so an out-of-order request from a stale tab cannot un-read a
    // thread and make the badge reappear.
    await query(`INSERT INTO transfer_reads (transfer_id, viewer_id, ${column})
       VALUES ($1, $2, $3)
       ON CONFLICT (transfer_id, viewer_id)
         DO UPDATE SET ${column} = GREATEST(transfer_reads.${column}, EXCLUDED.${column})`,
      [transferId, session.id, value],
    );
  } catch (err) {
    console.error("[transfers] read mark failed:", err?.message);
    return res.status(503).json({ ok: false });
  }
  return res.json({ ok: true, ...(await readMarks(transferId, session.id)) });
});

async function readMarks(transferId, viewerId) {
  if (!viewerId) return { public: 0, internal: 0 };
  try {
    const rows = await query("SELECT public_seen, internal_seen FROM transfer_reads WHERE transfer_id = $1 AND viewer_id = $2 LIMIT 1",
      [transferId, viewerId],
    );
    return {
      public: rows[0]?.public_seen ?? 0,
      internal: rows[0]?.internal_seen ?? 0,
    };
  } catch {
    return { public: 0, internal: 0 };
  }
}

/* ─── GET /:id ─── one ticket, scoped to who may see it ───────────────────── */

router.get("/:id", async (req, res) => {
  const session = await sessionFor(req);
  if (!session) return unauthorized(res);

  let transfer;
  try {
    transfer = await getTransfer(req.params.id);
  } catch {
    // A database that is down is not the same answer as "you may not see this",
    // and rendering the denial page for it is how somebody gets told they have
    // lost access to a ticket they still own.
    return res.status(503).json({ error: "unavailable", message: "Transfers need a database." });
  }
  if (!transfer) return res.status(404).json({ error: "not found" });
  if (!canView(session, transfer)) return forbidden(res);
  return res.json(transfer);
});

/* ─── GET /:id/bgcheck ─── the transferee's folded disciplinary record ─────── */

/**
 * A background check on the person the ticket is about, for whoever manages the
 * ticket to read before they process a transfer.
 *
 * This is the same folded record the DA Hub and Discord's `/bgcheck` show, but it
 * is authorized by the *ticket*, not by `discipline.view`: a department head runs
 * the department the member is moving to or from, so they may read the record in
 * that context even without the site-wide disciplinary grant. Management may
 * always. It is never returned to the transferee — `canManageTicket` excludes the
 * ticket's own owner — so a member cannot pull their own record through here.
 *
 * The lookup is keyed on the submitter's recorded Discord id, which is immutable,
 * rather than the free-text `discord`/`member` fields that a correction can change.
 */
router.get("/:id/bgcheck", async (req, res) => {
  const session = await sessionFor(req);
  if (!session) return unauthorized(res);

  let transfer;
  try {
    transfer = await getTransfer(req.params.id);
  } catch {
    return res.status(503).json({ error: "unavailable", message: "Transfers need a database." });
  }
  if (!transfer) return res.status(404).json({ error: "not found" });
  if (!canManageTicket(session, transfer)) return forbidden(res);

  const discordId = str(transfer.createdById).trim();
  const member = transfer.member || transfer.discord || null;
  if (!/^\d{17,20}$/.test(discordId)) {
    // Tickets opened before the submitter's id was recorded have only the free-text
    // fields, which are not a reliable key for a record. Say so rather than guess.
    return res.json({ background: null, member, reason: "no_discord_id" });
  }

  const actions = await loadActions({ targetDiscordId: discordId });
  return res.json({ background: backgroundFor(actions, { discordId }), member });
});

/* ─── PATCH /:id ─── approve · revoke · reject · close · reopen · process ─── */

router.patch("/:id", async (req, res) => {
  const session = await sessionFor(req);
  if (!session) return unauthorized(res);

  const id = req.params.id;
  const transfer = await getTransfer(id).catch(() => null);
  if (!transfer) return res.status(404).json({ error: "not found" });

  const body = req.body ?? {};

  // All actions require staff.
  if (!canManageTicket(session, transfer)) return forbidden(res);

  const actorName = session.displayName || session.username;
  const approvals = [...(transfer.approvals ?? [])];
  const history = [...(transfer.history ?? [])];

  /* ── Approve ─────────────────────────────────────────────────────────── */
  if (body.action === "approve") {
    const ticketDepts = [transfer.fromDept, transfer.toDept];
    let targets;
    if (session.isManagement) {
      if (body.dept && !ticketDepts.includes(body.dept)) {
        return res.status(400).json({ error: "dept not part of this transfer" });
      }
      targets = body.dept ? [body.dept] : ticketDepts;
    } else {
      if (!session.dept) return res.status(400).json({ error: "session has no dept" });
      // A department head signs for their own department and no other. The
      // department is taken from their roles, never from the request body.
      if (!ticketDepts.includes(session.dept)) return forbidden(res);
      targets = [session.dept];
    }

    for (const dept of targets) {
      const entry = { dhId: session.id, dhName: actorName, dept, approvedAt: nowIso() };
      const existing = approvals.findIndex((a) => a.dept === dept);
      if (existing >= 0) {
        approvals[existing] = entry;
        history.push({
          action: "approved",
          actor: actorName,
          details: `${dept} updated their approval`,
          timestamp: nowIso(),
        });
      } else {
        approvals.push(entry);
        history.push({
          action: "approved",
          actor: actorName,
          details: `${dept} approved the transfer`,
          timestamp: nowIso(),
        });
      }
    }

    const bothApproved =
      approvals.some((a) => a.dept === transfer.fromDept) &&
      approvals.some((a) => a.dept === transfer.toDept);
    const bump = bothApproved && !TERMINAL.includes(transfer.status) ? "approved" : null;
    await saveApprovals(id, approvals, history, bump);
    return res.json(await getTransfer(id));
  }

  /* ── Revoke approval ─────────────────────────────────────────────────── */
  if (body.action === "revoke-approval") {
    const ticketDepts = [transfer.fromDept, transfer.toDept];
    let targets;
    if (session.isManagement) {
      if (body.dept && !ticketDepts.includes(body.dept)) {
        return res.status(400).json({ error: "dept not part of this transfer" });
      }
      targets = body.dept ? [body.dept] : ticketDepts;
    } else {
      if (!session.dept) return res.status(400).json({ error: "session has no dept" });
      if (!ticketDepts.includes(session.dept)) return forbidden(res);
      targets = [session.dept];
    }

    let removed = false;
    for (const dept of targets) {
      const before = approvals.length;
      const kept = approvals.filter((a) => a.dept !== dept);
      if (kept.length !== before) {
        removed = true;
        approvals.length = 0;
        approvals.push(...kept);
        history.push({
          action: "revoked",
          actor: actorName,
          details: `${dept} revoked their approval`,
          timestamp: nowIso(),
        });
      }
    }
    if (!removed) return res.json(transfer);

    const revert = transfer.status === "approved" ? "pending" : null;
    await saveApprovals(id, approvals, history, revert);
    return res.json(await getTransfer(id));
  }

  /* ── Reject ──────────────────────────────────────────────────────────── */
  if (body.status === "rejected" || body.action === "reject") {
    const reason = str(body.rejectionReason);
    if (reason.length < MIN_REJECTION) {
      return res
        .status(400)
        .json({ error: `rejectionReason must be at least ${MIN_REJECTION} characters` });
    }
    const deptName = session.dept ?? "Staff";
    history.push({
      action: "rejected",
      actor: actorName,
      details: `${deptName} rejected: ${reason}`,
      timestamp: nowIso(),
    });
    await query("UPDATE transfers SET status = 'rejected', rejection_reason = $1, history = $2 WHERE id = $3",
      [reason, JSON.stringify(history), id],
    );
    await tryAddMessage({
      transferId: id,
      internal: false,
      authorId: null,
      author: "System",
      authorAvatar: null,
      message: `Hey @${transfer.member},\n\nYour transfer request has been denied by ${deptName} for the following reason:\n\n${reason}\n\nIf you have any questions, please ask them here. Otherwise this ticket will be closed.`,
    });
    return res.json(await getTransfer(id));
  }

  /* ── Close / Reopen (management only) ────────────────────────────────── */
  if (body.action === "close" || body.action === "reopen") {
    if (!session.isManagement) {
      return res.status(403).json({ error: "only management can close or reopen tickets" });
    }
    const closing = body.action === "close";
    history.push({
      action: closing ? "closed" : "reopened",
      actor: actorName,
      details: closing ? "Ticket closed" : "Ticket reopened",
      timestamp: nowIso(),
    });
    await query("UPDATE transfers SET status = $1, history = $2 WHERE id = $3", [
      closing ? "closed" : "pending",
      JSON.stringify(history),
      id,
    ]);
    return res.json(await getTransfer(id));
  }

  /* ── Process ─────────────────────────────────────────────────────────── */
  if (body.action === "process") {
    const assignedRank = str(body.assignedRank);
    const employmentType = body.employmentType === "parttime" ? "parttime" : "fulltime";
    if (!assignedRank) return res.status(400).json({ error: "assignedRank required" });

    // Upstream lets a manager process a ticket neither department has signed,
    // because the button's `disabled` is the only thing standing in the way.
    const bothApproved =
      (transfer.approvals ?? []).some((a) => a.dept === transfer.fromDept) &&
      (transfer.approvals ?? []).some((a) => a.dept === transfer.toDept);
    if (!bothApproved) {
      return res.status(409).json({ error: "both departments must approve first" });
    }

    const empLabel = employmentType === "parttime" ? "Part Time" : "Full Time";
    history.push({
      action: "completed",
      actor: actorName,
      details: `Processed by ${actorName} · assigned rank: ${assignedRank || "N/A"}, ${empLabel}`,
      timestamp: nowIso(),
    });
    await query(`UPDATE transfers
          SET status = 'completed', assigned_rank = $1, retired_member = FALSE,
              employment_type = $2, history = $3
        WHERE id = $4`,
      [assignedRank, employmentType, JSON.stringify(history), id],
    );
    await tryAddMessage({
      transferId: id,
      internal: false,
      authorId: null,
      author: "System",
      authorAvatar: null,
      message: `Hey @${transfer.member},\n\nYour transfer has been processed and your roles have been updated. Welcome to ${transfer.toDept}!\n\nThis ticket will now be closed out by management.`,
    });
    return res.json(await getTransfer(id));
  }

  // No generic status setter: every legitimate transition has its own guarded
  // action above (approve/revoke/reject are department-scoped, close/reopen are
  // management-only, and process requires both departments to have approved).
  // A raw status write here would let a single department head jump a transfer
  // straight to completed/closed/approved, bypassing every one of those guards
  // and leaving no history entry, so it is deliberately not offered.
  return res.status(400).json({ error: "unknown action" });
});

/* ─── Presence ─────────────────────────────────────────────────────────────── */

async function viewersFor(transferId) {
  const rows = await query(`SELECT viewer_id, viewer_name, viewer_avatar FROM transfer_viewers
      WHERE transfer_id = $1 AND last_seen >= (now() - make_interval(secs => $2))
      ORDER BY last_seen DESC`,
    [transferId, PRESENCE_TTL_SECONDS],
  );
  return rows.map((r) => ({ id: r.viewer_id, name: r.viewer_name, avatar: r.viewer_avatar }));
}

router.get("/:id/presence", async (req, res) => {
  const session = await sessionFor(req);
  if (!session) return unauthorized(res);
  const transfer = await getTransfer(req.params.id).catch(() => null);
  if (!transfer || !canView(session, transfer)) return forbidden(res);
  return res.json(await viewersFor(req.params.id).catch(() => []));
});

router.post("/:id/presence", async (req, res) => {
  const session = await sessionFor(req);
  if (!session) return unauthorized(res);
  const transfer = await getTransfer(req.params.id).catch(() => null);
  if (!transfer || !canView(session, transfer)) return forbidden(res);

  if (session.id) {
    try {
      await query(`INSERT INTO transfer_viewers (transfer_id, viewer_id, viewer_name, viewer_avatar, last_seen)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (transfer_id, viewer_id) DO UPDATE SET viewer_name = EXCLUDED.viewer_name,
                                 viewer_avatar = EXCLUDED.viewer_avatar,
                                 last_seen = now()`,
        [req.params.id, session.id, session.displayName || session.username, session.avatar ?? null],
      );
    } catch {
      // Presence is best-effort — it must never take the ticket down with it.
    }
  }
  return res.json(await viewersFor(req.params.id).catch(() => []));
});

export default router;
