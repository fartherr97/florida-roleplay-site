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
import { randomUUID } from "node:crypto";
import { query } from "../db.js";
import { DEPARTMENT_CONFIGS } from "../departmentSeed.js";
import { roster as rosterSeed, ROLE_MAP } from "../rosterSeed.js";
import { requirePermission, loadGrants } from "../middleware/requirePermission.js";
import { resolveUser } from "../middleware/requireRole.js";
import { permissionsFor } from "../permissions.js";
import { projectRoster } from "../lib/deptRoster.js";
import { maybeSyncRoster, parseNick } from "../lib/rosterSync.js";
import { fireAdminLogWebhook } from "../lib/deptWebhook.js";
import { fileAdminLogDiscipline } from "../lib/deptDiscipline.js";
import { resolveDepartmentId } from "../lib/tenant.js";
import { collect, str } from "../validate.js";
import {
  capabilitiesFor,
  mergeRedactedBack,
  normalizeConfig,
  PAGE_TYPE_MAP,
  recruitmentOf,
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

/** JSONB comes back parsed; a TEXT column holding JSON does not. */
function parseConfig(value) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** The stored config for a department, or its seed, or null. */
/**
 * The Discord guild a department's seed ships with. Used to backfill configs
 * that were stored before the field existed: without it a department saved from
 * the Builder loses the guild the roster importer and split screen read, and its
 * server never shows up in the role-map guild selector.
 */
function seedGuildId(id) {
  const seed = DEPARTMENT_CONFIGS[id];
  return seed && /^\d{17,20}$/.test(String(seed.guildId ?? "")) ? String(seed.guildId) : "";
}

/** A stored config, normalised, with its guild backfilled from the seed when blank. */
function fromStored(parsed, id) {
  const config = normalizeConfig(parsed, id);
  if (!config.guildId) config.guildId = seedGuildId(id);
  return config;
}

async function loadConfig(id) {
  try {
    const rows = await query("SELECT config FROM department_configs WHERE id = $1 LIMIT 1",
      [id],
    );
    const stored = rows.length ? parseConfig(rows[0].config) : null;
    if (stored) return fromStored(stored, id);
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
      if (parsed) configs.set(row.id, fromStored(parsed, row.id));
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
  await query("INSERT INTO department_config_versions (department_id, config, label, actor) VALUES ($1, $2, $3, $4)",
    [id, JSON.stringify(config), label ?? null, actor ?? null],
  );
  // Keep the history bounded: a Builder session auto-saves often, and an
  // unbounded table would grow faster than anyone would ever read it.
  await query(`DELETE FROM department_config_versions
      WHERE department_id = $1
        AND id NOT IN (
          SELECT id FROM (
            SELECT id FROM department_config_versions
             WHERE department_id = $2 ORDER BY id DESC LIMIT 50
          ) AS keep
        )`,
    [id, id],
  );
}

async function audit(id, req, action, summary) {
  try {
    await query(`INSERT INTO department_audit_log (department_id, actor, actor_name, action, summary)
       VALUES ($1, $2, $3, $4, $5)`,
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
/**
 * The community roster and role map, scoped to one department, falling back to
 * the seeds when there is no database. Shared by the authenticated roster route
 * and the public recruitment endpoint.
 */
/** One roster_members row, shaped for the projection. */
function mapMemberRow(row) {
  return {
    id: String(row.id),
    discordId: row.discord_id,
    characterName: row.character_name,
    displayName: row.display_name,
    department: row.department,
    rank: row.rank_label,
    rankFull: row.rank_full,
    callsign: row.callsign,
    status: row.status,
    // 'manual' rows are the backup roster entries an admin adds by hand; the UI
    // offers edit/remove only for those, never for Discord-synced members.
    source: row.source,
    loaUntil:
      row.loa_until instanceof Date ? row.loa_until.toISOString().slice(0, 10) : row.loa_until,
    joinedAt:
      row.joined_at instanceof Date ? row.joined_at.toISOString().slice(0, 10) : row.joined_at,
  };
}

/**
 * A department's roster and rank map.
 *
 * A member belongs on this roster if they hold *any* role mapped to this
 * department — shown under their highest rank here — even when their overall
 * highest rank (which sets their primary department on the community roster)
 * sits in another department. So a trooper who is also a server admin appears on
 * the FHP roster under Trooper and on the staff roster under Admin, from the one
 * set of Discord roles the sync records for them.
 *
 * Rows synced before the roles were recorded fall back to their stored primary
 * department, so nobody vanishes between a schema upgrade and the next sync.
 */
async function loadRosterAndMap(deptId, deptGuildId = "") {
  let roster = rosterSeed.filter((entry) => entry.department === deptId);
  let roleMap = ROLE_MAP.filter((role) => role.department === deptId);
  try {
    const mapRows = await query("SELECT * FROM roster_role_map WHERE kind = 'rank'");
    const fullMap = mapRows.length
      ? mapRows.map((row) => ({
          roleId: row.role_id,
          key: row.role_key,
          department: row.department,
          rank: row.rank_label,
          rankFull: row.rank_full,
          order: row.sort_order,
          color: row.color || "",
        }))
      : ROLE_MAP;
    roleMap = fullMap.filter((role) => role.department === deptId);

    // Auto-assigned callsigns for this department, used when a member does not
    // carry one in their nickname.
    let assigned = new Map();
    try {
      const csRows = await query(
        "SELECT discord_id, callsign FROM dept_callsigns WHERE department = $1",
        [deptId],
      );
      assigned = new Map(csRows.map((r) => [r.discord_id, String(r.callsign)]));
    } catch {
      // No table yet — nickname callsigns still apply.
    }

    const memberRows = await query("SELECT * FROM roster_members");
    if (memberRows.length) {
      const byRoleId = new Map(fullMap.map((role) => [String(role.roleId), role]));
      const built = [];
      for (const row of memberRows) {
        const base = mapMemberRow(row);
        // The character name and callsign the member shows here come from their
        // nickname in *this department's* Discord server, so the roster reads in
        // character rather than by global Discord username.
        const nick = deptGuildId && row.nicks ? row.nicks[deptGuildId] : "";
        if (nick) {
          const { callsign, name } = parseNick(nick);
          if (name) base.characterName = name;
          if (callsign) base.callsign = callsign;
          base.displayName = nick;
        }
        // Fall back to the number the hub assigned this member in this department.
        if (!base.callsign && assigned.has(row.discord_id)) {
          base.callsign = assigned.get(row.discord_id);
        }
        const held = Array.isArray(row.role_ids) ? row.role_ids.map(String) : null;
        const deptRoles = (held ?? [])
          .map((rid) => byRoleId.get(rid))
          .filter((role) => role && role.department === deptId);
        if (deptRoles.length) {
          const top = deptRoles.sort((a, b) => (b.order ?? 0) - (a.order ?? 0))[0];
          built.push({ ...base, department: deptId, rank: top.rank, rankFull: top.rankFull, rankColor: top.color || "" });
        } else if (held === null && base.department === deptId) {
          // Legacy row with no recorded roles yet — keep it under its stored rank.
          built.push(base);
        }
      }
      roster = built;
    }
  } catch {
    // No database — the seed slices above stand.
  }
  return { roster, roleMap };
}

router.get(
  "/:deptId/roster",
  requirePermission("departments.view"),
  withDepartment,
  async (req, res) => {
    // Opening a department roster nudges a throttled Discord refresh, so it
    // populates on its own once the department's roles are mapped.
    maybeSyncRoster();
    const { roster, roleMap } = await loadRosterAndMap(req.departmentId, req.deptConfig.guildId);
    res.json({ subdivisions: projectRoster(req.deptConfig, roster, roleMap) });
  },
);

/**
 * Manual roster entries — a hand-maintained backup for anyone the Discord sync
 * cannot cover (no account yet, a role not mapped, the bot briefly offline).
 *
 * Rows are stored with source 'manual', which the Discord sync never prunes, so
 * they sit on the roster beside synced members and survive every reconcile. Only
 * manual rows are editable here; a synced member is owned by Discord. Gated on
 * the department's editRoster capability.
 */
router.post(
  "/:deptId/roster/manual",
  requirePermission("departments.view"),
  withDepartment,
  requireCapability("editRoster"),
  async (req, res) => {
    const b = req.body ?? {};
    const characterName = str(b.characterName).slice(0, 128);
    const rank = str(b.rank).slice(0, 64);
    if (!characterName) return res.status(400).json({ ok: false, message: "A name is required." });
    if (!rank) return res.status(400).json({ ok: false, message: "A rank is required." });
    const callsign = str(b.callsign).slice(0, 32) || null;
    const status = str(b.status).slice(0, 32) || "Active";
    const discordId = /^\d{17,20}$/.test(str(b.discordId)) ? str(b.discordId) : "";
    const id = str(b.id);

    try {
      if (id) {
        // Edit an existing manual row. The source guard makes a synced member
        // impossible to overwrite through this route even with its id.
        const rows = await query(
          `UPDATE roster_members
             SET character_name = $2, display_name = $2, rank_label = $3, callsign = $4, status = $5
           WHERE id = $1 AND department = $6 AND source = 'manual'
           RETURNING id`,
          [id, characterName, rank, callsign, status, req.departmentId],
        );
        if (!rows.length) {
          return res.status(404).json({ ok: false, message: "No such manual member." });
        }
        return res.json({ ok: true, id });
      }

      const newId = `man-${randomUUID()}`;
      // A real Discord id keys the row (so a later sync can take it over); without
      // one, a non-numeric placeholder keeps the NOT NULL/unique column happy and
      // never collides with a real snowflake.
      const did = discordId || `mnl${randomUUID().replace(/-/g, "").slice(0, 17)}`;
      await query(
        `INSERT INTO roster_members
           (id, discord_id, character_name, display_name, department, rank_label, callsign, status, joined_at, synced_at, source)
         VALUES ($1, $2, $3, $3, $4, $5, $6, $7, CURRENT_DATE, CURRENT_TIMESTAMP, 'manual')
         ON CONFLICT (discord_id) DO UPDATE SET
           character_name = EXCLUDED.character_name,
           display_name   = EXCLUDED.display_name,
           department     = EXCLUDED.department,
           rank_label     = EXCLUDED.rank_label,
           callsign       = EXCLUDED.callsign,
           status         = EXCLUDED.status,
           source         = 'manual'`,
        [newId, did, characterName, req.departmentId, rank, callsign, status],
      );
      return res.json({ ok: true, id: newId });
    } catch {
      return res.status(500).json({ ok: false, message: "Could not save the manual member." });
    }
  },
);

router.delete(
  "/:deptId/roster/manual/:id",
  requirePermission("departments.view"),
  withDepartment,
  requireCapability("editRoster"),
  async (req, res) => {
    try {
      await query(
        "DELETE FROM roster_members WHERE id = $1 AND department = $2 AND source = 'manual'",
        [req.params.id, req.departmentId],
      );
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, message: "Could not remove the member." });
    }
  },
);

/**
 * Calendar attendance. Any member who can see the department may RSVP, so it
 * lives in its own table rather than the config: a click needs no edit rights
 * and never spawns a config version.
 */
router.get(
  "/:deptId/events/attendance",
  requirePermission("departments.view"),
  withDepartment,
  async (req, res) => {
    try {
      const rows = await query(
        `SELECT event_id, discord_id, name, created_at
           FROM event_attendance WHERE dept_id = $1 ORDER BY created_at`,
        [req.departmentId],
      );
      const attendance = {};
      for (const row of rows) {
        (attendance[row.event_id] ??= []).push({
          discordId: row.discord_id,
          name: row.name,
          at: row.created_at,
        });
      }
      return res.json({ attendance });
    } catch {
      return res.json({ attendance: {} });
    }
  },
);

router.post(
  "/:deptId/events/:eventId/attend",
  requirePermission("departments.view"),
  withDepartment,
  async (req, res) => {
    const user = req.user;
    if (!user?.id) return res.status(403).json({ ok: false, message: "Sign in to attend." });

    const eventId = str(req.params.eventId);
    const exists = req.deptConfig.pages.some(
      (p) => p.type === "calendar" && (p.config?.events ?? []).some((e) => e.id === eventId),
    );
    if (!eventId || !exists) return res.status(404).json({ ok: false, message: "No such event." });

    const attend = req.body?.attend !== false; // default to attending
    const name = user.displayName ?? user.username ?? "Member";
    try {
      if (attend) {
        await query(
          `INSERT INTO event_attendance (dept_id, event_id, discord_id, name)
             VALUES ($1, $2, $3, $4)
           ON CONFLICT (dept_id, event_id, discord_id) DO UPDATE SET name = EXCLUDED.name`,
          [req.departmentId, eventId, user.id, name],
        );
      } else {
        await query(
          "DELETE FROM event_attendance WHERE dept_id = $1 AND event_id = $2 AND discord_id = $3",
          [req.departmentId, eventId, user.id],
        );
      }
      const rows = await query(
        `SELECT discord_id, name, created_at FROM event_attendance
           WHERE dept_id = $1 AND event_id = $2 ORDER BY created_at`,
        [req.departmentId, eventId],
      );
      return res.json({
        ok: true,
        attending: attend,
        attendees: rows.map((r) => ({ discordId: r.discord_id, name: r.name, at: r.created_at })),
      });
    } catch {
      return res.status(503).json({ ok: false, message: "Attendance needs a database to record." });
    }
  },
);

/**
 * The recruitment-facing summary for one department: its status pill, the rank
 * ladder from the role map, a few featured fleet vehicles, and a live member
 * count. Deliberately public — this is the page a prospective applicant sees —
 * and derived entirely from the department's own config, so a department head
 * controls all of it from the Builder without touching a separate record.
 */
router.get("/:deptId/public", async (req, res) => {
  const id = req.params.deptId;
  if (!validDepartmentId(id)) {
    return res.status(400).json({ ok: false, message: "Invalid department id." });
  }
  const config = await loadConfig(id);
  if (!config) return res.status(404).json({ ok: false, message: `No department "${id}".` });

  const { roster, roleMap } = await loadRosterAndMap(id, config.guildId);

  // The rank ladder is every rank mapped to this department, highest first.
  const ranks = roleMap
    .filter((role) => role.department === id)
    .sort((a, b) => (b.order ?? 0) - (a.order ?? 0))
    .map((role) => ({ rank: role.rank, rankFull: role.rankFull }));

  // Featured fleet: the vehicles the department chose, else the first few.
  const fleetPage = config.pages.find((page) => page.type === "fleet");
  const vehicles = Array.isArray(fleetPage?.config?.vehicles) ? fleetPage.config.vehicles : [];
  const featuredIds = config.recruitment?.featuredVehicles ?? [];
  const chosen = featuredIds.length
    ? featuredIds.map((vid) => vehicles.find((v) => v.id === vid)).filter(Boolean)
    : vehicles.slice(0, 4);
  const fleet = chosen.map((v) => ({ name: v.vehicle || "Unit", imageUrl: v.imageUrl || "" }));

  // A live headcount from the projected main roster.
  const subs = projectRoster(config, roster, roleMap);
  const main = subs.find((s) => s.main) ?? subs[0];
  const memberCount = main
    ? new Set(main.categories.flatMap((c) => c.members.map((m) => m.id))).size
    : 0;

  res.json({
    id: config.id,
    name: config.branding.name,
    shortName: config.branding.shortName,
    tagline: config.branding.tagline,
    description: config.branding.description,
    accent: config.branding.accent,
    logoUrl: config.branding.logoUrl,
    recruitment: recruitmentOf(config),
    ranks,
    fleet,
    fleetCount: vehicles.length,
    memberCount,
  });
});

router.get(
  "/:deptId/versions",
  requirePermission("departments.view"),
  withDepartment,
  requireCapability("viewAudit"),
  async (req, res) => {
    try {
      const rows = await query(`SELECT id, label, actor, created_at FROM department_config_versions
          WHERE department_id = $1 ORDER BY id DESC LIMIT 50`,
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
      const rows = await query(`SELECT id, actor, actor_name, action, summary, at FROM department_audit_log
          WHERE department_id = $1 ORDER BY id DESC LIMIT 200`,
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

/**
 * Persist a config, versioning the copy it replaces first. `onCommitted` runs
 * only after the write actually lands (never on the no-database path), for side
 * effects that must not happen on a rejected or unpersisted save — firing the
 * admin-log webhook, say. It is fire-and-forget: its failure never fails the
 * save that already succeeded.
 */
async function saveConfig(req, res, config, action, summary, onCommitted) {
  const errors = validateConfig(config);
  if (errors.length > 0) return res.status(400).json({ ok: false, errors });

  try {
    await recordVersion(req.departmentId, req.deptConfig, req.user?.id, action);
    await query(`INSERT INTO department_configs (id, config, updated_by)
            VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config, updated_by = EXCLUDED.updated_by`,
      [req.departmentId, JSON.stringify(config), req.user?.id ?? null],
    );
  } catch {
    return res.json({ ok: true, config, message: NOT_PERSISTED });
  }
  await audit(req.departmentId, req, action, summary);
  if (onCommitted) Promise.resolve().then(onCommitted).catch(() => {});
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

    // The Emergency-Services admin log has two side effects, both keyed off the
    // newly-added entries (diffed against the stored page, so re-saving never
    // repeats them) and both fired only after the entry actually persists: it
    // posts each entry to Discord, and it files the disciplinary ones into the
    // background-check store under this department.
    const onCommitted =
      page.type === "adminlog"
        ? () => {
            const before = page.config?.entries;
            const after = req.body.config?.entries;
            fireAdminLogWebhook(req.deptConfig, before, after);
            fileAdminLogDiscipline(req.departmentId, before, after, req.user);
          }
        : undefined;

    await saveConfig(req, res, next_, "page.save", `Edited the "${page.label}" page.`, onCommitted);
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
      const rows = await query("SELECT config FROM department_config_versions WHERE id = $1 AND department_id = $2 LIMIT 1",
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
    const rows = await query("SELECT id FROM department_configs WHERE id = $1 LIMIT 1", [id]);
    if (rows.length) return res.status(400).json({ ok: false, errors: [`"${id}" already exists.`] });
    await query("INSERT INTO department_configs (id, config, updated_by) VALUES ($1, $2, $3)", [
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
