/**
 * Applying a processed transfer to Discord.
 *
 * When a transfer ticket is processed at a rank, this strips the outgoing department's
 * roles and grants the incoming department's — but only ONE rank role: the rank the member
 * was processed as, not every rank. The rule:
 *
 *   • remove  = the outgoing department's configured strip set (rank + base membership)
 *   • add     = the incoming department's configured grant set, MINUS every rank role,
 *               PLUS the single rank role matching the assigned rank
 *
 * The strip/grant sets are configured in the bot dashboard (Management → Bot → Transfers)
 * and read from the bot over a token-gated server-to-server call. Which roles are "ranks"
 * (so all-but-one are dropped from the grant) comes from this site's own rank map, keyed by
 * department — the same map the roster is built from, so it never drifts.
 *
 * Departments are separate Discord servers; the strip happens in the outgoing server and
 * the grant in the incoming one, both with the site's bot token. Everything here is
 * best-effort: a role the bot cannot manage, or a member missing from a server, is recorded
 * and skipped — it never aborts the rest or fails the ticket that was already processed.
 */
import { query } from "../db.js";
import * as seed from "../rosterSeed.js";
import { DEPARTMENT_CONFIGS } from "../departmentSeed.js";
import { DEPTS } from "./portal.js";
import { addMemberRole, removeMemberRole } from "./discord.js";

const SNOWFLAKE = /^\d{17,20}$/;

/** Maps a ticket's department (abbreviation like "BCSO", or an id) to the config id. */
function deptIdOf(dept) {
  if (!dept) return null;
  return DEPTS[dept] ?? String(dept).toLowerCase();
}

/** The rank role map, live from the database, falling back to the seed. */
async function loadRankMap() {
  try {
    const rows = await query(
      "SELECT role_id, department, rank_label, rank_full FROM roster_role_map WHERE kind = 'rank'",
    );
    if (rows.length) {
      return rows.map((row) => ({
        roleId: String(row.role_id),
        department: row.department,
        rank: row.rank_label,
        rankFull: row.rank_full,
      }));
    }
  } catch {
    // No database — the seed stands.
  }
  return seed.ROLE_MAP.map((r) => ({
    roleId: String(r.roleId),
    department: r.department,
    rank: r.rank,
    rankFull: r.rankFull,
  }));
}

/** A department's Discord guild id, from its stored config, falling back to the seed. */
async function guildIdForDept(deptId) {
  try {
    const rows = await query("SELECT config FROM department_configs WHERE id = $1", [deptId]);
    if (rows.length) {
      const cfg = typeof rows[0].config === "object" ? rows[0].config : JSON.parse(rows[0].config);
      const g = String(cfg?.guildId ?? "").trim();
      if (SNOWFLAKE.test(g)) return g;
    }
  } catch {
    // fall through to seed
  }
  const seedGuild = String(DEPARTMENT_CONFIGS[deptId]?.guildId ?? "").trim();
  return SNOWFLAKE.test(seedGuild) ? seedGuild : null;
}

/* ─── Bot transfer config (strip/grant sets), cached ───────────────────────── */

let cache = { at: 0, byGuildId: null };
const CACHE_MS = 60_000;

/**
 * Fetches every department's strip/grant sets from the bot, keyed by Discord guild id.
 * Returns null when the bot link is not configured or the call fails, so callers degrade to
 * "roles not applied automatically" rather than throwing.
 */
async function loadBotTransferConfig() {
  if (cache.byGuildId && Date.now() - cache.at < CACHE_MS) return cache.byGuildId;

  const botUrl = process.env.BOT_API_URL;
  const token = process.env.WHITELIST_INGEST_TOKEN;
  if (!botUrl || !token) return null;

  try {
    const res = await fetch(`${botUrl.replace(/\/$/, "")}/api/transfers/sync-config`, {
      headers: { "x-service-token": token },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    const guilds = Array.isArray(body?.guilds) ? body.guilds : [];
    const byGuildId = new Map();
    for (const g of guilds) {
      const gid = String(g.discordGuildId ?? "").trim();
      if (!gid) continue;
      byGuildId.set(gid, {
        stripRoleIds: (g.stripRoleIds ?? []).map(String),
        grantRoleIds: (g.grantRoleIds ?? []).map(String),
      });
    }
    cache = { at: Date.now(), byGuildId };
    return byGuildId;
  } catch {
    return null;
  }
}

/**
 * Works out exactly which roles a processed transfer should remove and add, without
 * touching Discord. Returns `{ ok:false, reason }` when it cannot be computed (missing
 * config, unknown department, bot link down), or the resolved change set on success.
 *
 * @param {{fromDept:string, toDept:string, assignedRank:string}} input
 */
export async function computeTransferRoleChanges({ fromDept, toDept, assignedRank }) {
  const fromDeptId = deptIdOf(fromDept);
  const toDeptId = deptIdOf(toDept);
  if (!fromDeptId || !toDeptId) return { ok: false, reason: "unknown_department" };

  const [fromGuildId, toGuildId, cfg, rankMap] = await Promise.all([
    guildIdForDept(fromDeptId),
    guildIdForDept(toDeptId),
    loadBotTransferConfig(),
    loadRankMap(),
  ]);

  if (!cfg) return { ok: false, reason: "bot_config_unavailable" };
  if (!fromGuildId || !toGuildId) return { ok: false, reason: "guild_not_configured" };

  const fromCfg = cfg.get(fromGuildId);
  const toCfg = cfg.get(toGuildId);
  if (!fromCfg && !toCfg) return { ok: false, reason: "no_transfer_config" };

  // Every rank role in the incoming department — all but the chosen one are dropped from
  // the grant so a member joins at a single rank, not all of them.
  const toRankRoleIds = new Set(
    rankMap.filter((r) => r.department === toDeptId).map((r) => r.roleId),
  );

  // The one rank the member was processed as. Matched on the long label the portal shows,
  // then the short label as a fallback.
  const wanted = String(assignedRank ?? "").trim().toLowerCase();
  const chosen = rankMap.find(
    (r) =>
      r.department === toDeptId &&
      (String(r.rankFull ?? "").trim().toLowerCase() === wanted ||
        String(r.rank ?? "").trim().toLowerCase() === wanted),
  );
  const chosenRankRoleId = chosen?.roleId ?? null;

  const grant = (toCfg?.grantRoleIds ?? []).map(String);
  const baseAdd = grant.filter((id) => !toRankRoleIds.has(id));
  const addRoleIds = [...new Set([...baseAdd, ...(chosenRankRoleId ? [chosenRankRoleId] : [])])];

  const removeRoleIds = [...new Set((fromCfg?.stripRoleIds ?? []).map(String))];

  return {
    ok: true,
    fromDeptId,
    toDeptId,
    fromGuildId,
    toGuildId,
    removeRoleIds,
    addRoleIds,
    chosenRankRoleId,
    rankMatched: Boolean(chosenRankRoleId),
    assignedRank,
  };
}

/**
 * Applies a processed transfer to Discord: strips the outgoing roles in the outgoing guild,
 * grants the incoming roles in the incoming guild. Best-effort and never throws.
 *
 * @returns {Promise<{applied:boolean, reason?:string, removed:string[], added:string[], failed:Array<{side:string,id:string}>, rankMatched?:boolean}>}
 */
export async function applyProcessedTransfer({ discordUserId, fromDept, toDept, assignedRank, reason }) {
  if (!discordUserId) return { applied: false, reason: "no_user", removed: [], added: [], failed: [] };

  const plan = await computeTransferRoleChanges({ fromDept, toDept, assignedRank });
  if (!plan.ok) return { applied: false, reason: plan.reason, removed: [], added: [], failed: [] };

  const auditReason = `FLRP transfer: ${fromDept} → ${toDept}${assignedRank ? ` (${assignedRank})` : ""}`;
  const removed = [];
  const added = [];
  const failed = [];

  for (const roleId of plan.removeRoleIds) {
    const ok = await removeMemberRole(plan.fromGuildId, discordUserId, roleId, reason || auditReason).catch(
      () => false,
    );
    if (ok) removed.push(roleId);
    else failed.push({ side: "remove", id: roleId });
  }

  for (const roleId of plan.addRoleIds) {
    const ok = await addMemberRole(plan.toGuildId, discordUserId, roleId, reason || auditReason).catch(
      () => false,
    );
    if (ok) added.push(roleId);
    else failed.push({ side: "add", id: roleId });
  }

  return { applied: true, removed, added, failed, rankMatched: plan.rankMatched };
}
