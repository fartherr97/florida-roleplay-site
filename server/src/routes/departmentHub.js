/**
 * The /api/departments router — the department hub engine's backend.
 *
 * A department site is one config document. This router reads it, shapes it to
 * the caller, and takes writes back. Two things make it more than a key-value
 * store:
 *
 *  1. **Two write surfaces, not one.** `PUT /:deptId/config` replaces the whole
 *     document and needs the `manage` capability — that is the Builder Portal.
 *     `PUT /:deptId/pages/:pageId` writes only one page's own `config` blob and
 *     needs whatever capability that page type declares, so the fleet editor
 *     cannot reach the access table on its way past.
 *  2. **Every write is versioned and audited.** A department that breaks its own
 *     site can restore the previous version instead of filing a ticket.
 *
 * Like every other router here, reads fall back to the seeds when no database is
 * configured, so the whole department hub works before one is provisioned —
 * writes in that mode are accepted and reported as not persisted rather than
 * failing silently.
 */
import { Router } from "express";
import { query } from "../db.js";
import { DEPARTMENT_CONFIGS } from "../departmentSeed.js";
import { roster as rosterSeed, ROLE_MAP } from "../rosterSeed.js";
import { requirePermission, loadGrants } from "../middleware/requirePermission.js";
import { resolveUser } from "../middleware/requireRole.js";
import { permissionsFor } from "../permissions.js";
import { projectRoster } from "../lib/deptRoster.js";
import { resolveDepartmentId } from "../lib/tenant.js";
import { collect, str } from "../validate.js";
import {
  capabilitiesFor,
  mergeRedactedBack,
  normalizeConfig,
  PAGE_TYPE_MAP,
  redactAccess,
  redactSensitive,
  summarize,
  validateConfig,
  validDepartmentId,
} from "../lib/departmentConfig.js";

const router = Router();

/* ------------------------------------------------------------------ *
 * Loading
 * ------------------------------------------------------------------ */

/** MariaDB hands JSON columns back as strings on some driver versions. */
function parseConfig(value) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** The stored config for a department, or its seed, or null. */
async function loadConfig(id) {
  try {
    const rows = await query(
      "SELECT config FROM department_configs WHERE id = ? LIMIT 1",
      [id],
    );
    const stored = rows.length ? parseConfig(rows[0].config) : null;
    if (stored) return normalizeConfig(stored, id);
  } catch {
    // No database — the seed below stands.
  }
  return DEPARTMENT_CONFIGS[id] ? normalizeConfig(DEPARTMENT_CONFIGS[id], id) : null;
}

/** Every department the site knows about, stored ones overriding seeds. */
async function loadAll() {
  const configs = new Map(
    Object.entries(DEPARTMENT_CONFIGS).map(([id, config]) => [id, normalizeConfig(config, id)]),
  );
  try {
    const rows = await query("SELECT id, config FROM department_configs");
    rows.forEach((row) => {
      const parsed = parseConfig(row.config);
      if (parsed) configs.set(row.id, normalizeConfig(parsed, row.id));
    });
  } catch {
    // No database — the seeds stand on their own.
  }
  return [...configs.values()];
}

/**
 * Resolve the caller once and hang everything a department route needs off the
 * request: the config, the caller's community-wide permissions and the
 * capabilities those plus the config's own access table give them here.
 */
async function withDepartment(req, res, next) {
  const id = resolveDepartmentId(req);
  if (!id || !validDepartmentId(id)) {
    return res.status(400).json({ ok: false, message: "Invalid department id." });
  }

  const config = await loadConfig(id);
  if (!config) {
    return res.status(404).json({ ok: false, message: `No department "${id}".` });
  }

  const user = req.user ?? (await resolveUser(req));
  req.user = user;
  const grants = await loadGrants();
  const permissions = permissionsFor(user?.roles ?? [], grants);

  req.departmentId = id;
  req.deptConfig = config;
  req.deptPermissions = permissions;
  req.deptCapabilities = capabilitiesFor(config, user?.roles ?? [], permissions);
  next();
}

/** Gate a department route on one capability from src/lib/departmentConfig.js. */
function requireCapability(capability) {
  return (req, res, next) => {
    if (req.deptCapabilities?.has(capability)) return next();
    return res.status(403).json({
      ok: false,
      code: "AUTH_ROLE_MISSING",
      message:
        "Your Discord roles don't give you that in this department. Its command staff grant it on the Access page.",
    });
  };
}

/* ------------------------------------------------------------------ *
 * Audit and versions
 * ------------------------------------------------------------------ */

async function recordVersion(id, config, actor, label) {
  await query(
    "INSERT INTO department_config_versions (department_id, config, label, actor) VALUES (?, ?, ?, ?)",
    [id, JSON.stringify(config), label ?? null, actor ?? null],
  );
  // Keep the history bounded: a Builder session auto-saves often, and an
  // unbounded table would grow faster than anyone would ever read it.
  await query(
    `DELETE FROM department_config_versions
      WHERE department_id = ?
        AND id NOT IN (
          SELECT id FROM (
            SELECT id FROM department_config_versions
             WHERE department_id = ? ORDER BY id DESC LIMIT 50
          ) AS keep
        )`,
    [id, id],
  );
}

async function audit(id, req, action, summary) {
  try {
    await query(
      `INSERT INTO department_audit_log (department_id, actor, actor_name, action, summary)
       VALUES (?, ?, ?, ?, ?)`,
      [id, req.user?.id ?? null, req.user?.displayName ?? null, action, summary.slice(0, 480)],
    );
  } catch {
    // The write itself already reported whether it persisted.
  }
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

/** The department directory. Anyone who may open a hub may see the list. */
router.get("/", requirePermission("departments.view"), async (_req, res) => {
  const configs = await loadAll();
  res.json(configs.map(summarize));
});

/**
 * One department's config, shaped to the caller.
 *
 * Webhook URLs are write credentials for a Discord channel, so they only ever
 * reach someone who could set them; the access table is a map of who holds which
 * power here, so it only reaches someone who can already read it on the Access
 * page. `capabilities` rides along so the client renders the same controls the
 * API would accept rather than guessing and 403ing on submit.
 */
router.get(
  "/:deptId/config",
  requirePermission("departments.view"),
  withDepartment,
  (req, res) => {
    const caps = req.deptCapabilities;
    let config = req.deptConfig;
    if (!caps.has("manage")) config = redactSensitive(config);
    if (!caps.has("manageAccess") && !caps.has("viewAudit")) config = redactAccess(config);
    res.json({ config, capabilities: [...caps] });
  },
);

/**
 * The department's roster, projected through its config. The membership itself
 * is the community roster the Discord bot maintains — see server/src/lib/deptRoster.js.
 */
router.get(
  "/:deptId/roster",
  requirePermission("departments.view"),
  withDepartment,
  async (req, res) => {
    let roster = rosterSeed;
    let roleMap = ROLE_MAP;
    try {
      const rows = await query(
        "SELECT * FROM roster_members WHERE department = ? ORDER BY sort_order, callsign",
        [req.departmentId],
      );
      if (rows.length) {
        roster = rows.map((row) => ({
          id: String(row.id),
          discordId: row.discord_id,
          characterName: row.character_name,
          displayName: row.display_name,
          department: row.department,
          rank: row.rank_label,
          rankFull: row.rank_full,
          callsign: row.callsign,
          status: row.status,
          loaUntil:
            row.loa_until instanceof Date
              ? row.loa_until.toISOString().slice(0, 10)
              : row.loa_until,
          joinedAt:
            row.joined_at instanceof Date
              ? row.joined_at.toISOString().slice(0, 10)
              : row.joined_at,
        }));
      }
      const roleRows = await query("SELECT * FROM roster_role_map WHERE department = ?", [
        req.departmentId,
      ]);
      if (roleRows.length) {
        roleMap = roleRows.map((row) => ({
          roleId: row.role_id,
          key: row.role_key,
          department: row.department,
          rank: row.rank_label,
          rankFull: row.rank_full,
          order: row.sort_order,
        }));
      }
    } catch {
      // No database — the seeds already loaded above.
    }
    res.json({ subdivisions: projectRoster(req.deptConfig, roster, roleMap) });
  },
);

router.get(
  "/:deptId/versions",
  requirePermission("departments.view"),
  withDepartment,
  requireCapability("viewAudit"),
  async (req, res) => {
    try {
      const rows = await query(
        `SELECT id, label, actor, created_at FROM department_config_versions
          WHERE department_id = ? ORDER BY id DESC LIMIT 50`,
        [req.departmentId],
      );
      res.json(
        rows.map((row) => ({
          id: row.id,
          label: row.label,
          actor: row.actor,
          at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        })),
      );
    } catch {
      res.json([]);
    }
  },
);

router.get(
  "/:deptId/audit",
  requirePermission("departments.view"),
  withDepartment,
  requireCapability("viewAudit"),
  async (req, res) => {
    try {
      const rows = await query(
        `SELECT id, actor, actor_name, action, summary, at FROM department_audit_log
          WHERE department_id = ? ORDER BY id DESC LIMIT 200`,
        [req.departmentId],
      );
      res.json(
        rows.map((row) => ({
          id: row.id,
          actor: row.actor,
          actorName: row.actor_name,
          action: row.action,
          summary: row.summary,
          at: row.at instanceof Date ? row.at.toISOString() : row.at,
        })),
      );
    } catch {
      res.json([]);
    }
  },
);

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

const NOT_PERSISTED =
  "Accepted, but not persisted — no database is configured, so this will reset on reload.";

/** Persist a config, versioning the copy it replaces first. */
async function saveConfig(req, res, config, action, summary) {
  const errors = validateConfig(config);
  if (errors.length > 0) return res.status(400).json({ ok: false, errors });

  try {
    await recordVersion(req.departmentId, req.deptConfig, req.user?.id, action);
    await query(
      `INSERT INTO department_configs (id, config, updated_by)
            VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE config = VALUES(config), updated_by = VALUES(updated_by)`,
      [req.departmentId, JSON.stringify(config), req.user?.id ?? null],
    );
  } catch {
    return res.json({ ok: true, config, message: NOT_PERSISTED });
  }
  await audit(req.departmentId, req, action, summary);
  return res.json({ ok: true, config });
}

/** The Builder Portal's save: the whole document, for a site manager only. */
router.put(
  "/:deptId/config",
  requirePermission("departments.view"),
  withDepartment,
  requireCapability("manage"),
  async (req, res) => {
    const incoming = normalizeConfig(req.body?.config, req.departmentId);
    // The id is the route, never the payload: letting a save rename its own
    // department would let it overwrite a different one.
    incoming.id = req.departmentId;
    const merged = mergeRedactedBack(incoming, req.deptConfig);
    await saveConfig(req, res, merged, "config.save", "Saved the site configuration.");
  },
);

/**
 * A single page's own data — the roster editor, the fleet table, the calendar,
 * the admin log. Deliberately narrow: it can only replace `pages[i].config` for
 * the page named in the URL, so an editor is never a route to the access table.
 */
router.put(
  "/:deptId/pages/:pageId",
  requirePermission("departments.view"),
  withDepartment,
  async (req, res) => {
    const page = req.deptConfig.pages.find((p) => p.id === req.params.pageId);
    if (!page) return res.status(404).json({ ok: false, message: "No such page." });

    const needed = PAGE_TYPE_MAP[page.type]?.edit;
    if (!needed || !req.deptCapabilities.has(needed)) {
      return res.status(403).json({
        ok: false,
        code: "AUTH_ROLE_MISSING",
        message: "Your Discord roles don't let you edit this page in this department.",
      });
    }
    if (!req.body?.config || typeof req.body.config !== "object") {
      return res.status(400).json({ ok: false, errors: ["A page config object is required."] });
    }

    const next_ = {
      ...req.deptConfig,
      pages: req.deptConfig.pages.map((p) =>
        p.id === page.id ? { ...p, config: req.body.config } : p,
      ),
    };
    await saveConfig(req, res, next_, "page.save", `Edited the "${page.label}" page.`);
  },
);

/** The access table, split out so managing access never rewrites anything else. */
router.put(
  "/:deptId/access",
  requirePermission("departments.view"),
  withDepartment,
  requireCapability("manageAccess"),
  async (req, res) => {
    const incoming = Array.isArray(req.body?.access) ? req.body.access : null;
    if (!incoming) {
      return res.status(400).json({ ok: false, errors: ["An access array is required."] });
    }
    const merged = normalizeConfig({ ...req.deptConfig, access: incoming }, req.departmentId);
    // validateConfig refuses a table nobody can manage; check it here too so the
    // message names the real problem rather than a generic validation failure.
    if (!merged.access.some((grant) => grant.manage)) {
      return res.status(400).json({
        ok: false,
        errors: [
          "At least one Discord role must be able to manage this site, or nobody could undo this.",
        ],
      });
    }
    await saveConfig(req, res, merged, "access.save", "Changed who may manage this site.");
  },
);

router.post(
  "/:deptId/versions/:versionId/restore",
  requirePermission("departments.view"),
  withDepartment,
  requireCapability("manage"),
  async (req, res) => {
    let restored = null;
    try {
      const rows = await query(
        "SELECT config FROM department_config_versions WHERE id = ? AND department_id = ? LIMIT 1",
        [Number(req.params.versionId), req.departmentId],
      );
      restored = rows.length ? parseConfig(rows[0].config) : null;
    } catch {
      return res.status(503).json({ ok: false, message: "Version history needs a database." });
    }
    if (!restored) return res.status(404).json({ ok: false, message: "No such version." });

    await saveConfig(
      req,
      res,
      normalizeConfig(restored, req.departmentId),
      "config.restore",
      `Restored version ${req.params.versionId}.`,
    );
  },
);

/**
 * Create a department. Community-wide `departments.manage` only — a department's
 * own command staff manage their site, not the list of sites.
 */
router.post("/", requirePermission("departments.manage"), async (req, res) => {
  const id = str(req.body?.id).toLowerCase();
  const config = normalizeConfig(req.body?.config, id);
  config.id = id;

  const errors = collect([
    [validDepartmentId(id), "Department id must be lowercase letters, digits and dashes."],
    [!DEPARTMENT_CONFIGS[id], `"${id}" already exists.`],
  ]).concat(validateConfig(config));
  if (errors.length > 0) return res.status(400).json({ ok: false, errors });

  try {
    const rows = await query("SELECT id FROM department_configs WHERE id = ? LIMIT 1", [id]);
    if (rows.length) return res.status(400).json({ ok: false, errors: [`"${id}" already exists.`] });
    await query("INSERT INTO department_configs (id, config, updated_by) VALUES (?, ?, ?)", [
      id,
      JSON.stringify(config),
      req.user?.id ?? null,
    ]);
  } catch {
    return res.status(201).json({ ok: true, config, message: NOT_PERSISTED });
  }
  await audit(id, req, "config.create", `Created the ${config.branding.name} site.`);
  res.status(201).json({ ok: true, config });
});

export default router;
