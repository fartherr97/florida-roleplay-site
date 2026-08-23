/**
 * Permission authorisation.
 *
 * Endpoints name a permission; the stored grants decide which Discord roles
 * satisfy it. That indirection is what lets the configuration page change access
 * without a deploy — and why nothing here checks a rank directly.
 *
 * Grants live in the `permission_grants` table when a database is configured and
 * fall back to DEFAULT_GRANTS otherwise, so a fresh install is never wide open
 * and never locked out.
 */
import { query } from "../db.js";
import { DEFAULT_GRANTS, PERMISSIONS } from "../permissions.js";
import { resolveUser } from "./requireRole.js";

/** Cached briefly: every gated request reads these, and they change rarely. */
let cache = { at: 0, grants: null };
const CACHE_MS = 5000;

export function invalidateGrantCache() {
  cache = { at: 0, grants: null };
}

export async function loadGrants() {
  if (cache.grants && Date.now() - cache.at < CACHE_MS) return cache.grants;

  let grants = DEFAULT_GRANTS;
  try {
    const rows = await query(
      "SELECT permission_key, role_key FROM permission_grants",
    );
    if (rows.length) {
      const next = {};
      rows.forEach((row) => {
        (next[row.permission_key] ??= []).push(row.role_key);
      });
      grants = next;
    }
  } catch {
    // No database — the defaults stand.
  }

  cache = { at: Date.now(), grants };
  return grants;
}

/**
 * Gate factory. `requirePermission("roster.edit_status")` passes when one of the
 * caller's Discord roles is granted that permission.
 */
export function requirePermission(permission, { code = "AUTH_ROLE_MISSING" } = {}) {
  if (!PERMISSIONS[permission]) {
    throw new Error(`Unknown permission: ${permission}`);
  }

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

    const grants = await loadGrants();
    const allowed = grants[permission] ?? [];
    const held = new Set(user.roles ?? []);

    if (!allowed.some((role) => held.has(role))) {
      return res.status(403).json({
        ok: false,
        code,
        permission,
        message: MESSAGES[code] ?? MESSAGES.AUTH_ROLE_MISSING,
      });
    }

    return next();
  };
}

const MESSAGES = {
  AUTH_ROLE_MISSING:
    "Your Discord account doesn't have any roles that associate you as a Staff member on this portal.",
  AUTH_DEPT_MISMATCH:
    "Your Discord roles don't place you in the department that owns this page.",
  AUTH_NOT_WHITELISTED:
    "Your Discord account isn't whitelisted yet, so there's no character record for this page to show.",
};

export default requirePermission;
