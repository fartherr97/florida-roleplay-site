/**
 * Keeping the community roster in step with Discord — automatically.
 *
 * Two things feed the roster. An external bot may POST one member at a time to
 * /api/roster/sync (see routes/roster.js). And, when the site has its own bot
 * token, this module pulls the whole guild on an interval and after role-map
 * edits, resolves every member against the role map, and upserts them — so a
 * department roster fills in on its own once its roles are mapped, with no bot
 * to run and no button to press.
 *
 * The member resolution and upsert live here so both paths share exactly one
 * implementation; routes/roster.js imports them for its push endpoint.
 */
import { query } from "../db.js";
import * as seed from "../rosterSeed.js";
import { DEPARTMENT_CONFIGS } from "../departmentSeed.js";
import { resolveRole, buildNickname, renderDisplayName } from "./roster.js";
import { fetchGuildMembers } from "./discord.js";

/**
 * Resolves one member against the role map and returns what the roster should
 * look like for them. Pure, so every caller shares it.
 */
export function resolveMember(payload, roleMap, departments) {
  const matched = resolveRole(payload.roles, roleMap);
  if (!matched) return { action: "remove", reason: "no mapped roles" };

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
      displayName: renderDisplayName(matched.displayTemplate, entry, department),
      nickname: buildNickname(entry, department, matched.displayTemplate),
      status: payload.status ?? "Active",
    },
    matchedRole: matched.key,
  };
}

/** Insert or update one resolved member. */
export async function applyUpsert(resolved, joinedAt) {
  const e = resolved.entry;
  await query(`INSERT INTO roster_members
       (id, discord_id, character_name, display_name, department, rank_label,
        callsign, status, joined_at, synced_at, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, CURRENT_DATE), CURRENT_TIMESTAMP, 'discord-sync')
     ON CONFLICT (discord_id) DO UPDATE SET
       character_name = EXCLUDED.character_name,
       display_name   = EXCLUDED.display_name,
       department     = EXCLUDED.department,
       rank_label     = EXCLUDED.rank_label,
       callsign       = EXCLUDED.callsign,
       status         = EXCLUDED.status,
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

/** The rank role map, live from the database, falling back to the seed. */
async function loadRankMap() {
  try {
    const rows = await query(
      "SELECT * FROM roster_role_map WHERE kind = 'rank' ORDER BY sort_order DESC",
    );
    if (rows.length) {
      return rows.map((row) => ({
        roleId: row.role_id,
        key: row.role_key,
        department: row.department,
        rank: row.rank_label,
        rankFull: row.rank_full,
        order: row.sort_order,
        displayTemplate: row.display_template,
      }));
    }
  } catch {
    // No database — the seed stands.
  }
  return seed.ROLE_MAP;
}

const SNOWFLAKE = /^\d{17,20}$/;

/**
 * Every Discord server the roster spans: the main guild, plus each department's
 * own server when it runs one. Reads the stored configs, falling back to the
 * seeds, so a department head can point their hub at a new server from the
 * Builder without a redeploy.
 */
async function collectGuildIds() {
  const ids = new Set();
  const main = String(process.env.DISCORD_GUILD_ID ?? "").trim();
  if (SNOWFLAKE.test(main)) ids.add(main);

  const add = (cfg) => {
    const g = String(cfg?.guildId ?? "").trim();
    if (SNOWFLAKE.test(g)) ids.add(g);
  };
  try {
    const rows = await query("SELECT config FROM department_configs");
    for (const row of rows) {
      const cfg = typeof row.config === "object" ? row.config : JSON.parse(row.config);
      add(cfg);
    }
  } catch {
    // No database — the seed configs below stand.
  }
  for (const cfg of Object.values(DEPARTMENT_CONFIGS)) add(cfg);
  return [...ids];
}

let lastSyncAt = 0;
let inProgress = false;
const MIN_INTERVAL_MS = 60_000;

/**
 * Reconcile the roster to Discord across every guild it spans: a member's roles
 * from all the servers they share with the bot are merged and resolved once (so
 * someone in the main guild and a department guild lands under the higher rank),
 * everyone matched is upserted, and the bot-synced rows for anyone who resolves
 * nowhere are pruned. Never throws. Pruning only runs when every guild was read
 * cleanly, so a single server's outage never wipes the roster.
 */
export async function syncRosterFromGuild() {
  if (inProgress) return { skipped: "in-progress" };
  inProgress = true;
  try {
    const guildIds = await collectGuildIds();
    if (guildIds.length === 0) return { configured: false };

    // Merge each member's roles across every guild they're in with the bot.
    const byId = new Map(); // discordId -> { roles:Set, name }
    let errors = 0;
    let ok = 0;
    for (const gid of guildIds) {
      let members;
      try {
        members = await fetchGuildMembers(gid);
      } catch (err) {
        errors += 1;
        // eslint-disable-next-line no-console
        console.warn("[roster-sync] guild", gid, err?.code || err?.message || err);
        continue;
      }
      if (!members) continue;
      ok += 1;
      for (const m of members) {
        const cur = byId.get(m.id) ?? { roles: new Set(), name: "" };
        for (const r of m.roles) cur.roles.add(r);
        if (!cur.name) cur.name = m.displayName || m.username || "";
        byId.set(m.id, cur);
      }
    }

    if (ok === 0) return { configured: true, error: errors ? "unreadable" : "no-guilds" };

    const roleMap = await loadRankMap();
    const keep = [];
    for (const [discordId, data] of byId) {
      const resolved = resolveMember(
        { discordId, characterName: data.name || "Member", roles: [...data.roles], callsign: "" },
        roleMap,
        seed.DEPARTMENTS,
      );
      if (resolved.action === "upsert") {
        await applyUpsert(resolved, null);
        keep.push(discordId);
      }
    }

    // Prune only on a clean full read, so a transient outage on one server does
    // not delete members the roster still holds. Manually-added rows (a
    // different source) are never touched.
    if (errors === 0) {
      try {
        if (keep.length) {
          await query(
            "DELETE FROM roster_members WHERE source = 'discord-sync' AND NOT (discord_id = ANY($1))",
            [keep],
          );
        } else {
          await query("DELETE FROM roster_members WHERE source = 'discord-sync'");
        }
      } catch {
        // Pruning is best-effort; a failed delete just leaves a stale row.
      }
    }

    lastSyncAt = Date.now();
    return { configured: true, guilds: guildIds.length, scanned: byId.size, matched: keep.length, errors };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[roster-sync]", err?.code || err?.message || err);
    return { error: err?.code || "failed" };
  } finally {
    inProgress = false;
  }
}

/**
 * Kick a background sync if one has not run recently — called from the roster
 * reads, so viewing a roster shortly after mapping roles fills it in without
 * waiting for the interval. Throttled and fire-and-forget.
 */
export function maybeSyncRoster() {
  if (inProgress || Date.now() - lastSyncAt < MIN_INTERVAL_MS) return;
  lastSyncAt = Date.now(); // reserve the window before the async work starts
  syncRosterFromGuild().catch(() => {});
}

/** Start the automatic sync: once shortly after boot, then on an interval. */
export function startRosterSync({ intervalMs = 5 * 60_000 } = {}) {
  setTimeout(() => syncRosterFromGuild().catch(() => {}), 8000).unref?.();
  setInterval(() => syncRosterFromGuild().catch(() => {}), intervalMs).unref?.();
}
