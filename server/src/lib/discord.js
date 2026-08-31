/**
 * Discord OAuth and guild-member lookups.
 *
 * The site does the whole handshake itself rather than trusting anything the
 * browser sends about who someone is. Two Discord credentials are involved and
 * they do different jobs:
 *
 *   - the OAuth client (id + secret) proves the *user* authorised us, and only
 *     ever gets the `identify` scope — their id, username and avatar, nothing
 *     that could act on their behalf;
 *   - the bot token reads the *guild* to find out which roles that user holds,
 *     because roles are a property of the server, not something the user can
 *     assert about themselves.
 *
 * Keeping role discovery on the bot token is what makes the roles trustworthy:
 * a signed-in member cannot grant themselves a staff role by editing a request.
 */

const API_BASE = "https://discord.com/api/v10";

/** True only when every credential the flow needs is present. */
export function oauthConfigured() {
  return Boolean(
    process.env.DISCORD_CLIENT_ID &&
      process.env.DISCORD_CLIENT_SECRET &&
      process.env.DISCORD_BOT_TOKEN &&
      process.env.DISCORD_GUILD_ID &&
      process.env.DISCORD_REDIRECT_URI,
  );
}

/** The Discord consent screen to send the browser to. */
export function authorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify",
    state,
  });
  return `${API_BASE}/oauth2/authorize?${params.toString()}`;
}

/** Exchanges the callback code for a short-lived user access token. */
export async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
  });

  const res = await fetch(`${API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Discord token exchange failed (${res.status})`);
  }
  return res.json();
}

/** Who the access token belongs to. Scope is `identify`, so this is all we get. */
export async function fetchIdentity(accessToken) {
  const res = await fetch(`${API_BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Discord identity lookup failed (${res.status})`);
  }
  const u = await res.json();
  return {
    id: u.id,
    username: u.username,
    // `global_name` is the new display name; fall back to the legacy username.
    displayName: u.global_name || u.username,
    avatar: avatarUrl(u.id, u.avatar),
  };
}

/**
 * The roles the user holds in our guild, read with the bot token.
 *
 * Returns `null` when the user is not a member of the guild — Discord answers
 * that with a 404, and it is the one case the caller treats as "you have to be
 * in our Discord", distinct from a transient failure.
 */
export async function fetchMemberRoles(userId) {
  const res = await fetch(
    `${API_BASE}/guilds/${process.env.DISCORD_GUILD_ID}/members/${userId}`,
    { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Discord member lookup failed (${res.status})`);
  }
  const member = await res.json();
  return {
    roles: Array.isArray(member.roles) ? member.roles.map(String) : [],
    nick: member.nick ?? null,
  };
}

/**
 * Every role in our guild, read with the bot token — the real names and ids, so access can
 * be set against the roles that actually exist rather than a seeded ladder.
 *
 * Returns `null` when the bot token or guild id is not configured, so callers can fall back
 * to the seeded role map rather than error. `@everyone` (the role whose id is the guild id)
 * and integration-managed roles are dropped: neither is something a human assigns by hand.
 */
export async function fetchGuildRoles(guildId = process.env.DISCORD_GUILD_ID) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || !guildId) return null;

  const res = await fetch(`${API_BASE}/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Discord role list failed (${res.status})`);
  }
  const roles = await res.json();
  return (Array.isArray(roles) ? roles : [])
    .filter((role) => role.id !== guildId && !role.managed)
    .sort((a, b) => (b.position ?? 0) - (a.position ?? 0))
    .map((role) => ({
      id: String(role.id),
      name: role.name,
      color: role.color ? `#${role.color.toString(16).padStart(6, "0")}` : null,
      position: role.position ?? 0,
    }));
}

/**
 * Every member of our guild, read with the bot token, paginated 1000 at a time.
 *
 * This is how the roster fills itself without an external bot: the site reads
 * who holds which roles and resolves each against the role map. It needs the
 * bot's **Server Members Intent** enabled in the Discord developer portal —
 * without it Discord answers 403, which the caller treats as "not available"
 * rather than an error. Returns `null` when no token or guild is configured.
 */
export async function fetchGuildMembers(guildId = process.env.DISCORD_GUILD_ID) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || !guildId) return null;

  const members = [];
  let after = "0";
  // Discord caps a page at 1000 and pages by ascending user id via `after`.
  for (let page = 0; page < 60; page += 1) {
    const res = await fetch(
      `${API_BASE}/guilds/${guildId}/members?limit=1000&after=${after}`,
      { headers: { Authorization: `Bot ${token}` } },
    );
    if (res.status === 403) {
      const err = new Error("Discord refused the member list (enable the Server Members Intent).");
      err.code = "MEMBERS_INTENT";
      throw err;
    }
    if (!res.ok) throw new Error(`Discord member list failed (${res.status})`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    members.push(...batch);
    after = batch[batch.length - 1]?.user?.id ?? after;
    if (batch.length < 1000) break;
  }
  return members.map((m) => ({
    id: String(m.user?.id ?? ""),
    username: m.user?.username ?? "",
    displayName: m.user?.global_name || m.user?.username || "Member",
    nick: m.nick ?? null,
    avatar: avatarUrl(m.user?.id, m.user?.avatar),
    roles: Array.isArray(m.roles) ? m.roles.map(String) : [],
  }));
}

/**
 * One member of one guild, read with the bot token — the single-member
 * counterpart of fetchGuildMembers, for the instant roster path where reading a
 * whole guild to update one person would be waste. Returns `null` when the
 * member is not in that guild (404) or nothing is configured.
 */
export async function fetchGuildMember(guildId, userId) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || !guildId || !userId) return null;
  const res = await fetch(`${API_BASE}/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Discord member lookup failed (${res.status})`);
  const m = await res.json();
  return {
    id: String(m.user?.id ?? userId),
    username: m.user?.username ?? "",
    displayName: m.user?.global_name || m.user?.username || "Member",
    nick: m.nick ?? null,
    roles: Array.isArray(m.roles) ? m.roles.map(String) : [],
  };
}

/**
 * Adds a Discord role to a member in a given guild, with the bot token.
 *
 * `PUT .../roles/{role}` is idempotent — adding a role the member already holds returns 204
 * all the same — so callers do not have to check membership first. Returns true on success.
 * A member who is not in the guild (404) or a role the bot cannot manage (403) resolves to
 * false rather than throwing, so one failed role never aborts a whole transfer.
 */
export async function addMemberRole(guildId, userId, roleId, reason) {
  return editMemberRole("PUT", guildId, userId, roleId, reason);
}

/** Removes a Discord role from a member in a given guild. Idempotent, same contract as add. */
export async function removeMemberRole(guildId, userId, roleId, reason) {
  return editMemberRole("DELETE", guildId, userId, roleId, reason);
}

async function editMemberRole(method, guildId, userId, roleId, reason) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || !guildId || !userId || !roleId) return false;
  const res = await fetch(
    `${API_BASE}/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    {
      method,
      headers: {
        Authorization: `Bot ${token}`,
        ...(reason ? { "X-Audit-Log-Reason": String(reason).slice(0, 480) } : {}),
      },
    },
  );
  // 204 = applied; 404 = member/role gone; 403 = bot lacks Manage Roles or is below the role.
  return res.ok;
}

/** A CDN avatar URL, or null so the UI falls back to initials. */
function avatarUrl(id, hash) {
  if (!hash) return null;
  const ext = hash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${id}/${hash}.${ext}?size=128`;
}

export default {
  oauthConfigured,
  authorizeUrl,
  exchangeCode,
  fetchIdentity,
  fetchMemberRoles,
  fetchGuildRoles,
  fetchGuildMembers,
  fetchGuildMember,
  addMemberRole,
  removeMemberRole,
};
