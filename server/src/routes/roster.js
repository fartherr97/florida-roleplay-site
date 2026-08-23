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
import { query } from "../db.js";
import * as seed from "../rosterSeed.js";
import { MEMBER_ANY } from "../seed.js";
import { requireRole } from "../middleware/requireRole.js";
import { requireBot } from "../middleware/requireBot.js";
import { buildNickname, renderDisplayName, resolveRole } from "../lib/roster.js";
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
  };
}

/** Loads the roster from the database, falling back to the seeded list. */
async function loadRoster() {
  try {
    const rows = await query(
      "SELECT * FROM roster_members ORDER BY department, rank_label, character_name",
    );
    if (rows.length) return rows.map(mapRow);
  } catch {
    // fall through
  }
  return seed.roster;
}

/** Loads the role map, falling back to the seeded one. */
async function loadRoleMap() {
  try {
    const rows = await query(
      "SELECT * FROM roster_role_map ORDER BY sort_order DESC",
    );
    if (rows.length) {
      return rows.map((row) => ({
        roleId: row.role_id,
        key: row.role_key,
        department: row.department,
        rank: row.rank_label,
        order: row.sort_order,
        displayTemplate: row.display_template,
      }));
    }
  } catch {
    // fall through
  }
  return seed.ROLE_MAP;
}

/* -------------------------------------------------------------- reads */

router.get("/", requireRole(MEMBER_ANY), async (_req, res) => {
  res.json(await loadRoster());
});

/**
 * The role map the bot consumes. Deliberately readable by the bot without a
 * member session — it is configuration, not member data — but writes still need
 * the bot token.
 */
router.get("/role-map", async (_req, res) => {
  res.json({
    divisions: seed.DIVISIONS,
    departments: seed.DEPARTMENTS,
    roles: await loadRoleMap(),
  });
});

router.get("/sync-log", requireRole(MEMBER_ANY), (_req, res) =>
  (async () => {
    try {
      const rows = await query(
        "SELECT * FROM roster_sync_log ORDER BY created_at DESC LIMIT 100",
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

/* ---------------------------------------------------------- bot sync */

/**
 * Resolves one member against the role map and returns what the roster should
 * look like for them. Pure, so both the single and bulk endpoints share it and
 * the dry-run path costs nothing.
 */
function resolveMember(payload, roleMap, departments) {
  const matched = resolveRole(payload.roles, roleMap);

  if (!matched) {
    return { action: "remove", reason: "no mapped roles" };
  }

  const department = departments.find((d) => d.id === matched.department) ?? null;
  const entry = {
    discordId: payload.discordId,
    characterName: payload.characterName,
    department: matched.department,
    rank: matched.rank,
    callsign: payload.callsign ?? "",
  };

  return {
    action: "upsert",
    entry: {
      ...entry,
      // The site shows the full name; Discord gets the version that fits its
      // 32-character nickname limit. Returning both means the bot never has to
      // decide how to shorten anything.
      displayName: renderDisplayName(matched.displayTemplate, entry, department),
      nickname: buildNickname(entry, department, matched.displayTemplate),
      status: payload.status ?? "Active",
    },
    matchedRole: matched.key,
  };
}

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
    await query(
      `INSERT INTO roster_sync_log
         (discord_id, character_name, action, detail, actor)
       VALUES (?, ?, ?, ?, ?)`,
      [entry.discordId, entry.characterName, entry.action, entry.detail, "roster-bot"],
    );
  } catch {
    // The sync itself already succeeded or failed on its own terms; losing the
    // log line is not worth failing the request the bot is waiting on.
  }
}

async function applyUpsert(resolved, joinedAt) {
  const e = resolved.entry;
  await query(
    `INSERT INTO roster_members
       (id, discord_id, character_name, display_name, department, rank_label,
        callsign, status, joined_at, synced_at, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_DATE), CURRENT_TIMESTAMP, 'discord-sync')
     ON DUPLICATE KEY UPDATE
       character_name = VALUES(character_name),
       display_name   = VALUES(display_name),
       department     = VALUES(department),
       rank_label     = VALUES(rank_label),
       callsign       = VALUES(callsign),
       status         = VALUES(status),
       synced_at      = CURRENT_TIMESTAMP,
       source         = 'discord-sync'`,
    [
      `rm-${e.discordId}`,
      e.discordId,
      e.characterName,
      e.displayName,
      e.department,
      e.rank,
      e.callsign,
      e.status,
      joinedAt || null,
    ],
  );
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
        await query("DELETE FROM roster_members WHERE discord_id = ?", [
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
          await query("DELETE FROM roster_members WHERE discord_id = ?", [
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
      await query(
        `DELETE FROM roster_members WHERE discord_id IN (${dropped.map(() => "?").join(",")})`,
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
