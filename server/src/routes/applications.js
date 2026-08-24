/**
 * The /api/apply router.
 *
 * Three audiences share this file, and the split between them is the whole
 * design:
 *
 * - **Applicants** read open applications and submit one. They may hold no roles
 *   at all, so these endpoints are the only ones on the site that answer to
 *   someone who is not staff.
 * - **Command staff** build applications for their own department and decide
 *   submissions from the site.
 * - **The bot** collects what it should post to Discord, and reports back the
 *   decisions made there.
 *
 * The rule that matters: **the server validates, the client does not.** A
 * submission arrives as answers only, and they are checked against the stored
 * document here. A hidden conditional branch the applicant never saw is dropped
 * rather than trusted, which is why validateAnswers returns a cleaned set rather
 * than a boolean.
 *
 * The second rule: **this process never talks to Discord.** A website cannot
 * post an interactive component and cannot receive the click — only a bot
 * application can do both. So every message is queued in `application_dispatches`
 * and the bot owns the buttons. BOT_DISPATCH_URL, when set, is a push on top of
 * that queue, never instead of it.
 */
import { Router } from "express";
import { execute, query, changedRows } from "../db.js";
import * as seed from "../applicationSeed.js";
import { ROLE_MAP } from "../rosterSeed.js";
import { requirePermission, loadGrants } from "../middleware/requirePermission.js";
import { resolveUser } from "../middleware/requireRole.js";
import { permissionsFor } from "../permissions.js";
import { requireBot } from "../middleware/requireBot.js";
import { str } from "../validate.js";
import {
  normalizeApplication,
  validateApplication,
  validateAnswers,
  canApply,
  canManageApplications,
  canReviewApplication,
  buildEmbed,
  makeReference,
  allFields,
  slugify,
  SUBMISSION_STATUSES,
} from "../lib/applicationConfig.js";

const router = Router();

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

async function loadApplications() {
  try {
    const rows = await query("SELECT config FROM custom_applications ORDER BY department_id, title");
    if (rows.length) {
      return rows.map((row) => normalizeApplication(parseJson(row.config, null))).filter((a) => a.id);
    }
  } catch {
    // No database — the seeds stand, so the whole flow is demonstrable without one.
  }
  return seed.APPLICATIONS.map(normalizeApplication);
}

async function loadApplication(slug) {
  const all = await loadApplications();
  return all.find((app) => app.slug === slug) ?? null;
}

const SUBMISSION_COLUMNS = `
  reference, application_id AS "applicationId", application_slug AS "applicationSlug",
  department_id AS "departmentId", subdivision_id AS "subdivisionId",
  applicant_discord_id AS "applicantDiscordId", applicant_name AS "applicantName",
  answers, config_snapshot AS "configSnapshot", status,
  decided_by AS "decidedBy", decided_by_name AS "decidedByName", decided_via AS "decidedVia",
  decision_reason AS "decisionReason", decided_at AS "decidedAt", submitted_at AS "submittedAt"`;

function shapeSubmission(row) {
  return {
    ...row,
    answers: parseJson(row.answers, {}),
    configSnapshot: parseJson(row.configSnapshot, null),
  };
}

async function loadSubmissions({ departmentId, status, applicantDiscordId, reference } = {}) {
  const where = [];
  const params = [];
  // Each clause is written after its value is pushed, so it reads its own
  // placeholder number off the array — see the same note in discipline.js.
  const bind = (column, value) => {
    params.push(value);
    where.push(`${column} = $${params.length}`);
  };
  if (departmentId) bind("department_id", departmentId);
  if (status) bind("status", status);
  if (applicantDiscordId) bind("applicant_discord_id", applicantDiscordId);
  if (reference) bind("reference", reference);
  try {
    const rows = await query(
      `SELECT ${SUBMISSION_COLUMNS} FROM application_submissions${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY submitted_at DESC LIMIT 500`,
      params,
    );
    return rows.map(shapeSubmission);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * Caller context
 * ------------------------------------------------------------------ */

/** Discord role id → mapped role key, for translating a reviewer list. */
const ROLE_ID_TO_KEY = Object.fromEntries(
  ROLE_MAP.filter((role) => role.roleId).map((role) => [String(role.roleId), role.key]),
);

async function contextFor(req) {
  const user = req.user ?? (await resolveUser(req));
  req.user = user;
  const grants = await loadGrants();
  const roleKeys = user?.roles ?? [];
  return {
    user,
    roleKeys,
    permissions: permissionsFor(roleKeys, grants),
    roleIdToKey: ROLE_ID_TO_KEY,
  };
}

/* ------------------------------------------------------------------ *
 * Public: what is open, and applying
 * ------------------------------------------------------------------ */

/**
 * Every application somebody may see. Drafts and closed ones are visible only to
 * the people who could edit them, and `sections` is stripped from the index —
 * the list does not need the questions, and an unopened application's questions
 * are not public.
 */
router.get("/", async (req, res) => {
  const ctx = await contextFor(req);
  const apps = await loadApplications();
  const visible = apps.filter(
    (app) => app.status === "open" || canManageApplications(app.departmentId, ctx),
  );
  res.json({
    applications: visible.map(({ sections, discord, ...rest }) => ({
      ...rest,
      fieldCount: sections.reduce((n, s) => n + s.fields.length, 0),
      // Command staff see at a glance whether routing is configured; nobody sees
      // the ids themselves from the index.
      routed: Boolean(discord.channelId),
    })),
    subdivisions: seed.SUBDIVISIONS,
  });
});

/** One application, ready to fill in — with whether this caller may. */
router.get("/:slug", async (req, res) => {
  const ctx = await contextFor(req);
  const app = await loadApplication(str(req.params.slug));
  if (!app) return res.status(404).json({ ok: false, message: "No such application." });

  const mayManage = canManageApplications(app.departmentId, ctx);
  if (app.status !== "open" && !mayManage) {
    return res.status(404).json({ ok: false, message: "No such application." });
  }

  const history = ctx.user?.id
    ? await loadSubmissions({ applicantDiscordId: ctx.user.id })
    : [];

  // The Discord ids are routing configuration, not something an applicant needs.
  const { discord, ...publicApp } = app;
  res.json({
    application: mayManage ? app : publicApp,
    eligibility: canApply(app, { user: ctx.user, history }),
    history: history
      .filter((s) => s.applicationId === app.id)
      .map(({ reference, status, submittedAt, decidedAt }) => ({ reference, status, submittedAt, decidedAt })),
  });
});

/**
 * Submit one.
 *
 * Everything decided here rather than accepted from the body: whether they may
 * apply at all, which answers count, and the reference. The document is snapshot
 * alongside the answers so a question edited tomorrow never rewrites what
 * somebody was asked today.
 */
router.post("/:slug/submit", async (req, res) => {
  const ctx = await contextFor(req);
  const app = await loadApplication(str(req.params.slug));
  if (!app || app.status !== "open") {
    return res.status(404).json({ ok: false, message: "That application is not accepting submissions." });
  }

  const history = ctx.user?.id ? await loadSubmissions({ applicantDiscordId: ctx.user.id }) : [];
  const eligible = canApply(app, { user: ctx.user, history });
  if (!eligible.ok) {
    return res.status(403).json({ ok: false, code: "APPLY_INELIGIBLE", message: eligible.reason });
  }

  const { errors, answers, ok } = validateAnswers(app, req.body?.answers ?? {});
  if (!ok) return res.status(400).json({ ok: false, code: "APPLY_INVALID", errors });

  const reference = makeReference();
  const submission = {
    reference,
    applicationId: app.id,
    applicationSlug: app.slug,
    departmentId: app.departmentId,
    subdivisionId: app.subdivisionId || null,
    applicantDiscordId: ctx.user?.id ?? null,
    applicantName: ctx.user?.displayName ?? ctx.user?.username ?? null,
    answers,
    status: "pending",
    submittedAt: new Date().toISOString(),
  };

  try {
    await query(`INSERT INTO application_submissions
         (reference, application_id, application_slug, department_id, subdivision_id,
          applicant_discord_id, applicant_name, answers, config_snapshot, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
      [
        reference, app.id, app.slug, app.departmentId, app.subdivisionId || null,
        submission.applicantDiscordId, submission.applicantName,
        JSON.stringify(answers), JSON.stringify(app),
      ],
    );
  } catch {
    // Without a database there is nowhere to put it, and telling somebody their
    // application was received when it was not is the one answer we must never
    // give.
    return res.status(503).json({
      ok: false,
      code: "APPLY_NO_STORE",
      message: "Applications are not available right now. Nothing was submitted — please try again later.",
    });
  }

  await enqueueDispatch(app, submission, "submitted");

  res.status(201).json({
    ok: true,
    reference,
    message: app.outcome.confirmation,
  });
});

/* ------------------------------------------------------------------ *
 * The Discord outbox
 * ------------------------------------------------------------------ */

/**
 * Queue the message, then try to push it.
 *
 * The row is written first and always. If the push works the bot marks it
 * delivered; if it does not — or BOT_DISPATCH_URL was never set — the row sits
 * there until the bot collects it. Either way a bot outage costs nothing but
 * time, which is the entire point of not sending from here.
 */
async function enqueueDispatch(app, submission, kind) {
  const payload = buildEmbed(app, submission, { fields: allFields(app) });
  let id = null;
  try {
    const result = await query(
      "INSERT INTO application_dispatches (reference, kind, payload) VALUES ($1, $2, $3) RETURNING id",
      [submission.reference, kind, JSON.stringify(payload)],
    );
    id = result[0]?.id ?? null;
  } catch {
    return; // No database: the submit path already refused, so nothing is lost.
  }
  await pushDispatch(id, kind, payload);
}

/** Best-effort push. Never throws into a request — the queue is the contract. */
async function pushDispatch(id, kind, payload) {
  const url = process.env.BOT_DISPATCH_URL;
  const token = process.env.BOT_TOKEN;
  if (!url || !token || !id) return;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ dispatchId: id, kind, ...payload }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      await query("UPDATE application_dispatches SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP, attempts = attempts + 1, discord_message_id = $1 WHERE id = $2",
        [str(body?.messageId) || null, id],
      );
      return;
    }
    await query("UPDATE application_dispatches SET attempts = attempts + 1, last_error = $1 WHERE id = $2",
      [`Bot answered ${res.status}`, id],
    );
  } catch (err) {
    await query("UPDATE application_dispatches SET attempts = attempts + 1, last_error = $1 WHERE id = $2",
      [String(err?.message ?? "push failed").slice(0, 512), id],
    ).catch(() => {});
  }
}

/* ------------------------------------------------------------------ *
 * Command staff: building
 * ------------------------------------------------------------------ */

/** The applications this caller may edit, whole. */
router.get("/manage/list", async (req, res) => {
  const ctx = await contextFor(req);
  const apps = await loadApplications();
  const mine = apps.filter((app) => canManageApplications(app.departmentId, ctx));
  res.json({
    applications: mine,
    subdivisions: seed.SUBDIVISIONS,
    canManage: Object.keys(seed.SUBDIVISIONS).filter((id) => canManageApplications(id, ctx)),
  });
});

/**
 * Create or replace one. The whole document is sent rather than a diff, so what
 * is saved is exactly what the builder showed — the same reason the permissions
 * page posts its entire grant table.
 */
router.put("/manage/:id", async (req, res) => {
  const ctx = await contextFor(req);
  const incoming = normalizeApplication({ ...(req.body?.application ?? {}), id: str(req.params.id) });

  if (!canManageApplications(incoming.departmentId, ctx)) {
    return res.status(403).json({
      ok: false,
      code: "AUTH_ROLE_MISSING",
      message: "You can only build applications for your own department.",
    });
  }

  // Editing an existing one may not move it to a department you do not command.
  const existing = (await loadApplications()).find((a) => a.id === incoming.id);
  if (existing && !canManageApplications(existing.departmentId, ctx)) {
    return res.status(403).json({
      ok: false,
      code: "AUTH_ROLE_MISSING",
      message: "That application belongs to another department.",
    });
  }

  incoming.slug = slugify(incoming.slug || incoming.title);
  const problems = validateApplication(incoming);
  const blocking = problems.filter((p) => p.level === "error");
  if (blocking.length && incoming.status === "open") {
    return res.status(400).json({ ok: false, code: "APPLY_INCOMPLETE", problems });
  }

  try {
    await query(`INSERT INTO custom_applications (id, slug, department_id, subdivision_id, title, status, config, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         slug = EXCLUDED.slug, department_id = EXCLUDED.department_id,
         subdivision_id = EXCLUDED.subdivision_id, title = EXCLUDED.title,
         status = EXCLUDED.status, config = EXCLUDED.config, updated_by = EXCLUDED.updated_by`,
      [
        incoming.id, incoming.slug, incoming.departmentId, incoming.subdivisionId || null,
        incoming.title, incoming.status, JSON.stringify(incoming), ctx.user?.id ?? null,
      ],
    );
  } catch (err) {
    if (String(err?.code) === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, code: "APPLY_SLUG_TAKEN", message: "Another application already uses that web address." });
    }
    return res.status(503).json({ ok: false, code: "APPLY_NO_STORE", message: "Applications need a database to save. Nothing was written." });
  }

  res.json({ ok: true, application: incoming, problems });
});

/** Delete one. Submissions keep their own snapshot, so they survive it. */
router.delete("/manage/:id", async (req, res) => {
  const ctx = await contextFor(req);
  const existing = (await loadApplications()).find((a) => a.id === str(req.params.id));
  if (!existing) return res.status(404).json({ ok: false, message: "No such application." });
  if (!canManageApplications(existing.departmentId, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "That application belongs to another department." });
  }
  try {
    const result = await execute("DELETE FROM custom_applications WHERE id = $1", [existing.id]);
    if (!changedRows(result)) return res.status(404).json({ ok: false, message: "Nothing was deleted." });
  } catch {
    return res.status(503).json({ ok: false, code: "APPLY_NO_STORE", message: "Applications need a database. Nothing was deleted." });
  }
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ *
 * Reviewing
 * ------------------------------------------------------------------ */

/** The review queue, limited to the applications this caller may decide. */
router.get("/manage/submissions", async (req, res) => {
  const ctx = await contextFor(req);
  const apps = await loadApplications();
  const readable = new Set(
    apps.filter((app) => canReviewApplication(app, ctx)).map((app) => app.id),
  );
  if (!readable.size) {
    return res.status(403).json({
      ok: false,
      code: "AUTH_ROLE_MISSING",
      message: "None of your Discord roles review applications.",
    });
  }
  const status = SUBMISSION_STATUSES.includes(req.query.status) ? req.query.status : null;
  const rows = await loadSubmissions({ status });
  res.json({ submissions: rows.filter((row) => readable.has(row.applicationId)) });
});

/** One submission, with the document as it stood when it was filled in. */
router.get("/manage/submissions/:reference", async (req, res) => {
  const ctx = await contextFor(req);
  const [row] = await loadSubmissions({ reference: str(req.params.reference) });
  if (!row) return res.status(404).json({ ok: false, message: "No such submission." });

  const app = row.configSnapshot ?? (await loadApplications()).find((a) => a.id === row.applicationId);
  if (!app || !canReviewApplication(normalizeApplication(app), ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "You do not review this application." });
  }
  res.json({ submission: row, application: normalizeApplication(app) });
});

/**
 * Decide one from the site. The same transition the bot reports from a button —
 * both land in `recordDecision`, so the two routes cannot drift into recording
 * different things.
 */
router.post("/manage/submissions/:reference/decision", async (req, res) => {
  const ctx = await contextFor(req);
  const reference = str(req.params.reference);
  const [row] = await loadSubmissions({ reference });
  if (!row) return res.status(404).json({ ok: false, message: "No such submission." });

  const app = normalizeApplication(row.configSnapshot ?? {});
  if (!canReviewApplication(app, ctx)) {
    return res.status(403).json({ ok: false, code: "AUTH_ROLE_MISSING", message: "You do not review this application." });
  }

  const outcome = await recordDecision({
    reference,
    decision: req.body?.decision,
    reason: req.body?.reason,
    deciderId: ctx.user?.id ?? null,
    deciderName: ctx.user?.displayName ?? ctx.user?.username ?? null,
    via: "site",
  });
  if (!outcome.ok) return res.status(outcome.status).json(outcome.body);
  res.json({ ok: true, submission: outcome.submission });
});

/**
 * The one place a decision is written, whichever surface it came from.
 *
 * The UPDATE names the current status in its WHERE clause, so two people
 * deciding at once — one in Discord, one here — cannot both win: the second
 * changes no rows and is told the call was already made.
 */
async function recordDecision({ reference, decision, reason, deciderId, deciderName, via }) {
  const status = decision === "approve" ? "approved" : decision === "deny" ? "denied" : null;
  if (!status) {
    return { ok: false, status: 400, body: { ok: false, message: "A decision is either approve or deny." } };
  }
  const note = str(reason).slice(0, 512) || null;

  let result;
  try {
    result = await execute(`UPDATE application_submissions
          SET status = $1, decided_by = $2, decided_by_name = $3, decided_via = $4,
              decision_reason = $5, decided_at = CURRENT_TIMESTAMP
        WHERE reference = $6 AND status = 'pending'`,
      [status, deciderId, deciderName, via, note, reference],
    );
  } catch {
    return { ok: false, status: 503, body: { ok: false, code: "APPLY_NO_STORE", message: "Applications need a database. Nothing was recorded." } };
  }

  if (!changedRows(result)) {
    const [current] = await loadSubmissions({ reference });
    if (!current) return { ok: false, status: 404, body: { ok: false, message: "No such submission." } };
    return {
      ok: false,
      status: 409,
      body: {
        ok: false,
        code: "APPLY_ALREADY_DECIDED",
        message: `That one was already ${current.status}${current.decidedByName ? ` by ${current.decidedByName}` : ""}.`,
        submission: current,
      },
    };
  }

  const [updated] = await loadSubmissions({ reference });
  // Tell Discord the outcome so the embed stops showing live buttons.
  if (updated) {
    await enqueueDispatch(normalizeApplication(updated.configSnapshot ?? {}), updated, `decision:${status}`);
  }
  return { ok: true, submission: updated };
}

/* ------------------------------------------------------------------ *
 * The bot
 * ------------------------------------------------------------------ */

/**
 * What the bot should post but has not yet.
 *
 * Polling this is the supported path whether or not BOT_DISPATCH_URL is set —
 * the push is an optimisation and this is the contract. Ordered oldest first so
 * a backlog is delivered in the order it happened.
 */
router.get("/bot/outbox", requireBot, async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  try {
    const rows = await query(`SELECT id, reference, kind, payload, attempts, last_error AS "lastError", created_at AS "createdAt"
         FROM application_dispatches
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT ${limit}`,
    );
    res.json({ dispatches: rows.map((row) => ({ ...row, payload: parseJson(row.payload, null) })) });
  } catch {
    res.json({ dispatches: [] });
  }
});

/** The bot confirming it posted one, with the message id so it can edit later. */
router.post("/bot/outbox/:id/delivered", requireBot, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, message: "Invalid dispatch id." });
  const messageId = str(req.body?.messageId);
  try {
    const result = await execute(`UPDATE application_dispatches
          SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP,
              attempts = attempts + 1, discord_message_id = $1
        WHERE id = $2 AND status = 'pending'`,
      [/^\d{17,20}$/.test(messageId) ? messageId : null, id],
    );
    if (!changedRows(result)) {
      return res.status(409).json({ ok: false, message: "That dispatch was already delivered or does not exist." });
    }
  } catch {
    return res.status(503).json({ ok: false, message: "Nothing was recorded." });
  }
  res.json({ ok: true });
});

/** The bot reporting that it could not post one, so the failure is visible. */
router.post("/bot/outbox/:id/failed", requireBot, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ ok: false, message: "Invalid dispatch id." });
  try {
    await query("UPDATE application_dispatches SET attempts = attempts + 1, last_error = $1 WHERE id = $2",
      [str(req.body?.error).slice(0, 512) || "The bot reported a failure.", id],
    );
  } catch {
    return res.status(503).json({ ok: false, message: "Nothing was recorded." });
  }
  res.json({ ok: true });
});

/**
 * A decision made in Discord.
 *
 * The bot is trusted to have checked the reviewer roles, because it is the only
 * thing that can: the button lives in Discord, and Discord is where those raw
 * role ids mean something. What is not trusted is the transition — that goes
 * through the same guarded UPDATE as a decision made here.
 */
router.post("/bot/submissions/:reference/decision", requireBot, async (req, res) => {
  const outcome = await recordDecision({
    reference: str(req.params.reference),
    decision: req.body?.decision,
    reason: req.body?.reason,
    deciderId: /^\d{17,20}$/.test(String(req.body?.deciderId ?? "")) ? String(req.body.deciderId) : null,
    deciderName: str(req.body?.deciderName).slice(0, 128) || null,
    via: "discord",
  });
  if (!outcome.ok) return res.status(outcome.status).json(outcome.body);
  res.json({ ok: true, submission: outcome.submission });
});

export default router;
