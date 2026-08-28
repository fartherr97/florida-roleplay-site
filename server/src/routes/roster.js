/**
 * The /api/roster router — the community roster and the Discord bot's sync API.
 *
 * Reads are open to any signed-in member: the roster is the community's own
 * directory. Writes are for the bot only, authenticated with BOT_TOKEN rather
 * than Discord roles, because the bot is not a Discord user.
 *
 * The contract is deliberately one-way. The bot never decides what a rank means
 * or how a nickname is formatted — it reads the role map from this API, posts
 * the roles a member now holds, and applies whatever nickname comes back. That
 * keeps the site, the roster and Discord from ever disagreeing.
 */
import { Router } from "express";
import { execute, query, changedRows } from "../db.js";
import * as seed from "../rosterSeed.js";
import { requirePermission, loadGrants } from "../middleware/requirePermission.js";
import { grantsPermission } from "../permissions.js";
import { requireBot } from "../middleware/requireBot.js";
import { resolveMember, applyUpsert, maybeSyncRoster } from "../lib/rosterSync.js";
import { fetchGuildRoles } from "../lib/discord.js";
import { collect, isDiscordId, str } from "../validate.js";

const router = Router();

/** Discord snowflakes, as sent in a role list. */
const SNOWFLAKE = /^\d{17,20}$/;

function isoDate(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function isoStamp(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapRow(row) {
  return {
    id: row.id,
    discordId: row.discord_id,
    characterName: row.character_name,
    displayName: row.display_name,
    department: row.department,
    rank: row.rank_label,
    callsign: row.callsign,
    status: row.status,
    joinedAt: isoDate(row.joined_at),
    syncedAt: isoStamp(row.synced_at),
    source: row.source,
    loaUntil: isoDate(row.loa_until),
    loaReason: row.loa_reason,
  };
}

/** Loads the roster from the database, falling back to the seeded list. */
async function loadRoster() {
  try {
    const rows = await query("SELECT * FROM roster_members ORDER BY department, rank_label, character_name",
    );
    if (rows.length) return rows.map(mapRow);
  } catch {
    // fall through
  }
  return seed.roster;
}

/**
 * Loads the role map, falling back to the seeded one. Rank roles and the base
 * or tag roles live in one table with a `kind` column, so a single save keeps
 * them consistent.
 */
async function loadRoleMap({ withSpecial = false } = {}) {
  try {
    const rows = await query("SELECT * FROM roster_role_map ORDER BY sort_order DESC");
    if (rows.length) {
      const roles = rows
        .filter((row) => row.kind === "rank")
        .map((row) => ({
          roleId: row.role_id,
          key: row.role_key,
          department: row.department,
          rank: row.rank_label,
          rankFull: row.rank_full,
          order: row.sort_order,
          displayTemplate: row.display_template,
        }));
      if (!withSpecial) return roles;
      return {
        roles,
        special: rows
          .filter((row) => row.kind !== "rank")
          .map((row) => ({
            roleId: row.role_id,
            key: row.role_key,
            kind: row.kind,
            label: row.rank_label,
            detail: row.rank_full,
          })),
      };
    }
  } catch {
    // fall through
  }
  return withSpecial
    ? { roles: seed.ROLE_MAP, special: seed.SPECIAL_ROLES }
    : seed.ROLE_MAP;
}

/** The mapped LOA tag, falling back to the seeded one. */
async function loaRoleId() {
  const { special } = await loadRoleMap({ withSpecial: true });
  return special.find((role) => role.key === "loa")?.roleId ?? seed.LOA_ROLE.roleId;
}

/* -------------------------------------------------------------- reads */

router.get("/", requirePermission("roster.view"), async (_req, res) => {
  // Viewing the roster nudges a background refresh from Discord if one hasn't
  // run recently, so it fills in on its own shortly after roles are mapped.
  maybeSyncRoster();
  res.json(await loadRoster());
});

/**
 * The role map the bot consumes. Deliberately readable by the bot without a
 * member session — it is configuration, not member data — but writes still need
 * the bot token.
 */
router.get("/role-map", async (_req, res) => {
  const { roles, special } = await loadRoleMap({ withSpecial: true });
  res.json({
    divisions: seed.DIVISIONS,
    departments: seed.DEPARTMENTS,
    roles,
    special,
  });
});

/**
 * The guild's live Discord roles, read straight from Discord with the bot token, so access
 * can be assigned against the roles that actually exist. Read-only and configuration-grade,
 * gated the same as editing the role map. Returns `configured:false` (not an error) when no
 * bot token is set, so the page falls back to the seeded ladder cleanly.
 */
router.get("/guild-roles", requirePermission("discord.roles.manage"), async (req, res) => {
  try {
    // A department can run its own server; ?guildId reads that one instead of
    // the main guild, so its ranks can be imported from where they actually live.
    const guildId = str(req.query.guildId).trim();
    if (guildId && !SNOWFLAKE.test(guildId)) {
      return res.status(400).json({ configured: true, roles: [], error: "Invalid guild id." });
    }
    const roles = await fetchGuildRoles(guildId || undefined);
    if (roles === null) return res.json({ configured: false, roles: [] });
    return res.json({ configured: true, roles });
  } catch (err) {
    return res
      .status(502)
      .json({ configured: true, roles: [], error: err?.message ?? "Could not reach Discord." });
  }
});

/**
 * Replaces the whole Discord role mapping. Sending the complete set rather than
 * a diff means the saved state is exactly what was reviewed on the page.
 *
 * Two things are refused outright, because either would make rank resolution
 * arbitrary rather than merely wrong: a malformed snowflake, and the same
 * snowflake bound to two different roles.
 */
router.post("/role-map", requirePermission("discord.roles.manage"), async (req, res) => {
  const roles = Array.isArray(req.body?.roles) ? req.body.roles : null;
  const special = Array.isArray(req.body?.special) ? req.body.special : [];

  if (!roles) {
    return res.status(400).json({ ok: false, errors: ["roles must be an array."] });
  }

  const errors = [];
  const seenIds = new Map();
  const seenKeys = new Set();

  const check = (entry, label) => {
    const roleId = str(entry.roleId);
    const key = str(entry.key);

    if (!/^[a-z0-9_]{2,64}$/.test(key)) {
      errors.push(`${label}: key must be lowercase letters, numbers and underscores.`);
      return false;
    }
    if (seenKeys.has(key)) {
      errors.push(`${label}: duplicate key "${key}".`);
      return false;
    }
    seenKeys.add(key);

    if (!SNOWFLAKE.test(roleId)) {
      errors.push(`${key}: "${roleId}" is not a 17–20 digit Discord role ID.`);
      return false;
    }
    if (seenIds.has(roleId)) {
      errors.push(
        `${key}: Discord role ${roleId} is already bound to "${seenIds.get(roleId)}" — which rank a member resolves to would be arbitrary.`,
      );
      return false;
    }
    seenIds.set(roleId, key);
    return true;
  };

  const cleanRoles = [];
  roles.forEach((entry, index) => {
    if (!check(entry ?? {}, `roles[${index}]`)) return;
    const order = Number(entry.order);
    if (!Number.isFinite(order) || order < 0 || order > 100000) {
      errors.push(`${str(entry.key)}: order must be a number between 0 and 100000.`);
      return;
    }
    if (!str(entry.rank)) {
      errors.push(`${str(entry.key)}: a short rank is required — it appears in nicknames.`);
      return;
    }
    cleanRoles.push({
      roleId: str(entry.roleId),
      key: str(entry.key),
      department: str(entry.department),
      rank: str(entry.rank),
      rankFull: str(entry.rankFull) || str(entry.rank),
      order,
      displayTemplate: str(entry.displayTemplate) || "{callsign} | {rank} | {surname}",
    });
  });

  const cleanSpecial = [];
  special.forEach((entry, index) => {
    if (!check(entry ?? {}, `special[${index}]`)) return;
    cleanSpecial.push({
      roleId: str(entry.roleId),
      key: str(entry.key),
      kind: str(entry.kind) || "base",
      label: str(entry.label) || str(entry.key),
      detail: str(entry.detail),
    });
  });

  if (errors.length) return res.status(400).json({ ok: false, errors });

  try {
    await query("DELETE FROM roster_role_map");
    for (const role of cleanRoles) {
      await query(`INSERT INTO roster_role_map
           (role_id, role_key, kind, department, rank_label, rank_full, sort_order, display_template)
         VALUES ($1, $2, 'rank', $3, $4, $5, $6, $7)`,
        [role.roleId, role.key, role.department, role.rank, role.rankFull, role.order, role.displayTemplate],
      );
    }
    for (const role of cleanSpecial) {
      await query(`INSERT INTO roster_role_map
           (role_id, role_key, kind, rank_label, rank_full, sort_order, display_template)
         VALUES ($1, $2, $3, $4, $5, 0, '')`,
        [role.roleId, role.key, role.kind, role.label, role.detail],
      );
    }
    return res.json({ ok: true, roles: cleanRoles, special: cleanSpecial });
  } catch {
    return res.json({
      ok: true,
      roles: cleanRoles,
      special: cleanSpecial,
      message:
        "Accepted, but not persisted — no database is configured, so this will reset on reload.",
    });
  }
});

router.get("/sync-log", requirePermission("roster.view"), (_req, res) =>
  (async () => {
    try {
      const rows = await query("SELECT * FROM roster_sync_log ORDER BY created_at DESC LIMIT 100",
      );
      if (rows.length) {
        return res.json(
          rows.map((row) => ({
            id: `sl-${row.id}`,
            discordId: row.discord_id,
            characterName: row.character_name,
            action: row.action,
            detail: row.detail,
            actor: row.actor,
            at: isoStamp(row.created_at),
          })),
        );
      }
    } catch {
      // fall through
    }
    return res.json(seed.syncLog);
  })(),
);

/* ----------------------------------------------------- status and LOA */

const STATUS_IDS = seed.ACTIVITY_STATUSES.map((s) => s.id);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today in YYYY-MM-DD, compared as strings since both are ISO dates. */
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function validateStatus(body) {
  const status = str(body.status);
  const loaUntil = body.loaUntil == null ? "" : str(body.loaUntil);
  const needsDate = seed.ACTIVITY_STATUSES.find((s) => s.id === status)?.requiresDate;

  return {
    errors: collect([
      [STATUS_IDS.includes(status), `status must be one of: ${STATUS_IDS.join(", ")}.`],
      [!needsDate || ISO_DATE.test(loaUntil), "loaUntil must be a YYYY-MM-DD date."],
      [
        !needsDate || !ISO_DATE.test(loaUntil) || loaUntil >= todayIso(),
        "loaUntil cannot be in the past.",
      ],
      [str(body.loaReason).length <= 500, "loaReason must be under 500 characters."],
    ]),
    value: {
      status,
      loaUntil: needsDate ? loaUntil : null,
      loaReason: needsDate ? str(body.loaReason) : "",
    },
  };
}

/**
 * Writes the status and reports what actually happened.
 *
 * Three outcomes, not two. "no-record" is the one that is easy to miss: the
 * roster falls back to seed data when `roster_members` is empty, so a member
 * plainly visible on the page may have no row to update until the bot has
 * synced them. Postgres reports that as a successful UPDATE affecting zero rows,
 * and calling it saved would show the new status until the next reload and then
 * quietly revert it.
 */
async function writeStatus(id, value) {
  try {
    const result = await execute(`UPDATE roster_members
          SET status = $1, loa_until = $2, loa_reason = $3, synced_at = CURRENT_TIMESTAMP
        WHERE id = $4 OR discord_id = $5`,
      [value.status, value.loaUntil, value.loaReason, id, id],
    );
    return changedRows(result) ? "saved" : "no-record";
  } catch {
    return "no-database";
  }
}

const STATUS_WRITE_MESSAGES = {
  "no-record":
    "Not saved: this member has no roster record yet, so there was nothing to update. " +
    "They get one the first time the Discord bot syncs them.",
  "no-database":
    "Not saved: the database is unreachable, so this will revert on reload.",
};

/**
 * PATCH-by-POST of one member's activity status. LOA carries a return date,
 * which is the only thing the bot's expiry sweep reads — Discord schedules
 * nothing, so a bot restart cannot lose a pending return.
 */
router.post("/:id/status", requirePermission("roster.edit_status"), async (req, res) => {
  const { errors, value } = validateStatus(req.body ?? {});
  if (errors.length) return res.status(400).json({ ok: false, errors });

  // Placing someone on leave is a separate permission from ordinary status
  // changes, so a Mod can mark someone inactive without granting leave.
  if (value.status === "LOA") {
    const grants = await loadGrants();
    if (!grantsPermission("roster.manage_loa", req.user?.roles ?? [], grants)) {
      return res.status(403).json({
        ok: false,
        code: "AUTH_ROLE_MISSING",
        permission: "roster.manage_loa",
        message: "Granting LOA needs the roster.manage_loa permission.",
      });
    }
  }

  const outcome = await writeStatus(req.params.id, value);
  await logSync({
    discordId: req.params.id,
    characterName: str(req.body?.characterName),
    action: "status",
    detail: `Set to ${value.status}${value.loaUntil ? ` until ${value.loaUntil}` : ""}.`,
  });

  return res.json({
    ok: true,
    status: value.status,
    loaUntil: value.loaUntil,
    // The bot applies this role while someone is on leave and removes it when
    // the sweep reports the LOA expired.
    loaRole: value.status === "LOA" ? await loaRoleId() : null,
    persisted: outcome === "saved",
    ...(outcome === "saved" ? {} : { message: STATUS_WRITE_MESSAGES[outcome] }),
  });
});

/* --------------------------------------------------- staff activity overlay */

/** A YYYY-MM-DD string, or null when it is anything else. */
function isoOrNull(value) {
  const text = str(value);
  return ISO_DATE.test(text) ? text : null;
}

/**
 * GET /api/roster/activity — the activity overlay, keyed by Discord id.
 *
 * The bot owns the roster; this is the human-managed layer on top of it —
 * status, leave, probation and the last rank move. A member with no row here is
 * simply Active, so the map only carries the ones somebody has touched.
 */
router.get("/activity", requirePermission("roster.view"), async (_req, res) => {
  try {
    const rows = await query("SELECT * FROM staff_activity");
    const map = {};
    for (const row of rows) {
      map[row.discord_id] = {
        status: row.status,
        loaUntil: isoDate(row.loa_until),
        loaReason: row.loa_reason,
        probationUntil: isoDate(row.probation_until),
        lastMove: isoDate(row.last_move),
      };
    }
    return res.json(map);
  } catch {
    return res.json({});
  }
});

/**
 * POST /api/roster/activity/:discordId — set a member's activity overlay.
 *
 * Upserts, because a missing row means Active — the first edit is what creates
 * it. LOA carries its own grant, exactly as the roster status endpoint does, so
 * marking someone inactive does not also let you put them on leave.
 */
router.post("/activity/:discordId", requirePermission("roster.edit_status"), async (req, res) => {
  const discordId = str(req.params.discordId);
  if (!isDiscordId(discordId)) {
    return res
      .status(400)
      .json({ ok: false, errors: ["A valid 17–20 digit Discord user ID is required."] });
  }

  const body = req.body ?? {};
  const status = str(body.status) || "Active";
  if (!STATUS_IDS.includes(status)) {
    return res
      .status(400)
      .json({ ok: false, errors: [`status must be one of: ${STATUS_IDS.join(", ")}.`] });
  }

  const needsDate = seed.ACTIVITY_STATUSES.find((s) => s.id === status)?.requiresDate;
  const loaUntil = isoOrNull(body.loaUntil);
  const probationUntil = isoOrNull(body.probationUntil);
  const lastMove = isoOrNull(body.lastMove);

  const errors = collect([
    [!needsDate || Boolean(loaUntil), "An LOA needs a return date (YYYY-MM-DD)."],
    [!needsDate || !loaUntil || loaUntil >= todayIso(), "The LOA return date cannot be in the past."],
    [str(body.loaReason).length <= 500, "loaReason must be under 500 characters."],
    [body.probationUntil == null || body.probationUntil === "" || Boolean(probationUntil), "probationUntil must be a YYYY-MM-DD date."],
    [body.lastMove == null || body.lastMove === "" || Boolean(lastMove), "lastMove must be a YYYY-MM-DD date."],
  ]);
  if (errors.length) return res.status(400).json({ ok: false, errors });

  if (status === "LOA") {
    const grants = await loadGrants();
    if (!grantsPermission("roster.manage_loa", req.user?.roles ?? [], grants)) {
      return res.status(403).json({
        ok: false,
        code: "AUTH_ROLE_MISSING",
        permission: "roster.manage_loa",
        message: "Granting LOA needs the roster.manage_loa permission.",
      });
    }
  }

  const value = {
    status,
    loaUntil: needsDate ? loaUntil : null,
    loaReason: needsDate ? str(body.loaReason) : "",
    probationUntil,
    lastMove,
  };

  try {
    await query(
      `INSERT INTO staff_activity
         (discord_id, status, loa_until, loa_reason, probation_until, last_move, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (discord_id) DO UPDATE SET
         status          = EXCLUDED.status,
         loa_until       = EXCLUDED.loa_until,
         loa_reason      = EXCLUDED.loa_reason,
         probation_until = EXCLUDED.probation_until,
         last_move       = EXCLUDED.last_move,
         updated_at      = CURRENT_TIMESTAMP`,
      [discordId, value.status, value.loaUntil, value.loaReason || null, value.probationUntil, value.lastMove],
    );
    return res.json({ ok: true, discordId, ...value });
  } catch {
    return res.json({
      ok: true,
      discordId,
      ...value,
      persisted: false,
      message: "Accepted, but not persisted — no database configured.",
    });
  }
});

/**
 * GET /api/roster/loa/expired — the bot polls this on a timer and removes the
 * LOA tag from everyone it returns, then POSTs their status back to Active.
 *
 * Keeping the schedule here rather than in the bot means a restart, a redeploy
 * or an outage cannot silently drop a pending return.
 */
router.get("/loa/expired", requireBot, async (_req, res) => {
  const today = todayIso();
  try {
    const rows = await query("SELECT * FROM roster_members WHERE status = 'LOA' AND loa_until IS NOT NULL AND loa_until <= $1",
      [today],
    );
    return res.json({
      ok: true,
      asOf: today,
      loaRole: await loaRoleId(),
      members: rows.map(mapRow),
    });
  } catch {
    const members = seed.roster.filter(
      (m) => m.status === "LOA" && m.loaUntil && m.loaUntil <= today,
    );
    return res.json({ ok: true, asOf: today, loaRole: await loaRoleId(), members });
  }
});

/**
 * POST /api/roster/loa — the bot's own entry point, for the `/loa` command.
 * Same validation as the page, addressed by Discord id rather than roster id.
 */
router.post("/loa", requireBot, async (req, res) => {
  const discordId = str(req.body?.discordId);
  const { errors, value } = validateStatus({ ...req.body, status: "LOA" });
  if (!isDiscordId(discordId)) {
    errors.unshift("A valid 17–20 digit Discord user ID is required.");
  }
  if (errors.length) return res.status(400).json({ ok: false, errors });

  const persisted = await writeStatus(discordId, value, "roster-bot");
  await logSync({
    discordId,
    characterName: str(req.body?.characterName),
    action: "loa",
    detail: `LOA until ${value.loaUntil}.`,
  });

  return res.json({
    ok: true,
    discordId,
    status: "LOA",
    loaUntil: value.loaUntil,
    loaRole: await loaRoleId(),
    ...(persisted ? {} : { message: "Accepted, but not persisted — no database configured." }),
  });
});

/** POST /api/roster/loa/end — bring someone back, early or on schedule. */
router.post("/loa/end", requireBot, async (req, res) => {
  const discordId = str(req.body?.discordId);
  if (!isDiscordId(discordId)) {
    return res
      .status(400)
      .json({ ok: false, errors: ["A valid 17–20 digit Discord user ID is required."] });
  }

  const persisted = await writeStatus(
    discordId,
    { status: "Active", loaUntil: null, loaReason: "" },
    "roster-bot",
  );
  await logSync({
    discordId,
    characterName: str(req.body?.characterName),
    action: "loa-end",
    detail: "LOA ended; back to Active.",
  });

  return res.json({
    ok: true,
    discordId,
    status: "Active",
    // Remove this role in Discord.
    removeRole: await loaRoleId(),
    ...(persisted ? {} : { message: "Accepted, but not persisted — no database configured." }),
  });
});

/* ---------------------------------------------------------- bot sync */

function validateSyncMember(body) {
  const discordId = str(body.discordId);
  const characterName = str(body.characterName);
  const roles = Array.isArray(body.roles) ? body.roles.map(String) : null;

  return {
    errors: collect([
      [isDiscordId(discordId), "A valid 17–20 digit Discord user ID is required."],
      [
        characterName.length >= 2 && characterName.length <= 128,
        "characterName must be 2–128 characters.",
      ],
      [roles !== null, "roles must be an array of Discord role IDs."],
      [
        roles === null || roles.every((r) => SNOWFLAKE.test(r)),
        "Every role ID must be a 17–20 digit snowflake.",
      ],
      [roles === null || roles.length <= 100, "At most 100 roles per member."],
      [str(body.callsign).length <= 32, "callsign must be under 32 characters."],
    ]),
    value: {
      discordId,
      characterName,
      roles: roles ?? [],
      callsign: str(body.callsign),
      status: str(body.status) || "Active",
    },
  };
}

/** Records what the bot did, so the roster page can show a sync history. */
async function logSync(entry) {
  try {
    await query(`INSERT INTO roster_sync_log
         (discord_id, character_name, action, detail, actor)
       VALUES ($1, $2, $3, $4, $5)`,
      [entry.discordId, entry.characterName, entry.action, entry.detail, "roster-bot"],
    );
  } catch {
    // The sync itself already succeeded or failed on its own terms; losing the
    // log line is not worth failing the request the bot is waiting on.
  }
}

/**
 * POST /api/roster/sync — one member's roles changed.
 *
 * Body: { discordId, characterName, roles: [roleId], callsign?, status?, joinedAt? }
 * Pass `?dryRun=1` to compute the result without writing, which is how the bot
 * can preview a rename before applying it.
 *
 * Returns the action taken and, on an upsert, both the roster display name and
 * the Discord-safe nickname to apply.
 */
router.post("/sync", requireBot, async (req, res) => {
  const { errors, value } = validateSyncMember(req.body ?? {});
  if (errors.length) return res.status(400).json({ ok: false, errors });

  const roleMap = await loadRoleMap();
  const resolved = resolveMember(value, roleMap, seed.DEPARTMENTS);
  const dryRun = req.query.dryRun === "1" || req.query.dryRun === "true";

  if (resolved.action === "remove") {
    if (!dryRun) {
      try {
        await query("DELETE FROM roster_members WHERE discord_id = $1", [
          value.discordId,
        ]);
      } catch {
        // No database yet — the response still tells the bot what to do.
      }
      await logSync({
        discordId: value.discordId,
        characterName: value.characterName,
        action: "removed",
        detail: "No mapped roles remain.",
      });
    }
    return res.json({
      ok: true,
      action: "removed",
      dryRun,
      discordId: value.discordId,
      // Clearing the nickname hands the member's own name back to them.
      nickname: null,
      reason: resolved.reason,
    });
  }

  if (!dryRun) {
    try {
      await applyUpsert(resolved, str(req.body?.joinedAt));
    } catch {
      // No database yet — the computed result is still returned so the bot can
      // apply the nickname and the flow is exercisable end to end.
    }
    await logSync({
      discordId: value.discordId,
      characterName: value.characterName,
      action: "synced",
      detail: `Rostered as ${resolved.entry.department.toUpperCase()} ${resolved.entry.rank}.`,
    });
  }

  return res.json({
    ok: true,
    action: "upserted",
    dryRun,
    matchedRole: resolved.matchedRole,
    member: resolved.entry,
    nickname: resolved.entry.nickname,
  });
});

/**
 * POST /api/roster/sync/bulk — full reconciliation.
 *
 * Body: { members: [ …same shape as /sync… ] }
 *
 * Anyone in the roster but absent from the payload is dropped, so a nightly
 * sweep converges even when individual role events were missed. Per-member
 * validation failures are reported rather than failing the whole sweep, because
 * one malformed row should not block a reconciliation of hundreds.
 */
router.post("/sync/bulk", requireBot, async (req, res) => {
  const members = Array.isArray(req.body?.members) ? req.body.members : null;
  if (!members) {
    return res.status(400).json({ ok: false, errors: ["members must be an array."] });
  }
  if (members.length > 2000) {
    return res
      .status(400)
      .json({ ok: false, errors: ["At most 2000 members per sweep."] });
  }

  const dryRun = req.query.dryRun === "1" || req.query.dryRun === "true";
  const roleMap = await loadRoleMap();

  const results = [];
  const rejected = [];
  const seen = new Set();

  for (const raw of members) {
    const { errors, value } = validateSyncMember(raw ?? {});
    if (errors.length) {
      rejected.push({ discordId: str(raw?.discordId), errors });
      continue;
    }
    seen.add(value.discordId);

    const resolved = resolveMember(value, roleMap, seed.DEPARTMENTS);
    if (resolved.action === "remove") {
      if (!dryRun) {
        try {
          await query("DELETE FROM roster_members WHERE discord_id = $1", [
            value.discordId,
          ]);
        } catch {
          /* no database — the response still reports the intent */
        }
      }
      results.push({ discordId: value.discordId, action: "removed", nickname: null });
      continue;
    }

    if (!dryRun) {
      try {
        await applyUpsert(resolved, str(raw?.joinedAt));
      } catch {
        /* no database — the response still reports the intent */
      }
    }
    results.push({
      discordId: value.discordId,
      action: "upserted",
      nickname: resolved.entry.nickname,
      member: resolved.entry,
    });
  }

  // Reconcile: anyone rostered but not in this sweep no longer holds a mapped
  // role, so they come off.
  let dropped = [];
  try {
    const rows = await query("SELECT discord_id FROM roster_members");
    dropped = rows.map((r) => r.discord_id).filter((id) => !seen.has(id));
    if (!dryRun && dropped.length) {
      await query(`DELETE FROM roster_members WHERE discord_id IN (${dropped.map(() => "$1").join(",")})`,
        dropped,
      );
    }
  } catch {
    // Without a database there is nothing to reconcile against.
  }

  if (!dryRun) {
    await logSync({
      discordId: "—",
      characterName: "—",
      action: "bulk-sync",
      detail: `Reconciled ${results.length} members; ${dropped.length} dropped; ${rejected.length} rejected.`,
    });
  }

  return res.json({
    ok: true,
    dryRun,
    processed: results.length,
    dropped,
    rejected,
    results,
  });
});

export default router;
