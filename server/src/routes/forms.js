/**
 * The /api/forms router — the shared form and exam engine.
 *
 * The rule that matters here: **the server grades, the client does not.** A
 * submission arrives as answers only; the score, the pass/fail and the
 * needs-review flag are computed here from the stored form. A client that posted
 * its own score would be posting its own exam result.
 *
 * The answer key is the other half of that. `GET /api/forms` strips `correct`
 * from every question before it leaves the server unless the caller may review
 * or manage the form — otherwise passing an exam would only take opening
 * devtools.
 */
import { Router } from "express";
import { query } from "../db.js";
import * as seed from "../formsSeed.js";
import { requirePermission, loadGrants } from "../middleware/requirePermission.js";
import { resolveUser } from "../middleware/requireRole.js";
import { permissionsFor } from "../permissions.js";
import { collect, isDiscordId, str } from "../validate.js";
import {
  canReviewForm,
  canTakeForm,
  gradeSubmission,
  applyReview,
  missingRequired,
} from "../lib/forms.js";

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

async function loadForms() {
  try {
    const rows = await query("SELECT id, document FROM forms");
    if (rows.length) {
      return rows.map((row) => parseJson(row.document, null)).filter(Boolean);
    }
  } catch {
    // No database — the seeds stand.
  }
  return seed.forms;
}

async function loadSubmissions() {
  try {
    const rows = await query(
      "SELECT id, form_id, subject_name, subject_discord_id, answers, submitted_at FROM form_submissions ORDER BY submitted_at DESC",
    );
    if (rows.length) {
      return rows.map((row) => ({
        id: row.id,
        formId: row.form_id,
        subject: row.subject_name
          ? { name: row.subject_name, discordId: row.subject_discord_id }
          : null,
        anonymous: !row.subject_name,
        answers: parseJson(row.answers, {}),
        at: row.submitted_at instanceof Date ? row.submitted_at.toISOString() : row.submitted_at,
      }));
    }
  } catch {
    // No database — the seeds stand.
  }
  return seed.submissions;
}

/**
 * Stored reviewer overrides, keyed by submission. Kept apart from the
 * submission itself so the original auto-grade is never overwritten: a graded
 * result and the reviewer's adjustment to it are two different facts, and the
 * exam audit log already works this way.
 */
async function loadOverrides() {
  try {
    const rows = await query(
      "SELECT submission_id, question_id, awarded, reviewer, reviewed_at FROM form_reviews",
    );
    const map = new Map();
    rows.forEach((row) => {
      if (!map.has(row.submission_id)) map.set(row.submission_id, { points: {}, reviewer: null, at: null });
      const entry = map.get(row.submission_id);
      entry.points[row.question_id] = row.awarded;
      entry.reviewer = row.reviewer;
      entry.at = row.reviewed_at instanceof Date ? row.reviewed_at.toISOString() : row.reviewed_at;
    });
    return map;
  } catch {
    return new Map();
  }
}

/** Resolve the caller's roles and permissions once per request. */
async function withCaller(req, _res, next) {
  const user = req.user ?? (await resolveUser(req));
  req.user = user;
  const grants = await loadGrants();
  req.callerContext = {
    roleKeys: user?.roles ?? [],
    permissions: permissionsFor(user?.roles ?? [], grants),
  };
  next();
}

/**
 * Strip the answer key. A caller who may review or manage a form gets it — they
 * need it to grade — and nobody else ever does.
 */
function withoutKey(form) {
  return {
    ...form,
    questions: (form.questions || []).map((question) => {
      const { correct, matchMode, ...rest } = question;
      void correct;
      void matchMode;
      return rest;
    }),
  };
}

function shape(form, context) {
  return canReviewForm(form, context) ? form : withoutKey(form);
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

/**
 * The forms a caller may see, optionally narrowed to one hub's audience.
 * Unpublished drafts only appear for someone who can manage them.
 */
router.get("/", requirePermission("forms.view"), withCaller, async (req, res) => {
  const audience = str(req.query.audience);
  const context = req.callerContext;
  const forms = await loadForms();
  const submissions = await loadSubmissions();

  const visible = forms
    .filter((form) => !audience || form.audience === audience || form.audience === "all")
    .filter(
      (form) =>
        form.published ||
        context.permissions.has("forms.manage") ||
        canReviewForm(form, context),
    )
    .map((form) => ({
      ...shape(form, context),
      canTake: canTakeForm(form, context),
      canReview: canReviewForm(form, context),
      submissionCount: submissions.filter((entry) => entry.formId === form.id).length,
    }));

  res.json(visible);
});

/** One form, shaped the same way. */
router.get("/:formId", requirePermission("forms.view"), withCaller, async (req, res) => {
  const forms = await loadForms();
  const form = forms.find((entry) => entry.id === req.params.formId);
  if (!form) return res.status(404).json({ ok: false, message: "No such form." });

  const context = req.callerContext;
  if (!canTakeForm(form, context) && !canReviewForm(form, context)) {
    return res.status(403).json({
      ok: false,
      code: "AUTH_ROLE_MISSING",
      message: "Your Discord roles don't qualify you for this form yet.",
    });
  }
  res.json({
    ...shape(form, context),
    canTake: canTakeForm(form, context),
    canReview: canReviewForm(form, context),
  });
});

/**
 * The submissions for one form, graded. Reviewers only — the whole point of the
 * queue is that it carries other people's answers.
 */
router.get(
  "/:formId/submissions",
  requirePermission("forms.view"),
  withCaller,
  async (req, res) => {
    const forms = await loadForms();
    const form = forms.find((entry) => entry.id === req.params.formId);
    if (!form) return res.status(404).json({ ok: false, message: "No such form." });
    if (!canReviewForm(form, req.callerContext)) {
      return res.status(403).json({
        ok: false,
        code: "AUTH_ROLE_MISSING",
        message: "Reviewing this form's submissions needs a role its author granted.",
      });
    }

    const [submissions, overrides] = await Promise.all([loadSubmissions(), loadOverrides()]);
    res.json(
      submissions
        .filter((entry) => entry.formId === form.id)
        .map((entry) => gradeStored(form, entry, overrides.get(entry.id))),
    );
  },
);

/**
 * Grade a stored submission, applying any reviewer overrides on top. Grading on
 * read rather than storing the score means a corrected answer key re-grades the
 * whole history instead of leaving old results wrong.
 */
function gradeStored(form, submission, override) {
  const graded = { ...submission, ...gradeSubmission(form, submission.answers) };
  if (!override) return graded;
  return {
    ...applyReview(form, graded, override.points),
    reviewedBy: override.reviewer,
    reviewedAt: override.at,
  };
}

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

const NOT_PERSISTED =
  "Accepted, but not persisted — no database is configured, so this will reset on reload.";

/**
 * Submit a form. The body carries answers and nothing else that matters: the
 * score is computed here from the stored form, so a client cannot post its own
 * result, and an anonymous form records no identity at all.
 */
router.post("/:formId/submit", requirePermission("forms.submit"), withCaller, async (req, res) => {
  const forms = await loadForms();
  const form = forms.find((entry) => entry.id === req.params.formId);
  if (!form) return res.status(404).json({ ok: false, message: "No such form." });

  if (!canTakeForm(form, req.callerContext)) {
    return res.status(403).json({
      ok: false,
      code: "AUTH_ROLE_MISSING",
      message: "Your Discord roles don't qualify you for this form yet.",
    });
  }

  const answers = req.body?.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return res.status(400).json({ ok: false, errors: ["An answers object is required."] });
  }

  const missing = missingRequired(form, answers);
  if (missing.length > 0) {
    return res.status(400).json({
      ok: false,
      errors: [`${missing.length} required question${missing.length === 1 ? "" : "s"} left blank.`],
      missing,
    });
  }

  const result = gradeSubmission(form, answers);
  const id = `sub-${Date.now().toString(36)}`;
  const subject = form.anonymous
    ? null
    : {
        name: req.user?.displayName || req.user?.username || "Unknown",
        discordId: req.user?.id ?? null,
      };

  try {
    await query(
      `INSERT INTO form_submissions
        (id, form_id, subject_name, subject_discord_id, answers)
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        form.id,
        subject?.name ?? null,
        subject && isDiscordId(String(subject.discordId)) ? subject.discordId : null,
        JSON.stringify(answers),
      ],
    );
  } catch {
    return res.status(201).json({ ok: true, id, result: publicResult(form, result), message: NOT_PERSISTED });
  }

  res.status(201).json({ ok: true, id, result: publicResult(form, result) });
});

/**
 * What the person who just submitted is told. A pending review reports no score
 * — showing a partial one before a reviewer has scored the written answers
 * reads as a failure, and it is not one yet.
 */
function publicResult(form, result) {
  if (result.needsReview) {
    return { status: "needs-review", message: form.completionMessage || "" };
  }
  return {
    status: result.status,
    score: result.score,
    maxScore: result.maxScore,
    percent: result.percent,
    passThreshold: form.passThreshold,
    message: form.completionMessage || "",
  };
}

/** Score the flagged answers on one submission. */
router.post(
  "/:formId/submissions/:submissionId/review",
  requirePermission("forms.view"),
  withCaller,
  async (req, res) => {
    const forms = await loadForms();
    const form = forms.find((entry) => entry.id === req.params.formId);
    if (!form) return res.status(404).json({ ok: false, message: "No such form." });
    if (!canReviewForm(form, req.callerContext)) {
      return res.status(403).json({
        ok: false,
        code: "AUTH_ROLE_MISSING",
        message: "Grading this form needs a role its author granted.",
      });
    }

    const points = req.body?.points;
    if (!points || typeof points !== "object") {
      return res.status(400).json({ ok: false, errors: ["A points object is required."] });
    }

    // Never award more than a question is worth, whatever the body says.
    const byId = Object.fromEntries((form.questions || []).map((q) => [q.id, q]));
    const errors = collect(
      Object.entries(points).map(([questionId, value]) => [
        byId[questionId] != null &&
          Number.isFinite(Number(value)) &&
          Number(value) >= 0 &&
          Number(value) <= (Number(byId[questionId].points) || 0),
        `Invalid score for ${questionId}.`,
      ]),
    );
    if (errors.length > 0) return res.status(400).json({ ok: false, errors });

    try {
      for (const [questionId, value] of Object.entries(points)) {
        await query(
          `INSERT INTO form_reviews (submission_id, question_id, awarded, reviewer)
                VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE awarded = VALUES(awarded), reviewer = VALUES(reviewer),
                                   reviewed_at = CURRENT_TIMESTAMP`,
          [req.params.submissionId, questionId, Number(value), req.user?.id ?? null],
        );
      }
    } catch {
      return res.json({ ok: true, message: NOT_PERSISTED });
    }
    res.json({ ok: true });
  },
);

/** Create or replace a form. Authors only. */
router.put("/:formId", requirePermission("forms.manage"), withCaller, async (req, res) => {
  const incoming = req.body?.form;
  if (!incoming || typeof incoming !== "object") {
    return res.status(400).json({ ok: false, errors: ["A form object is required."] });
  }
  // The id is the route, never the payload: a save must not be able to
  // overwrite a different form by renaming itself.
  const form = { ...incoming, id: req.params.formId };

  const errors = collect([
    [str(form.title).length >= 3, "A form needs a title of at least 3 characters."],
    [Array.isArray(form.questions) && form.questions.length > 0, "A form needs at least one question."],
    [
      ["staff", "civilian", "all"].includes(form.audience),
      "Audience must be staff, civilian or all.",
    ],
    [
      Number(form.passThreshold) >= 0 && Number(form.passThreshold) <= 100,
      "The pass threshold must be between 0 and 100.",
    ],
  ]);
  if (errors.length > 0) return res.status(400).json({ ok: false, errors });

  try {
    await query(
      `INSERT INTO forms (id, audience, document, updated_by)
            VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE audience = VALUES(audience), document = VALUES(document),
                               updated_by = VALUES(updated_by)`,
      [form.id, form.audience, JSON.stringify(form), req.user?.id ?? null],
    );
  } catch {
    return res.json({ ok: true, form, message: NOT_PERSISTED });
  }
  res.json({ ok: true, form });
});

export default router;
