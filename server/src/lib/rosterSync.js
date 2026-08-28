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

let lastSyncAt = 0;
let inProgress = false;
const MIN_INTERVAL_MS = 60_000;

/**
 * Pull the whole guild and reconcile the roster to it: upsert everyone holding a
 * mapped role, and drop the bot-synced rows for anyone who no longer holds one
 * (or has left the guild). Never throws — a missing intent or a Discord blip is
 * swallowed so the caller (an interval or a page view) is unaffected.
 */
export async function syncRosterFromGuild() {
  if (inProgress) return { skipped: "in-progress" };
  inProgress = true;
  try {
    const members = await fetchGuildMembers();
    if (!members) return { configured: false };

    const roleMap = await loadRankMap();
    const keep = [];
    for (const m of members) {
      const resolved = resolveMember(
        { discordId: m.id, characterName: m.displayName || m.username || "Member", roles: m.roles, callsign: "" },
        roleMap,
        seed.DEPARTMENTS,
      );
      if (resolved.action === "upsert") {
        await applyUpsert(resolved, null);
        keep.push(m.id);
      }
    }

    // Prune bot-synced members who no longer resolve — left the guild, or lost
    // the role. Manually-added rows (a different source) are never touched.
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

    lastSyncAt = Date.now();
    return { configured: true, scanned: members.length, matched: keep.length };
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
