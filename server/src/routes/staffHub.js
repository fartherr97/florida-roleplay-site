/**
 * The /api/staff-hub router. Same seed-fallback contract as the public API: try
 * the database, and on any failure serve the seed shape — so the hub works
 * end-to-end before Postgres is provisioned.
 *
 * Every route here names a permission rather than a rank. The grants behind
 * those permissions are editable from the Permissions page, and the client gates
 * the matching route on the same key — so the nav, the route guard and this file
 * cannot disagree. Hiding a link is a convenience; this file is the boundary.
 */
import { Router } from "express";
import { execute, query, changedRows } from "../db.js";
import * as seed from "../staffHubSeed.js";
import { requirePermission } from "../middleware/requirePermission.js";
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

router.get("/portal", requirePermission("staff.view"), async (_req, res) => {
  try {
    // The table is keyed by section and holds one row per section — there is
    // nothing to filter, and the `id = 1` this used to carry was left over from
    // a single-row table it has not been for a long time.
    const rows = await query("SELECT section, payload FROM hub_portal");
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

router.post("/portal/:section", requirePermission("staff.portal.manage"), async (req, res) => {
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
      // A list of strings, checked to the element. The page renders each one
      // directly, so an array of objects is accepted by a looser check and then
      // crashes the page it was just saved to — the API has to refuse a shape
      // it cannot render.
      key !== "reminders" ||
        (Array.isArray(body.reminders) &&
          body.reminders.every((entry) => typeof entry === "string" && entry.length <= 500)),
      "Reminders must be a list of strings, each under 500 characters.",
    ],
    [
      key !== "links" ||
        (Array.isArray(body.links) &&
          body.links.every((entry) => entry && typeof entry === "object")),
      "Links must be a list of link objects.",
    ],
  ]);
  if (errors.length) return res.status(400).json({ ok: false, errors });

  try {
    // The section's value, not the envelope it arrived in. Storing the whole
    // body nested it one level deeper than the reader expects — `reminders`
    // came back as `{ reminders: [...] }`, and the page crashed mapping over an
    // object. It only ever showed up once somebody actually saved, because the
    // seed fallback has the right shape.
    await query(`INSERT INTO hub_portal (section, payload) VALUES ($1, $2)
         ON CONFLICT (section) DO UPDATE SET payload = EXCLUDED.payload`,
      [key, JSON.stringify(body[key] ?? null)],
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

router.get("/roster", requirePermission("staff.view"), (_req, res) =>
  safe(
    res,
    async () => {
      const rows = await query("SELECT * FROM hub_roster ORDER BY rank_order DESC, callsign, name",
      );
      return rows.map((row) => ({
        id: row.id,
        callsign: row.callsign,
        name: row.name,
        handle: row.handle,
        discordId: row.discord_id,
        rank: row.rank_label,
        rankId: row.rank_id,
        team: row.team,
        position: row.position,
        positionNote: row.position_note,
        hired: isoDate(row.hired),
        lastMove: isoDate(row.last_move),
        claims: row.claims,
        vestHours: row.vest_hours,
        status: row.status,
        loaUntil: isoDate(row.loa_until),
        online: Boolean(row.online),
        notes: row.notes,
        // A structured position nobody holds. Rendering the gap is the point,
        // so vacancies come back with the roster rather than being filtered out.
        vacant: Boolean(row.vacant),
      }));
    },
    seed.roster,
  ),
);

/**
 * Trial moderators still on probation and the administrator signing off on
 * them. Its own endpoint rather than a field on the roster: it is read beside
 * the roster but it is a different list, and folding it in would mean every
 * roster read carried it whether or not the page showed it.
 */
router.get("/training", requirePermission("staff.view"), (_req, res) =>
  safe(
    res,
    async () => {
      const rows = await query("SELECT * FROM hub_training ORDER BY since DESC",
      );
      return rows.map((row) => ({
        id: row.id,
        trainee: row.trainee,
        admin: row.admin_name,
        since: isoDate(row.since),
      }));
    },
    seed.training,
  ),
);

/* ----------------------------------------------------------- dashboard */

router.get("/dashboard", requirePermission("staff.view"), (_req, res) =>
  // TODO: derive these from the live ticket system once it exposes an API.
  res.json(seed.dashboard),
);

router.get("/checklist", requirePermission("staff.view"), (_req, res) =>
  safe(res, async () => [], seed.checklist),
);

/* ------------------------------------------------------- disciplinary */

router.get("/disciplinary", requirePermission("staff.da_view"), (_req, res) =>
  safe(
    res,
    async () => {
      const rows = await query("SELECT * FROM hub_disciplinary ORDER BY issued_at DESC",
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

router.get("/exams/dashboard", requirePermission("exams.view"), async (_req, res) => {
  res.json(buildExamDashboard(await loadAttempts()));
});

router.get("/exams/attempts/:id", requirePermission("exams.view"), async (req, res) => {
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
  requirePermission("exams.override"),
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

    // The attempt is updated FIRST, and the append-only audit row is written
    // only if that landed. The other order leaves the two disagreeing: an audit
    // entry saying the score was changed to 29/30 beside an attempt still
    // reading 28/30, which is worse than either outcome on its own. Attempts
    // exist only as seed data until something inserts them, so a zero-row
    // update here is the normal case rather than an error.
    let persisted = false;
    try {
      const result = await execute(`UPDATE hub_attempts
            SET score = $1, status = $2, override_payload = $3
          WHERE attempt_id = $4`,
        [
          override.overrideScore,
          override.overrideStatus,
          JSON.stringify(override),
          override.attemptId,
        ],
      );
      persisted = changedRows(result);
      if (persisted) {
        await query(`INSERT INTO hub_overrides
             (attempt_id, discord_id, staff_name, exam_type, original_score,
              original_status, override_score, override_status, reviewer, reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            override.attemptId, override.discordId, override.staffName,
            override.examType, override.originalScore, override.originalStatus,
            override.overrideScore, override.overrideStatus, override.reviewer,
            override.reason,
          ],
        );
      }
    } catch {
      // No database yet — the override is still echoed so the flow completes.
    }

    return res.status(201).json({
      ok: true,
      data: override,
      persisted,
      ...(persisted
        ? {}
        : {
            message:
              "Not saved: this attempt has no stored record, so the score was left " +
              "unchanged and no audit entry was written.",
          }),
    });
  },
);

router.get("/exams/members", requirePermission("exams.view"), async (req, res) => {
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

router.get("/exams/members/:identifier", requirePermission("exams.view"), async (req, res) => {
  const identifier = String(req.params.identifier).toLowerCase();
  const member = buildMembers(await loadAttempts()).find(
    (m) =>
      m.memberKey.toLowerCase() === identifier ||
      String(m.discordId).toLowerCase() === identifier,
  );
  if (!member) return res.status(404).json({ ok: false, error: "Member not found" });
  res.json(member);
});

router.get("/exams/audit-log", requirePermission("exams.audit"), (_req, res) =>
  safe(
    res,
    async () => {
      const rows = await query("SELECT * FROM hub_overrides ORDER BY created_at DESC",
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

router.get("/exams/settings", requirePermission("exams.manage"), async (_req, res) => {
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

router.post("/exams/settings", requirePermission("exams.manage"), async (req, res) => {
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
      await query(`INSERT INTO hub_exam_settings
           (exam_type, pass_score, review_min, review_max, max_score)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (exam_type) DO UPDATE SET
           pass_score = EXCLUDED.pass_score, review_min = EXCLUDED.review_min,
           review_max = EXCLUDED.review_max, max_score = EXCLUDED.max_score`,
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

router.get("/exams/question-catalog", requirePermission("exams.manage"), (_req, res) =>
  safe(
    res,
    async () => {
      const rows = await query("SELECT * FROM hub_questions ORDER BY exam_type, question_number",
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
  requirePermission("exams.manage"),
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
      const result = await execute(`UPDATE hub_questions
            SET question_text = $1, points = $2, correct_answer = $3
          WHERE id = $4`,
        [questionText, points, correctAnswer, rowNumber],
      );
      if (!changedRows(result)) {
        return res.json({
          ok: false,
          message:
            "Not saved: the question catalog is running on seed data with no stored " +
            "rows, so there was nothing to update.",
        });
      }
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
