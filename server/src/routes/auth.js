/**
 * Discord OAuth — the whole sign-in handshake.
 *
 *   GET  /api/auth/login    → redirect the browser to Discord's consent screen
 *   GET  /api/auth/callback → Discord returns here; exchange, verify, seat a session
 *   POST /api/auth/logout   → drop the session and clear the cookie
 *   GET  /api/auth/config   → whether OAuth is wired, so the UI shows the right button
 *
 * Roles are the point of the whole exercise. After Discord confirms who the user
 * is, the bot token reads which roles they hold in the guild, and those role IDs
 * are mapped to this site's role keys through the same `roster_role_map` the bot
 * and the role-mapping page use. Nothing the browser sends decides access.
 */
import { randomBytes } from "node:crypto";
import { Router } from "express";
import { execute } from "../db.js";
import {
  authorizeUrl,
  exchangeCode,
  fetchIdentity,
  fetchMemberRoles,
  oauthConfigured,
} from "../lib/discord.js";
import {
  clearSessionCookieHeader,
  createSession,
  destroySession,
  readCookie,
  SESSION_COOKIE,
  sessionCookieHeader,
} from "../lib/session.js";
import { resolveRoleKeys, writeUserRoles } from "../lib/roleSync.js";

const router = Router();

const IS_PROD = process.env.NODE_ENV === "production";
const STATE_COOKIE = "flrp_oauth_state";
const RETURN_COOKIE = "flrp_oauth_return";

/** A short-lived cookie carrying the CSRF state (and return path) across the hop. */
function crumbCookie(name, value, maxAge) {
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

/**
 * Only ever return to a path on this site. An open redirect here would let a
 * crafted login link bounce a freshly-authenticated member off to anywhere, so
 * anything that is not a plain in-site path is discarded for the home page.
 */
function safeReturn(value) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

/** GET /api/auth/config — lets the sign-in page show a live vs. stubbed button. */
router.get("/config", (_req, res) => {
  res.json({ configured: oauthConfigured() });
});

/** GET /api/auth/login — kick off the handshake. */
router.get("/login", (req, res) => {
  if (!oauthConfigured()) {
    return res
      .status(503)
      .type("html")
      .send(
        page(
          "Sign-in isn't configured yet",
          "Discord OAuth has not been set up on this server. Once the Discord " +
            "application credentials are in place, this button will sign you in.",
        ),
      );
  }

  const state = randomBytes(16).toString("hex");
  const returnTo = safeReturn(req.query.returnTo);

  res.setHeader("Set-Cookie", [
    crumbCookie(STATE_COOKIE, state, 600),
    crumbCookie(RETURN_COOKIE, returnTo, 600),
  ]);
  return res.redirect(authorizeUrl(state));
});

/** GET /api/auth/callback — Discord hands the browser back to us here. */
router.get("/callback", async (req, res) => {
  if (!oauthConfigured()) {
    return res.redirect("/sign-in?error=unconfigured");
  }

  const { code, state, error } = req.query;
  const expectedState = readCookie(req, STATE_COOKIE);
  const returnTo = safeReturn(readCookie(req, RETURN_COOKIE));

  // Clear the crumb cookies whatever happens next.
  const clearCrumbs = [crumbCookie(STATE_COOKIE, "", 0), crumbCookie(RETURN_COOKIE, "", 0)];

  // The user declined on Discord's screen, or the state failed to round-trip.
  if (error) {
    res.setHeader("Set-Cookie", clearCrumbs);
    return res.redirect("/sign-in?error=denied");
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    res.setHeader("Set-Cookie", clearCrumbs);
    return res.redirect("/sign-in?error=state");
  }

  try {
    const token = await exchangeCode(String(code));
    const identity = await fetchIdentity(token.access_token);
    const membership = await fetchMemberRoles(identity.id);

    // Not in the guild at all — the one outcome that is the user's to fix.
    if (membership === null) {
      res.setHeader("Set-Cookie", clearCrumbs);
      return res.redirect("/sign-in?error=not_in_guild");
    }

    const roleKeys = await resolveRoleKeys(membership.roles);
    await upsertUser(identity, roleKeys);
    const session = await createSession(identity.id);

    res.setHeader("Set-Cookie", [...clearCrumbs, sessionCookieHeader(session)]);
    return res.redirect(returnTo);
  } catch (err) {
    console.error(`[auth] callback failed: ${err.message}`);
    res.setHeader("Set-Cookie", clearCrumbs);
    return res.redirect("/sign-in?error=failed");
  }
});

/** POST /api/auth/logout — end the session. */
router.post("/logout", async (req, res) => {
  const token = readCookie(req, SESSION_COOKIE);
  await destroySession(token);
  res.setHeader("Set-Cookie", clearSessionCookieHeader());
  res.json({ ok: true });
});

/**
 * Writes the user and their current role set. Role mapping and the wholesale role
 * rewrite live in lib/roleSync.js, which is also what the per-request live refresh
 * uses, so sign-in and refresh can never disagree on how a rank is rostered.
 */
async function upsertUser(identity, roleKeys) {
  await execute(
    `INSERT INTO users (id, username, display_name, avatar, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (id) DO UPDATE SET
       username     = EXCLUDED.username,
       display_name = EXCLUDED.display_name,
       avatar       = EXCLUDED.avatar,
       updated_at   = now()`,
    [identity.id, identity.username, identity.displayName, identity.avatar],
  );

  await writeUserRoles(identity.id, roleKeys);
}

/** A tiny standalone HTML page for the unconfigured-login case. */
function page(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0e1a;color:#e2e8f0;font:16px/1.6 system-ui,sans-serif}main{max-width:28rem;padding:2rem;text-align:center}h1{font-size:1.4rem;margin:0 0 .75rem}p{color:#94a3b8}a{color:#f2800d;font-weight:600}</style></head><body><main><h1>${title}</h1><p>${body}</p><p><a href="/">Back to the site</a></p></main></body></html>`;
}

export default router;
