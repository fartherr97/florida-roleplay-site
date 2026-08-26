/**
 * Role authorisation. The `code` returned on failure is what the client's
 * AccessDenied page renders in its footer, so the set is deliberately small and
 * stable: AUTH_SIGNED_OUT, AUTH_ROLE_MISSING, AUTH_DEPT_MISMATCH and
 * AUTH_NOT_WHITELISTED. Each one maps to a distinct denial page, so add a code
 * only when the copy the user should read genuinely differs.
 */
import { query } from "../db.js";
import { readCookie, readSession, SESSION_COOKIE } from "../lib/session.js";
import { maybeRefreshRoles } from "../lib/roleSync.js";
import { devUser, RANK_LABELS, STAFF_RANKS } from "../seed.js";

// The development auth affordances (x-preview-rank / x-discord-id header paths)
// are fail-CLOSED by default: they require BOTH a non-production NODE_ENV *and*
// an explicit ALLOW_DEV_AUTH=1 opt-in. That way a deployment can never enable a
// header-based auth bypass by merely forgetting to set NODE_ENV — the operator
// has to deliberately turn the dev paths on. For local development, set
// ALLOW_DEV_AUTH=1 in your .env.
const DEV_MODE =
  process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_AUTH === "1";

// Break-glass owner access. Discord IDs listed here always resolve as `ownership`, no matter
// what the role map or the live refresh says — the same idea as the bot's
// GLOBAL_ADMIN_DISCORD_IDS. Its whole purpose is that a mapping mistake or a bad refresh can
// never lock the community's owner out of the very page that fixes the mapping.
const OWNER_DISCORD_IDS = new Set(
  (process.env.SITE_OWNER_DISCORD_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

/** Guarantees `ownership` for a break-glass owner id, otherwise returns the roles unchanged. */
function withOwnerOverride(userId, roles) {
  if (OWNER_DISCORD_IDS.has(String(userId)) && !roles.includes("ownership")) {
    return [...roles, "ownership"];
  }
  return roles;
}

/**
 * The highest staff rank a set of role keys carries, as a label.
 *
 * STAFF_RANKS is ordered lowest first and each rank lists every role beneath it,
 * so the last entry whose own key is held is the one somebody actually is.
 */
const RANK_ORDER = Object.keys(STAFF_RANKS);

export function rankFor(roleKeys = []) {
  const held = new Set(roleKeys);
  for (let i = RANK_ORDER.length - 1; i >= 0; i -= 1) {
    const key = RANK_ORDER[i];
    if (held.has(key)) return RANK_LABELS[key] ?? null;
  }
  return null;
}

/**
 * Loads a user and their role keys from the database, deriving the rank label
 * from the roles. Returns null when there is no such row (or no database).
 */
async function loadDbUser(id) {
  const users = await query(
    `SELECT id, username, display_name AS "displayName", avatar FROM users WHERE id = $1 LIMIT 1`,
    [id],
  );
  if (users.length === 0) return null;
  const roles = await query("SELECT role FROM user_roles WHERE user_id = $1", [id]);
  const held = roles.map((row) => row.role);
  return { ...users[0], roles: held, rank: rankFor(held) };
}

/**
 * Resolves the calling user and their Discord roles.
 *
 * In production this is a Discord OAuth session and nothing else. In development
 * the dev-only paths below (a preview rank, an x-discord-id header, DEV_USER_ID)
 * stand in for a real sign-in, and every one of them is hard-disabled when
 * NODE_ENV=production so none can become a live authentication bypass.
 */
export async function resolveUser(req) {
  // The real path: a session cookie minted by the Discord OAuth callback. This
  // is the only path that runs in production; the roles come straight out of the
  // database, so a role revoked in Discord and synced here is gone on the next
  // request rather than frozen in a token.
  const sessionToken = readCookie(req, SESSION_COOKIE);
  if (sessionToken) {
    try {
      const userId = await readSession(sessionToken);
      if (userId) {
        // Bring the role snapshot up to date with live Discord roles first, on a
        // short interval, so a demotion in Discord revokes access here on the very
        // next request rather than only at the next sign-in. Fails safe: on any
        // trouble it leaves the existing snapshot in place.
        const refreshed = await maybeRefreshRoles(userId);
        const user = await loadDbUser(userId);
        // `authenticated` marks a real Discord session, so the client ends
        // preview mode and never treats this for a dev/seed caller.
        if (user) {
          // Only take the refreshed set when it actually carries roles — a null or empty
          // result means "no authoritative change", so the stored snapshot stands rather
          // than being replaced by nothing.
          const base = refreshed && refreshed.length ? refreshed : user.roles;
          const roles = withOwnerOverride(userId, base);
          return { ...user, roles, rank: rankFor(roles), authenticated: true };
        }
      }
    } catch {
      // Database unavailable — fall through to the dev paths (dev only).
    }
  }

  // The Staff Hub's preview switcher browses as any rank while OAuth is stubbed.
  // Honouring it here is what makes the previewed rank's data load rather than
  // 403 — and like every other dev path it is disabled outright in production.
  const previewRank = DEV_MODE ? req.get("x-preview-rank") : null;
  if (previewRank && STAFF_RANKS[previewRank]) {
    return {
      id: "preview",
      username: "preview",
      displayName: "Preview User",
      avatar: null,
      preview: true,
      rank: RANK_LABELS[previewRank],
      roles: STAFF_RANKS[previewRank],
    };
  }

  const headerId = req.get("x-discord-id");
  const devId = DEV_MODE ? headerId || process.env.DEV_USER_ID : null;
  if (!devId) return null;

  try {
    const user = await loadDbUser(devId);
    if (user) return user;
  } catch {
    // Database unavailable — fall through to the seed caller below.
  }

  // Without a database, the seeded id resolves to the seeded roles and any other
  // valid snowflake resolves to a plain member — signing in with Discord is what
  // makes someone a member, while whitelisting and staff roles are earned. That
  // keeps AUTH_SIGNED_OUT, AUTH_ROLE_MISSING and the member-only gates all
  // reachable from a header.
  if (devId === devUser.id) return { ...devUser };
  if (/^\d{17,20}$/.test(devId)) {
    return {
      id: devId,
      username: "dev-user",
      displayName: "Dev User",
      avatar: null,
      rank: "Member",
      roles: ["member"],
    };
  }
  return null;
}

/** Attaches `req.user` (possibly null) without gating the request. */
export async function attachUser(req, _res, next) {
  try {
    req.user = await resolveUser(req);
  } catch {
    req.user = null;
  }
  next();
}

/**
 * Gate factory. `requireRole(["admin", "head_admin"])` passes when the caller holds
 * any of the listed roles.
 */
const MESSAGES = {
  AUTH_ROLE_MISSING:
    "Your Discord account doesn't have any roles that associate you as a Staff member on this portal.",
  AUTH_DEPT_MISMATCH:
    "Your Discord roles don't place you in the department that owns this page.",
  AUTH_NOT_WHITELISTED:
    "Your Discord account isn't whitelisted yet, so there's no character record for this page to show.",
};

export function requireRole(roles = [], { code = "AUTH_ROLE_MISSING" } = {}) {
  return async (req, res, next) => {
    const user = req.user ?? (await resolveUser(req));
    req.user = user;

    if (!user) {
      return res.status(403).json({
        ok: false,
        code: "AUTH_SIGNED_OUT",
        message: "Sign in with Discord to open this page.",
      });
    }

    const held = user.roles ?? [];
    if (roles.length > 0 && !roles.some((role) => held.includes(role))) {
      return res.status(403).json({
        ok: false,
        code,
        message: MESSAGES[code] ?? MESSAGES.AUTH_ROLE_MISSING,
      });
    }

    return next();
  };
}

export default requireRole;
