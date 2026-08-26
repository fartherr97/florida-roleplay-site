/**
 * The /api router. Every read follows the seed-fallback pattern so the whole
 * site works end-to-end before a database is provisioned: try the query, and on
 * any failure (or an empty result) serve the seed shape instead.
 */
import { Router } from "express";
import { changedRows, execute, query } from "../db.js";
import * as seed from "../seed.js";
import { attachUser } from "../middleware/requireRole.js";
import { requirePermission } from "../middleware/requirePermission.js";
import staffHubRouter from "./staffHub.js";
import civilianHubRouter from "./civilianHub.js";
import rosterRouter from "./roster.js";
import permissionsRouter from "./permissions.js";
import departmentHubRouter from "./departmentHub.js";
import formsRouter from "./forms.js";
import promotionsRouter from "./promotions.js";
import transfersRouter from "./transfers.js";
import disciplineRouter from "./discipline.js";
import supportRouter from "./support.js";
import authRouter from "./auth.js";
import {
  validateApplication,
  validateAssistantMessage,
  validateReport,
} from "../validate.js";

const router = Router();

router.use(attachUser);

// The hubs are gated sub-applications; their routes live in their own routers so
// the gating for each stays next to the query it protects.
router.use("/staff-hub", staffHubRouter);
router.use("/civilian-hub", civilianHubRouter);
// The roster is read by members and written by the Discord bot, so it sits
// alongside the hubs rather than inside either one.
router.use("/roster", rosterRouter);
// Access control is itself configurable, so it gets its own router.
router.use("/permissions", permissionsRouter);
// The department sites. Mounted at /dept rather than /departments because the
// public site already owns that path for its department directory — this one
// serves the config documents behind each department's own hub.
router.use("/dept", departmentHubRouter);
// Forms and exams are one engine serving both hubs, so the router sits beside
// them rather than inside either.
router.use("/forms", formsRouter);
// The promotion board spans the staff ladder rather than one hub, so it sits
// beside them too.
router.use("/promotions", promotionsRouter);
// The Emergency Services transfer portal, ported from the standalone
// es-transfer-portal app. It shares this site's session and permission model
// rather than carrying the Discord OAuth and role-map file it used to.
router.use("/transfers", transfersRouter);
// Disciplinary actions. One store for the staff team and every department,
// because a background check that covers half the community reads as a clean
// record rather than an incomplete one.
router.use("/discipline", disciplineRouter);
// The support portal. Members open tickets here; the support team works them.
router.use("/support", supportRouter);
// Discord OAuth. Mounted here with the rest so it shares the /api prefix and the
// same-origin cookie; the handshake itself needs no session, and attachUser
// above never blocks, so a signed-out visitor reaches /auth/login fine.
router.use("/auth", authRouter);

/** Try the DB query; on any failure, return the seed fallback. */
async function safe(res, dbFn, fallback) {
  try {
    const rows = await dbFn();
    res.json(rows && rows.length ? rows : fallback);
  } catch {
    res.json(fallback);
  }
}

/** Same contract as safe(), for endpoints returning a single object. */
async function safeOne(res, dbFn, fallback) {
  try {
    const row = await dbFn();
    res.json(row ?? fallback);
  } catch {
    res.json(fallback);
  }
}

/** JSONB comes back parsed; a TEXT column holding JSON does not. */
function parseJson(value, fallback = []) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Reference ids are human-quotable in a Discord ticket. */
function reference(prefix) {
  const year = new Date().getFullYear();
  const n = Math.floor(Math.random() * 90000) + 10000;
  return `${prefix}-${year}-${n}`;
}

/* ---------------------------------------------------------------- health */

router.get("/health", (_req, res) => res.json({ ok: true }));

/* --------------------------------------------------------- server status */

router.get("/server-status", async (_req, res) => {
  // TODO: poll the live FiveM server endpoint instead of serving seed numbers.
  res.json(seed.serverStatus);
});

/* ----------------------------------------------------------- departments */

function mapDepartment(row) {
  return {
    id: row.id,
    name: row.name,
    abbr: row.abbr,
    tone: row.tone,
    icon: row.icon,
    tagline: row.tagline,
    mission: row.mission,
    roster: row.roster,
    hiring: Boolean(row.hiring),
    ranks: parseJson(row.ranks),
    fleet: parseJson(row.fleet),
    applicationType: row.application_type,
  };
}

router.get("/departments", (_req, res) =>
  safe(
    res,
    async () => {
      const rows = await query("SELECT * FROM departments ORDER BY sort_order, name");
      return rows.map(mapDepartment);
    },
    seed.departments,
  ),
);

router.get("/departments/:id", (req, res) =>
  safeOne(
    res,
    async () => {
      const rows = await query("SELECT * FROM departments WHERE id = $1 LIMIT 1", [
        req.params.id,
      ]);
      return rows.length ? mapDepartment(rows[0]) : null;
    },
    seed.departments.find((d) => d.id === req.params.id) ?? null,
  ),
);

/* ----------------------------------------------------------------- rules */

/** Groups flat rule rows back into the category shape the client renders. */
function groupRules(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.category_id)) {
      groups.set(row.category_id, {
        id: row.category_id,
        category: row.category,
        description: row.category_description,
        items: [],
      });
    }
    groups.get(row.category_id).items.push({
      id: row.id,
      number: row.number,
      title: row.title,
      body: row.body,
    });
  });
  return [...groups.values()];
}

/** Mirrors the client's fallback filter so both paths behave identically. */
function filterSeedRules(q) {
  const needle = q.toLowerCase();
  return seed.rules
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.title.toLowerCase().includes(needle) ||
          item.body.toLowerCase().includes(needle) ||
          item.number.includes(needle) ||
          group.category.toLowerCase().includes(needle),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

router.get("/rules", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const fallback = q ? filterSeedRules(q) : seed.rules;

  safe(
    res,
    async () => {
      if (!q) {
        const rows = await query("SELECT * FROM rules ORDER BY category_id, sort_order, number");
        return groupRules(rows);
      }
      const like = `%${q}%`;
      const rows = await query(`SELECT * FROM rules
          WHERE title LIKE $1 OR body LIKE $2 OR number LIKE $3 OR category LIKE $4
          ORDER BY category_id, sort_order, number`,
        [like, like, like, like],
      );
      return groupRules(rows);
    },
    fallback,
  );
});

/* ----------------------------------------------------------------- staff */

/**
 * The staff roster is staff-only: it lists internal team structure. A caller
 * without a staff role gets a 403 carrying the code the client's AccessDenied
 * page renders.
 */
router.get("/staff", requirePermission("site.staff_directory"), (_req, res) =>
  safe(
    res,
    async () => {
      const rows = await query("SELECT * FROM staff ORDER BY sort_order, name");
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        handle: row.handle,
        role: row.role,
        group: row.team,
        department: row.department,
        tone: row.tone,
        online: Boolean(row.online),
      }));
    },
    seed.staff,
  ),
);

/* ----------------------------------------------------------- patch notes */

function mapPatchNote(row) {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    tag: row.tag,
    tone: row.tone,
    releasedAt:
      row.released_at instanceof Date
        ? row.released_at.toISOString().slice(0, 10)
        : row.released_at,
    changes: parseJson(row.changes),
  };
}

router.get("/patch-notes", (_req, res) =>
  safe(
    res,
    async () => {
      const rows = await query("SELECT * FROM patch_notes ORDER BY released_at DESC");
      return rows.map(mapPatchNote);
    },
    seed.patchNotes,
  ),
);

router.get("/patch-notes/latest", (_req, res) =>
  safeOne(
    res,
    async () => {
      const rows = await query("SELECT * FROM patch_notes ORDER BY released_at DESC LIMIT 1",
      );
      return rows.length ? mapPatchNote(rows[0]) : null;
    },
    seed.patchNotes[0],
  ),
);

/* ---------------------------------------------------------- applications */

router.get("/applications/types", (_req, res) => res.json(seed.applicationTypes));

router.post("/applications", async (req, res) => {
  const { errors, value } = validateApplication(req.body ?? {});
  if (errors.length > 0) return res.status(400).json({ ok: false, errors });

  const id = reference("APP");
  try {
    await query(`INSERT INTO applications
        (reference, type, discord_id, discord_name, age_range, experience,
         character_name, backstory, scenario)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        value.type,
        value.discordId,
        value.discordName,
        value.age,
        value.experience,
        value.characterName,
        value.backstory,
        value.scenario,
      ],
    );
  } catch {
    // No database yet — the reference is still returned so the flow completes.
  }
  return res.status(201).json({ ok: true, id });
});

router.get("/applications/:id", (req, res) =>
  safeOne(
    res,
    async () => {
      const rows = await query(`SELECT reference AS id, type, status, created_at AS "createdAt" FROM applications WHERE reference = $1 LIMIT 1`,
        [req.params.id],
      );
      return rows.length ? rows[0] : null;
    },
    { id: req.params.id, status: "Pending Review" },
  ),
);

/* ------------------------------------------------------------ whitelist */

/**
 * Soft whitelist: forward a signed-in member's answers to the bot API, which
 * posts them to a staff review channel with Approve/Deny buttons. The member's
 * Discord identity comes from their session — never the request body — so an
 * applicant cannot submit under somebody else's id. Server-to-server, keyed by a
 * shared ingest token; the bot does the Discord work.
 */
router.post("/whitelist", async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(403).json({ ok: false, code: "AUTH_SIGNED_OUT", message: "Sign in with Discord to apply." });
  }

  const rawAnswers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const answers = rawAnswers
    .map((entry) => ({
      question: String(entry?.question ?? "").slice(0, 300).trim(),
      answer: String(entry?.answer ?? "").slice(0, 2000).trim(),
    }))
    .filter((entry) => entry.question && entry.answer);

  if (answers.length === 0) {
    return res.status(400).json({ ok: false, message: "Answer the questions before submitting." });
  }

  const botUrl = process.env.BOT_API_URL;
  const token = process.env.WHITELIST_INGEST_TOKEN;
  if (!botUrl || !token) {
    return res.status(503).json({
      ok: false,
      code: "WHITELIST_NOT_CONFIGURED",
      message: "Whitelist applications are not set up yet. Please check back soon.",
    });
  }

  try {
    const response = await fetch(`${botUrl.replace(/\/$/, "")}/api/whitelist/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-service-token": token },
      body: JSON.stringify({
        discordUserId: user.id,
        username: user.displayName ?? user.username ?? "Unknown",
        answers,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return res.status(502).json({
        ok: false,
        message: body?.error?.message ?? body?.message ?? "Your application could not be submitted. Please try again.",
      });
    }

    const data = await response.json().catch(() => ({}));
    return res.status(201).json({ ok: true, id: data.id ?? null });
  } catch {
    return res.status(502).json({ ok: false, message: "Could not reach the whitelist service. Please try again shortly." });
  }
});

/* -------------------------------------------------------------------- me */

router.get("/me", (req, res) => res.json(req.user ?? null));

/* ------------------------------------------------------ store/supporters */

router.get("/store/tiers", (_req, res) =>
  safe(
    res,
    async () => {
      const rows = await query("SELECT * FROM store_tiers ORDER BY sort_order, price");
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        price: row.price,
        period: row.period,
        tone: row.tone,
        popular: Boolean(row.popular),
        blurb: row.blurb,
        features: parseJson(row.features),
      }));
    },
    seed.storeTiers,
  ),
);

/* ---------------------------------------------------------------- events */

router.get("/events", (_req, res) =>
  safe(
    res,
    async () => {
      const rows = await query("SELECT * FROM events ORDER BY event_date DESC");
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        date:
          row.event_date instanceof Date
            ? row.event_date.toISOString().slice(0, 10)
            : row.event_date,
        time: row.event_time,
        location: row.location,
        status: row.status,
        attendance: row.attendance,
        description: row.description,
      }));
    },
    seed.events,
  ),
);

/* -------------------------------------------------------- knowledge base */

function mapArticle(row) {
  return {
    slug: row.slug,
    title: row.title,
    category: row.category,
    summary: row.summary,
    readingTime: row.reading_time,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString().slice(0, 10)
        : row.updated_at,
    body: parseJson(row.body),
  };
}

router.get("/knowledge-base", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const needle = q.toLowerCase();
  const fallback = q
    ? seed.knowledgeBase.filter(
        (a) =>
          a.title.toLowerCase().includes(needle) ||
          a.summary.toLowerCase().includes(needle) ||
          a.category.toLowerCase().includes(needle),
      )
    : seed.knowledgeBase;

  safe(
    res,
    async () => {
      if (!q) {
        const rows = await query("SELECT * FROM articles ORDER BY category, title");
        return rows.map(mapArticle);
      }
      const like = `%${q}%`;
      const rows = await query(`SELECT * FROM articles
          WHERE title LIKE $1 OR summary LIKE $2 OR category LIKE $3
          ORDER BY category, title`,
        [like, like, like],
      );
      return rows.map(mapArticle);
    },
    fallback,
  );
});

router.get("/knowledge-base/:slug", (req, res) =>
  safeOne(
    res,
    async () => {
      const rows = await query("SELECT * FROM articles WHERE slug = $1 LIMIT 1", [
        req.params.slug,
      ]);
      return rows.length ? mapArticle(rows[0]) : null;
    },
    seed.knowledgeBase.find((a) => a.slug === req.params.slug) ?? null,
  ),
);

/* --------------------------------------------------------------- reports */

router.post("/reports", async (req, res) => {
  const { errors, value } = validateReport(req.body ?? {});
  if (errors.length > 0) return res.status(400).json({ ok: false, errors });

  const id = reference("RPT");
  try {
    await query(`INSERT INTO reports
        (reference, type, discord_id, involved, occurred_at, evidence, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        value.type,
        value.discordId,
        value.involved,
        value.occurredAt,
        value.evidence,
        value.description,
      ],
    );
  } catch {
    // No database yet — the reference is still returned so the flow completes.
  }
  return res.status(201).json({ ok: true, id });
});

/**
 * The moderation queue.
 *
 * Reports had a write path and no read path — they went into the table and
 * nobody could see them. This is the staff side, gated on `site.moderation`.
 */
router.get("/reports", requirePermission("site.moderation"), async (_req, res) => {
  try {
    const rows = await query(`SELECT reference, type, discord_id AS "discordId", involved, occurred_at AS "occurredAt",
              evidence, description, status, created_at AS "createdAt"
         FROM reports ORDER BY created_at DESC LIMIT 500`,
    );
    return res.json({ reports: rows });
  } catch {
    return res.json({ reports: seed.reportQueue ?? [] });
  }
});

/** Move one through the queue. */
router.post("/reports/:reference/status", requirePermission("site.moderation"), async (req, res) => {
  const status = String(req.body?.status ?? "");
  const allowed = ["Pending Review", "Investigating", "Actioned", "Dismissed"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ ok: false, message: "No such status." });
  }
  try {
    const result = await execute("UPDATE reports SET status = $1 WHERE reference = $2", [
      status,
      String(req.params.reference),
    ]);
    if (!changedRows(result)) {
      return res.status(404).json({ ok: false, message: "No such report." });
    }
  } catch {
    return res.status(503).json({ ok: false, message: "Reports need a database. Nothing was changed." });
  }
  res.json({ ok: true, status });
});

/* ------------------------------------------------------------- assistant */

router.post("/assistant", (req, res) => {
  const { errors, value } = validateAssistantMessage(req.body ?? {});
  if (errors.length > 0) return res.status(400).json({ ok: false, errors });

  // TODO: hand the message to a real model. Canned topic matching for now.
  const message = value.message.toLowerCase();
  const hit = seed.assistantReplies.find((entry) =>
    entry.match.some((keyword) => message.includes(keyword)),
  );
  return res.json({ reply: hit ? hit.reply : seed.assistantFallback });
});

export default router;
