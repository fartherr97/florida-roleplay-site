/**
 * Keeping a signed-in user's site roles in step with their live Discord roles.
 *
 * Sign-in writes a snapshot of the caller's roles into `user_roles`. On its own that
 * snapshot only changes when they sign in again — so a Discord demotion would not reach the
 * site until the next login, which for a staff/management portal is a real hole.
 *
 * This refreshes that snapshot from Discord on a short interval as requests come in: the
 * first request after the interval re-reads the member's live roles (with the bot token, the
 * same call sign-in uses), rewrites `user_roles`, and every request in between reads the
 * fresh snapshot. A demotion therefore takes effect within the interval — seconds, not "next
 * login" — while the cache keeps us far under Discord's rate limits.
 *
 * It fails safe in every direction:
 *   - A transient Discord failure keeps the existing snapshot and retries shortly; it never
 *     strips or widens access on an error.
 *   - A 404 (the member has left the guild) is authoritative and clears their roles.
 *   - With no bot token / guild configured (local dev) it does nothing and the snapshot stands.
 */
import { execute, query } from "../db.js";
import { fetchMemberRoles } from "./discord.js";
import * as rosterSeed from "../rosterSeed.js";

/** How long a refreshed snapshot is trusted before the next request re-reads Discord. */
const TTL_MS = Math.max(3, Number(process.env.ROLE_REFRESH_TTL_SECONDS) || 5) * 1000;
/** After a failed read, wait this long before trying again rather than hammering Discord. */
const ERROR_BACKOFF_MS = 10_000;

/** userId -> epoch ms until which the snapshot is considered fresh. */
const freshUntil = new Map();
/** userId -> in-flight refresh, so concurrent requests share one Discord call. */
const inFlight = new Map();

/**
 * Maps a member's Discord role IDs to this site's role keys. Every guild member is at least
 * a `member`; every mapped role they hold is added on top. Uses the same `roster_role_map`
 * table the bot and the role-mapping page use, so access here can never disagree with how a
 * rank is rostered.
 *
 * @param {string[]} discordRoleIds
 * @returns {Promise<string[]>}
 */
export async function resolveRoleKeys(discordRoleIds) {
  const held = new Set(["member"]);
  const ids = discordRoleIds.map(String);
  if (!ids.length) return [...held];

  try {
    const rows = await query(
      `SELECT DISTINCT role_key FROM roster_role_map WHERE role_id = ANY($1)`,
      [ids],
    );
    if (rows.length) {
      rows.forEach((row) => held.add(row.role_key));
      return [...held];
    }
  } catch {
    // fall through to the seed map
  }

  const idSet = new Set(ids);
  [...rosterSeed.ROLE_MAP, ...rosterSeed.SPECIAL_ROLES].forEach((entry) => {
    if (idSet.has(String(entry.roleId))) held.add(entry.key);
  });
  return [...held];
}

/** Replaces a user's stored roles wholesale, so a demotion removes access rather than only ever adding it. */
export async function writeUserRoles(userId, roleKeys) {
  await execute(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
  for (const role of roleKeys) {
    await execute(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, $2)
       ON CONFLICT (user_id, role) DO NOTHING`,
      [userId, role],
    );
  }
}

/** Whether a live refresh is even possible in this environment. */
function canRefresh() {
  return Boolean(process.env.DISCORD_GUILD_ID && process.env.DISCORD_BOT_TOKEN);
}

/**
 * Re-reads a user's live Discord roles and rewrites their snapshot.
 *
 * @param {string} userId
 * @returns {Promise<{inGuild: boolean, roles: string[]}>}
 */
export async function refreshUserRoles(userId) {
  const membership = await fetchMemberRoles(userId);
  if (membership === null) {
    // Authoritative: they are no longer in the guild, so they hold nothing here.
    await writeUserRoles(userId, []);
    return { inGuild: false, roles: [] };
  }
  const roles = await resolveRoleKeys(membership.roles);
  await writeUserRoles(userId, roles);
  return { inGuild: true, roles };
}

/**
 * Refreshes the snapshot if it has gone stale, otherwise leaves it. Returns the fresh role
 * keys when a refresh ran, or null when the cached snapshot should stand (fresh, throttled,
 * unconfigured, or a transient failure). Never throws.
 *
 * @param {string} userId
 * @returns {Promise<string[] | null>}
 */
export async function maybeRefreshRoles(userId) {
  if (!userId || !canRefresh()) return null;

  const now = Date.now();
  const until = freshUntil.get(userId);
  if (until && until > now) return null; // still fresh

  if (inFlight.has(userId)) return inFlight.get(userId);

  const promise = refreshUserRoles(userId)
    .then((result) => {
      freshUntil.set(userId, Date.now() + TTL_MS);
      return result.roles;
    })
    .catch(() => {
      // Keep the existing snapshot; back off briefly before retrying.
      freshUntil.set(userId, Date.now() + ERROR_BACKOFF_MS);
      return null;
    })
    .finally(() => inFlight.delete(userId));

  inFlight.set(userId, promise);
  return promise;
}
