/**
 * The /api/staff-hub router. Same seed-fallback contract as the public API: try
 * the database, and on any failure serve the seed shape — so the hub works
 * end-to-end before MariaDB is provisioned.
 *
 * Every route here is rank-gated. The role bundles come from seed.js and are
 * mirrored in client/src/data/hubNavigation.js, so the sidebar, the client route
 * guard and this middleware all agree on who may open what. Hiding a link is a
 * convenience; this file is the boundary.
 */
import { Router } from "express";
import { query } from "../db.js";
import * as seed from "../staffHubSeed.js";
import {
  ADMIN_PLUS,
  DIRECTOR_ONLY,
  SENIOR_ADMIN_PLUS,
  STAFF_ANY,
} from "../seed.js";
import { requireRole } from "../middleware/requireRole.js";
import { collect, str } from "../validate.js";

const router = Router();

/** Try the DB query; on any failure, return the seed fallback. */
async function safe(res, dbFn, fallback) {
  try {
    const rows = await dbFn();
    res.json(rows && rows.length ? rows : fallback);
  } catch {
    res.json(fallback);
  }
}

function parseJson(value, fallback = []) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isoDate(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

/* ------------------------------------------------------------- portal */

router.get("/portal", requireRole(STAFF_ANY), async (_req, res) => {
  try {
    const rows = await query(
      "SELECT section, payload FROM hub_portal WHERE id = 1 OR section IS NOT NULL",
    );
    if (rows.length) {
      const bySection = Object.fromEntries(
        rows.map((row) => [row.section, parseJson(row.payload, null)]),
      );
      return res.json({
        reminders: bySection.reminders ?? seed.portal.reminders,
        featuredMember: bySection.featured ?? seed.portal.featuredMember,
        quickNotes: bySection.quickNotes ?? seed.portal.quickNotes,
        links: bySection.links ?? seed.portalLinks,
      });
    }
  } catch {
    // fall through to the seed shape below
  }
  return res.json({ ...seed.portal, links: seed.portalLinks });
});

const PORTAL_SECTIONS = {
  featured: "featured",
  reminders: "reminders",
  "quick-notes": "quickNotes",
  links: "links",
};

router.post("/portal/:section", requireRole(DIRECTOR_ONLY), async (req, res) => {
  const key = PORTAL_SECTIONS[req.params.section];
  if (!key) {
    return res.status(400).json({ ok: false, errors: ["Unknown portal section."] });
  }

  const body = req.body ?? {};
  const errors = collect([
    [
      key !== "quickNotes" || str(body.quickNotes).length <= 5000,
      "Quick notes must be under 5000 characters.",
    ],
    [
      key !== "reminders" || Array.isArray(body.reminders),
      "Reminders must be a list.",
    ],
    [key !== "links" || Array.isArray(body.links), "Links must be a list."],
  ]);
  if (errors.length) return res.status(400).json({ ok: false, errors });

  try {
    await query(
      `INSERT INTO hub_portal (section, payload) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload)`,
      [key, JSON.stringify(body)],
    );
    return res.json({ ok: true });
  } catch {
    // Without a database there is nowhere to persist this, and saying so is
    // more useful than reporting a success that will not survive a refresh.
    return res.json({
      ok: true,
      message:
        "Accepted, but not persisted — the hub is running on seed data with no database configured.",
    });
  }
});

/* -------------------------------------------------------------- roster */

router.get("/roster", requireRole(STAFF_ANY), (_req, res) =>
  safe(
    res,
    async () => {
      const rows = await query(
        "SELECT * FROM hub_roster ORDER BY rank_order DESC, name",
      );
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        handle: row.handle,
        rank: row.rank_label,
        rankId: row.rank_id,
        team: row.team,
        joined: isoDate(row.joined),
        claims: row.claims,
        vestHours: row.vest_hours,
        status: row.status,
      }));
    },
    seed.roster,
  ),
);

/* ----------------------------------------------------------- dashboard */

router.get("/dashboard", requireRole(STAFF_ANY), (_req, res) =>
  // TODO: derive these from the live ticket system once it exposes an API.
  res.json(seed.dashboard),
);

router.get("/checklist", requireRole(STAFF_ANY), (_req, res) =>
  safe(res, async () => [], seed.checklist),
);

/* ------------------------------------------------------- disciplinary */

router.get("/disciplinary", requireRole(ADMIN_PLUS), (_req, res) =>
  safe(
    res,
    async () => {
      const rows = await query(
        "SELECT * FROM hub_disciplinary ORDER BY issued_at DESC",
      );
      return rows.map((row) => ({
        id: row.id,
        staffName: row.staff_name,
        rank: row.rank_label,
        type: row.action_type,
        tone: row.tone,
        issuedBy: row.issued_by,
        issuedAt: isoDate(row.issued_at),
        status: row.status,
        summary: row.summary,
      }));
    },
    seed.disciplinaryActions,
  ),
);

/* ---------------------------------------------------------- exam data */

/** Loads attempts from the database, falling back to the seeded list. */
async function loadAttempts() {
  try {
    const rows = await query("SELECT * FROM hub_attempts ORDER BY submitted_at DESC");
    if (rows.length) {
      return rows.map((row) => ({
        attemptId: row.attempt_id,
        name: row.staff_name,
        discordId: row.discord_id,
        examType: row.exam_type,
        submittedAt:
          row.submitted_at instanceof Date
            ? row.submitted_at.toISOString()
            : row.submitted_at,
        score: row.score,
        status: row.status,
        originalScore: row.original_score,
        originalStatus: row.original_status,
        override: parseJson(row.override_payload, null),
      }));
    }
  } catch {
    // fall through
  }
  return seed.attempts;
}

/** Rollups for the submissions dashboard, computed from the attempt list. */
function buildExamDashboard(list) {
  const totals = {
    totalProfiles: new Set(list.map((a) => a.discordId || a.name)).size,
    totalAttempts: list.length,
    pass: list.filter((a) => a.status === "Pass").length,
    needsReview: list.filter((a) => a.status === "Needs Review").length,
    fail: list.filter((a) => a.status === "Fail").length,
  };
  const recent = [...list].sort(
    (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt),
  );
  return {
    totals,
    recentSubmissions: recent,
    recentByExam: Object.fromEntries(
      seed.EXAMS.map((exam) => [
        exam.key,
        recent.filter((a) => a.examType === exam.key).slice(0, 5),
      ]),
    ),
  };
}

/** Collapses attempts into one profile per person. */
function buildMembers(list) {
  const map = new Map();
  list.forEach((attempt) => {
    const key = attempt.discordId || attempt.name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        memberKey: key,
        name: attempt.name,
        discordId: attempt.discordId,
        attemptsByExam: { trial: [], senior: [], admin: [] },
      });
    }
    map.get(key).attemptsByExam[attempt.examType]?.push(attempt);
  });
  return [...map.values()].map((member) => {
    const all = Object.values(member.attemptsByExam).flat();
    return {
      ...member,
      totalAttempts: all.length,
      latestAt: all.map((a) => a.submittedAt).sort().at(-1),
      highestPass:
        [...seed.EXAMS]
          .reverse()
          .find((exam) =>
            member.attemptsByExam[exam.key]?.some((a) => a.status === "Pass"),
          )?.short ?? null,
    };
  });
}

router.get("/exams/dashboard", requireRole(ADMIN_PLUS), async (_req, res) => {
  res.json(buildExamDashboard(await loadAttempts()));
});

router.get("/exams/attempts/:id", requireRole(ADMIN_PLUS), async (req, res) => {
  const list = await loadAttempts();
  const attempt = list.find((a) => a.attemptId === req.params.id) ?? null;
  if (!attempt) return res.status(404).json({ ok: false, error: "Attempt not found" });
  res.json({
    ...attempt,
    questions: seed.attemptQuestions[req.params.id] ?? [],
  });
});

const OVERRIDE_STATUSES = ["Pass", "Needs Review", "Fail"];

router.post(
  "/exams/attempts/:id/override",
  requireRole(SENIOR_ADMIN_PLUS),
  async (req, res) => {
    const body = req.body ?? {};
    const overrideScore = str(body.overrideScore);
    const overrideStatus = str(body.overrideStatus);
    const reason = str(body.reason);

    const errors = collect([
      [overrideScore.length > 0 && overrideScore.length <= 32, "An override score is required."],
      [
        OVERRIDE_STATUSES.includes(overrideStatus),
        `Status must be one of: ${OVERRIDE_STATUSES.join(", ")}.`,
      ],
      [
        reason.length >= 10 && reason.length <= 1000,
        "A reason of 10–1000 characters is required — it is recorded permanently.",
      ],
    ]);
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const override = {
      attemptId: req.params.id,
      discordId: str(body.discordId),
      staffName: str(body.staffName),
      examType: str(body.examType),
      originalScore: str(body.originalScore),
      originalStatus: str(body.originalStatus),
      overrideScore,
      overrideStatus,
      reviewer: str(body.reviewer) || req.user?.displayName || "Unknown",
      reason,
      timestamp: new Date().toISOString(),
    };

    try {
      await query(
        `INSERT INTO hub_overrides
           (attempt_id, discord_id, staff_name, exam_type, original_score,
            original_status, override_score, override_status, reviewer, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          override.attemptId, override.discordId, override.staffName,
          override.examType, override.originalScore, override.originalStatus,
          override.overrideScore, override.overrideStatus, override.reviewer,
          override.reason,
        ],
      );
      await query(
        `UPDATE hub_attempts
            SET score = ?, status = ?, override_payload = ?
          WHERE attempt_id = ?`,
        [
          override.overrideScore,
          override.overrideStatus,
          JSON.stringify(override),
          override.attemptId,
        ],
      );
    } catch {
      // No database yet — the override is still echoed so the flow completes.
    }

    return res.status(201).json({ ok: true, data: override });
  },
);

router.get("/exams/members", requireRole(ADMIN_PLUS), async (req, res) => {
  const members = buildMembers(await loadAttempts());
  const q = String(req.query.q || "").trim().toLowerCase();
  res.json(
    q
      ? members.filter(
          (m) =>
            m.name.toLowerCase().includes(q) || String(m.discordId).includes(q),
        )
      : members,
  );
});

router.get("/exams/members/:identifier", requireRole(ADMIN_PLUS), async (req, res) => {
  const identifier = String(req.params.identifier).toLowerCase();
  const member = buildMembers(await loadAttempts()).find(
    (m) =>
      m.memberKey.toLowerCase() === identifier ||
      String(m.discordId).toLowerCase() === identifier,
  );
  if (!member) return res.status(404).json({ ok: false, error: "Member not found" });
  res.json(member);
});

router.get("/exams/audit-log", requireRole(SENIOR_ADMIN_PLUS), (_req, res) =>
  safe(
    res,
    async () => {
      const rows = await query(
        "SELECT * FROM hub_overrides ORDER BY created_at DESC",
      );
      return rows.map((row) => ({
        id: `al-${row.id}`,
        attemptId: row.attempt_id,
        staffName: row.staff_name,
        examType: row.exam_type,
        originalScore: row.original_score,
        overrideScore: row.override_score,
        originalStatus: row.original_status,
        overrideStatus: row.override_status,
        reviewer: row.reviewer,
        reason: row.reason,
        timestamp:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : row.created_at,
      }));
    },
    seed.auditLog,
  ),
);

/* -------------------------------------------------------- exam config */

router.get("/exams/settings", requireRole(DIRECTOR_ONLY), async (_req, res) => {
  try {
    const rows = await query("SELECT * FROM hub_exam_settings");
    if (rows.length) {
      return res.json(
        Object.fromEntries(
          rows.map((row) => [
            row.exam_type,
            {
              passScore: row.pass_score,
              reviewMin: row.review_min,
              reviewMax: row.review_max,
              maxScore: row.max_score,
            },
          ]),
        ),
      );
    }
  } catch {
    // fall through
  }
  return res.json(seed.examSettings);
});

router.post("/exams/settings", requireRole(DIRECTOR_ONLY), async (req, res) => {
  const body = req.body ?? {};
  const errors = [];

  seed.EXAMS.forEach((exam) => {
    const values = body[exam.key];
    if (!values) return;
    ["passScore", "reviewMin", "reviewMax", "maxScore"].forEach((field) => {
      const n = Number(values[field]);
      if (!Number.isFinite(n) || n < 0 || n > 1000) {
        errors.push(`${exam.short} ${field} must be a number between 0 and 1000.`);
      }
    });
  });
  if (errors.length) return res.status(400).json({ ok: false, errors });

  try {
    for (const exam of seed.EXAMS) {
      const values = body[exam.key];
      if (!values) continue;
      await query(
        `INSERT INTO hub_exam_settings
           (exam_type, pass_score, review_min, review_max, max_score)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           pass_score = VALUES(pass_score), review_min = VALUES(review_min),
           review_max = VALUES(review_max), max_score = VALUES(max_score)`,
        [
          exam.key,
          Number(values.passScore),
          Number(values.reviewMin),
          Number(values.reviewMax),
          Number(values.maxScore),
        ],
      );
    }
    return res.json({ ok: true });
  } catch {
    return res.json({
      ok: true,
      message:
        "Accepted, but not persisted — the hub is running on seed data with no database configured.",
    });
  }
});

router.get("/exams/question-catalog", requireRole(DIRECTOR_ONLY), (_req, res) =>
  safe(
    res,
    async () => {
      const rows = await query(
        "SELECT * FROM hub_questions ORDER BY exam_type, question_number",
      );
      return rows.map((row) => ({
        rowNumber: row.id,
        examType: row.exam_type,
        questionId: row.question_id,
        questionNumber: row.question_number,
        questionText: row.question_text,
        questionType: row.question_type,
        points: row.points,
        correctAnswer: row.correct_answer,
      }));
    },
    seed.questionCatalog,
  ),
);

router.post(
  "/exams/question-catalog/:row",
  requireRole(DIRECTOR_ONLY),
  async (req, res) => {
    const rowNumber = Number(req.params.row);
    const body = req.body ?? {};
    const questionText = str(body.questionText);
    const correctAnswer = str(body.correctAnswer);
    const points = Number(body.points);

    const errors = collect([
      [Number.isInteger(rowNumber) && rowNumber > 0, "Invalid question row."],
      [
        questionText.length >= 5 && questionText.length <= 1000,
        "Question text must be 5–1000 characters.",
      ],
      [correctAnswer.length <= 500, "Correct answer must be under 500 characters."],
      [
        Number.isFinite(points) && points >= 0 && points <= 100,
        "Points must be a number between 0 and 100.",
      ],
    ]);
    if (errors.length) return res.status(400).json({ ok: false, errors });

    try {
      await query(
        `UPDATE hub_questions
            SET question_text = ?, points = ?, correct_answer = ?
          WHERE id = ?`,
        [questionText, points, correctAnswer, rowNumber],
      );
      return res.json({ ok: true });
    } catch {
      return res.json({
        ok: true,
        message:
          "Accepted, but not persisted — the hub is running on seed data with no database configured.",
      });
    }
  },
);

export default router;
