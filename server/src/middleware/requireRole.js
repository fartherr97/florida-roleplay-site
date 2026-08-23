/**
 * Role authorisation. The `code` returned on failure is what the client's
 * AccessDenied page renders in its footer, so the set is deliberately small and
 * stable: AUTH_SIGNED_OUT, AUTH_ROLE_MISSING, AUTH_DEPT_MISMATCH.
 */
import { query } from "../db.js";
import { devUser, RANK_LABELS, STAFF_RANKS } from "../seed.js";

const DEV_MODE = process.env.NODE_ENV !== "production";

/**
 * Resolves the calling user and their Discord roles. Until OAuth is wired, a
 * development caller is read from DEV_USER_ID — a path that is hard-disabled in
 * production so it can never become a live authentication bypass.
 */
export async function resolveUser(req) {
  // TODO: replace with the Discord OAuth session lookup once the flow is live.

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
    const users = await query(
      "SELECT id, username, display_name AS displayName, avatar FROM users WHERE id = ? LIMIT 1",
      [devId],
    );
    if (users.length > 0) {
      const roles = await query("SELECT role FROM user_roles WHERE user_id = ?", [devId]);
      return { ...users[0], roles: roles.map((row) => row.role) };
    }
  } catch {
    // Database unavailable — fall through to the seed caller below.
  }

  // Without a database, the seeded id resolves to the seeded roles and any
  // other valid snowflake resolves to a signed-in user holding none — so both
  // the AUTH_SIGNED_OUT and AUTH_ROLE_MISSING paths stay testable.
  if (devId === devUser.id) return { ...devUser };
  if (/^\d{17,20}$/.test(devId)) {
    return {
      id: devId,
      username: "dev-user",
      displayName: "Dev User",
      avatar: null,
      roles: [],
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
 * Gate factory. `requireRole(["staff", "admin"])` passes when the caller holds
 * any of the listed roles.
 */
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
        message:
          "Your Discord account doesn't have any roles that associate you as a Staff member on this portal.",
      });
    }

    return next();
  };
}

export default requireRole;
