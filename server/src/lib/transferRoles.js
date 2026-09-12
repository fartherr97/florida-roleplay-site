/** Apply incoming grants first, then remove outgoing non-staff roles. Failures remain retryable. */
import { query } from "../db.js";
import * as seed from "../rosterSeed.js";
import { DEPARTMENT_CONFIGS } from "../departmentSeed.js";
import { DEPTS } from "./portal.js";
import { addMemberRole, removeMemberRole, fetchGuildMember } from "./discord.js";

const SNOWFLAKE = /^\d{17,20}$/;

/** Maps a ticket's department (abbreviation like "BSO", or an id) to the config id. */
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
export async function guildIdForDept(deptId) {
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
        protectedRoleIds: (g.protectedRoleIds ?? []).map(String),
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
  if (!fromCfg || !toCfg) return { ok: false, reason: "no_transfer_config" };

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

  if (!chosenRankRoleId) return {ok:false,reason:'assigned_rank_not_mapped'};
  if (fromGuildId === toGuildId) return {ok:false,reason:'departments_must_use_distinct_guilds'};
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
    protectedRoleIds: fromCfg.protectedRoleIds || [],
    addRoleIds,
    toRankRoleIds: [...toRankRoleIds],
    chosenRankRoleId,
    rankMatched: Boolean(chosenRankRoleId),
    assignedRank,
  };
}

/**
 * Applies a processed transfer to Discord: strips the outgoing roles in the outgoing guild,
 * grants the incoming roles in the incoming guild. Fails closed when configuration or Discord updates are incomplete.
 *
 * @returns {Promise<{applied:boolean, reason?:string, removed:string[], added:string[], failed:Array<{side:string,id:string}>, rankMatched?:boolean}>}
 */
export function protectedTransferRole(role, protectedIds = []) {
  const name = String(role.name || '').replace(/[_|\-]/g,' ');
  return Boolean(role.managed || protectedIds.includes(role.id) || /\b(admin(?:istrator)?|staff|mod|moderator|owner(?:ship)?|director|developer)\b/i.test(name));
}
async function guildRoles(guildId) {
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`,{headers:{Authorization:`Bot ${process.env.DISCORD_BOT_TOKEN}`},signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('Role list unavailable');
  return response.json();
}
export async function applyProcessedTransfer({ discordUserId, fromDept, toDept, assignedRank, reason }) {
  const empty = {applied:false,removed:[],added:[],failed:[]};
  if (!SNOWFLAKE.test(discordUserId || '')) return {...empty,reason:'no_user'};
  const plan = await computeTransferRoleChanges({fromDept,toDept,assignedRank});
  if(!plan.ok)return {...empty,reason:plan.reason};
  let outgoing,incoming,roles,toRoles;
  try {
    [outgoing,incoming,roles,toRoles]=await Promise.all([fetchGuildMember(plan.fromGuildId,discordUserId),fetchGuildMember(plan.toGuildId,discordUserId),guildRoles(plan.fromGuildId),guildRoles(plan.toGuildId)]);
  } catch {return {...empty,reason:'discord_preflight_failed'};}
  if(!outgoing || !incoming)return {...empty,reason:'member_must_join_both_department_guilds'};
  if(plan.addRoleIds.some(id=>!toRoles.some(r=>r.id===id && !r.managed)))return {...empty,reason:'incoming_role_missing_or_managed'};
  const auditReason=reason || `FLRP transfer: ${fromDept} to ${toDept} (${assignedRank})`;
  const removed=[],added=[],failed=[];
  // Grant first: a failed incoming assignment must never strip the old department.
  for(const id of plan.addRoleIds) {
    if(incoming.roles.includes(id))continue;
    if(await addMemberRole(plan.toGuildId,discordUserId,id,auditReason).catch(()=>false))added.push(id);
    else failed.push({side:'add',id});
  }
  if(failed.length)return {applied:false,reason:'incoming_role_update_failed',removed,added,failed,rankMatched:true};
  // Clear old incoming ranks while preserving any role that also grants staff access.
  for(const role of toRoles.filter(r=>incoming.roles.includes(r.id) && plan.toRankRoleIds.includes(r.id) && r.id!==plan.chosenRankRoleId && !protectedTransferRole(r))) {
    if(await removeMemberRole(plan.toGuildId,discordUserId,role.id,auditReason).catch(()=>false))removed.push(role.id);
    else failed.push({side:'incoming-rank-remove',id:role.id});
  }
  if(failed.length)return {applied:false,reason:'incoming_rank_update_failed',removed,added,failed,rankMatched:true};
  const removals=roles.filter(r=>outgoing.roles.includes(r.id) && r.id!==plan.fromGuildId && !protectedTransferRole(r,plan.protectedRoleIds));
  for(const role of removals) {
    if(await removeMemberRole(plan.fromGuildId,discordUserId,role.id,auditReason).catch(()=>false))removed.push(role.id);
    else failed.push({side:'remove',id:role.id});
  }
  return {applied:failed.length===0,reason:failed.length?'outgoing_role_update_failed':undefined,removed,added,failed,rankMatched:true};
}
