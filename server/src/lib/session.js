/**
 * Server-side sessions for the Discord OAuth flow.
 *
 * The cookie holds nothing but an opaque random id. Everything about the user —
 * their identity and, crucially, their roles — is read back from the database on
 * each request, so a role revoked in Discord and synced here takes effect on the
 * very next page load rather than living frozen inside a signed token until it
 * expires. Signing someone out, or revoking a leaked cookie, is a single DELETE.
 */
import { randomBytes } from "node:crypto";
import { execute, query } from "../db.js";

/** The session cookie name. Prefixed so it never collides with anything else. */
export const SESSION_COOKIE = "flrp_session";

/** Sessions live a week; a fresh sign-in is cheap and roles change often. */
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const IS_PROD = process.env.NODE_ENV === "production";

/** Reads one cookie value off the raw request header, undecoded of surprises. */
export function readCookie(req, name) {
  const header = req.headers?.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

/**
 * Mints a session for a user id and returns its token. The row carries its own
 * expiry so a sweep — or just the read path — can drop stale sessions.
 */
export async function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  await execute(
    `INSERT INTO sessions (id, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(secs => $3))`,
    [token, userId, SESSION_TTL_SECONDS],
  );
  return token;
}

/**
 * Resolves a session token to its user id, or null when it is unknown or
 * expired. Touches `last_seen_at` so an active session is visibly current.
 */
export async function readSession(token) {
  if (!token) return null;
  const rows = await query(
    `SELECT user_id AS "userId" FROM sessions WHERE id = $1 AND expires_at > now() LIMIT 1`,
    [token],
  );
  if (!rows.length) return null;
  // Best-effort; a failed touch must not deny an otherwise valid session.
  execute(`UPDATE sessions SET last_seen_at = now() WHERE id = $1`, [token]).catch(
    () => {},
  );
  return rows[0].userId;
}

/** Deletes a session — sign-out, or revoking a leaked cookie. */
export async function destroySession(token) {
  if (!token) return;
  await execute(`DELETE FROM sessions WHERE id = $1`, [token]).catch(() => {});
}

/**
 * The Set-Cookie header value for a freshly minted session.
 *
 * SameSite=Lax rather than Strict so the cookie rides the top-level redirect
 * back from Discord; HttpOnly so no script can read it; Secure in production so
 * it never crosses plain HTTP. The API and the site share an origin, so Lax is
 * enough — see the subdomain note in the README.
 */
export function sessionCookieHeader(token) {
  return cookie(SESSION_COOKIE, token, SESSION_TTL_SECONDS);
}

/** The Set-Cookie header value that clears the session cookie. */
export function clearSessionCookieHeader() {
  return cookie(SESSION_COOKIE, "", 0);
}

function cookie(name, value, maxAge) {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (IS_PROD) attrs.push("Secure");
  return attrs.join("; ");
}

export default {
  SESSION_COOKIE,
  readCookie,
  createSession,
  readSession,
  destroySession,
  sessionCookieHeader,
  clearSessionCookieHeader,
};
