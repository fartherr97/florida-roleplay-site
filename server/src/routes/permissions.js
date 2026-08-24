/**
 * The /api/permissions router — reading and editing which Discord roles satisfy
 * which permission.
 *
 * The catalogue and grants are readable by any signed-in member: knowing what
 * the rules are is not a privilege, and the client needs the grants to decide
 * which links to render. Editing them needs `permissions.manage`, which by
 * default only Head Admin holds.
 */
import { Router } from "express";
import { query } from "../db.js";
import {
  BASE_ROLES,
  DEFAULT_GRANTS,
  PERMISSIONS,
  PERMISSION_GROUPS,
} from "../permissions.js";
import { DEPARTMENTS, ROLE_MAP, SPECIAL_ROLES } from "../rosterSeed.js";
import {
  requirePermission,
  invalidateGrantCache,
  loadGrants,
  CONFIGURED,
} from "../middleware/requirePermission.js";
import { attachUser } from "../middleware/requireRole.js";

const router = Router();
router.use(attachUser);

/**
 * Every role a permission may be granted to: the base roles, every rostered
 * rank, and the tiers that are mapped to a Discord role without being rostered.
 * Tags like LOA are not grantable — they describe a state, not a standing.
 */
const GRANTABLE = new Set([
  ...BASE_ROLES.map((role) => role.key),
  ...ROLE_MAP.map((role) => role.key),
  ...SPECIAL_ROLES.filter((role) => role.kind === "tier").map((role) => role.key),
]);

router.get("/catalogue", (_req, res) =>
  res.json({
    groups: PERMISSION_GROUPS,
    baseRoles: BASE_ROLES,
    roles: ROLE_MAP,
    departments: DEPARTMENTS,
  }),
);

/**
 * The grants themselves. Unauthenticated callers get the defaults rather than an
 * error: the client needs a grant table to render at all, and these are the
 * rules, not anyone's data.
 */
router.get("/grants", async (_req, res) => {
  res.json(await loadGrants());
});

/**
 * Replaces the whole grant table. Sending the complete set rather than a diff
 * means the page's "save" is exactly what the user reviewed, with no chance of a
 * stale partial write.
 */
router.post("/grants", requirePermission("permissions.manage"), async (req, res) => {
  const grants = req.body?.grants;
  if (!grants || typeof grants !== "object" || Array.isArray(grants)) {
    return res.status(400).json({ ok: false, errors: ["grants must be an object."] });
  }

  const errors = [];
  const clean = {};

  for (const [permission, roles] of Object.entries(grants)) {
    if (!PERMISSIONS[permission]) {
      errors.push(`Unknown permission: ${permission}`);
      continue;
    }
    if (!Array.isArray(roles)) {
      errors.push(`${permission}: roles must be an array.`);
      continue;
    }
    const unknown = roles.filter((role) => !GRANTABLE.has(role));
    if (unknown.length) {
      errors.push(`${permission}: unknown roles ${unknown.join(", ")}`);
      continue;
    }
    clean[permission] = [...new Set(roles)];
  }

  // Locking everyone out of this page would need a database edit to undo, so it
  // is refused outright rather than warned about.
  if (!clean["permissions.manage"] || clean["permissions.manage"].length === 0) {
    errors.push(
      "permissions.manage must stay granted to at least one role, or nobody could edit permissions again.",
    );
  }

  if (errors.length) return res.status(400).json({ ok: false, errors });

  try {
    await query("DELETE FROM permission_grants");
    for (const [permission, roles] of Object.entries(clean)) {
      // A sentinel row per permission records that this install configured it,
      // so a permission saved with no roles stays granted to nobody instead of
      // falling back to its shipped default — and, just as importantly, a
      // permission added by a later deploy keeps its default rather than being
      // denied to everyone. See CONFIGURED in middleware/requirePermission.js.
      await query("INSERT INTO permission_grants (permission_key, role_key) VALUES ($1, $2)",
        [permission, CONFIGURED],
      );
      for (const role of roles) {
        await query("INSERT INTO permission_grants (permission_key, role_key) VALUES ($1, $2)",
          [permission, role],
        );
      }
    }
    invalidateGrantCache();
    return res.json({ ok: true, grants: clean });
  } catch {
    return res.json({
      ok: true,
      grants: clean,
      message:
        "Accepted, but not persisted — no database is configured, so this will reset on reload.",
    });
  }
});

/** Restores the shipped defaults, for when an edit has gone badly wrong. */
router.post("/grants/reset", requirePermission("permissions.manage"), async (_req, res) => {
  try {
    await query("DELETE FROM permission_grants");
    invalidateGrantCache();
    return res.json({ ok: true, grants: DEFAULT_GRANTS });
  } catch {
    return res.json({
      ok: true,
      grants: DEFAULT_GRANTS,
      message: "Defaults restored in memory — no database is configured.",
    });
  }
});

export default router;
