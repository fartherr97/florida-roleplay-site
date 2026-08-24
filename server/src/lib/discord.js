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
};
