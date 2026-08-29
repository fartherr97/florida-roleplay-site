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
 *
 * The rank and tier keys are read from the *live* role map, not the seed, so a
 * Discord role imported on the Access page (keys like `g_<id>`) or any rank
 * added through the role-mapping editor is grantable the moment it is saved.
 * The seed is only the fallback for an install with no database. Base roles are
 * always included because they are structural, not part of the editable map.
 */
async function grantableRoles() {
  // The canonical role universe the catalogue itself uses — always valid, whether
  // or not the live role map has been populated. Without this, a default grant to a
  // department rank (DEFAULT_GRANTS spreads DEPARTMENT_ROLES) would validate as an
  // "unknown role" on any install whose role map does not happen to list that rank,
  // and — because the page saves the whole grant table at once — that one stale
  // entry would block every save. So the seed set is the floor, and the live role
  // map only ever ADDS to it.
  const keys = new Set(BASE_ROLES.map((role) => role.key));
  for (const roles of Object.values(DEFAULT_GRANTS)) {
    for (const key of roles) keys.add(key);
  }
  for (const role of ROLE_MAP) keys.add(role.key);
  for (const role of SPECIAL_ROLES) {
    if (role.kind === "tier") keys.add(role.key);
  }

  try {
    const rows = await query("SELECT role_key, kind FROM roster_role_map");
    // Ranks are grantable; among the non-rank rows only tiers are (tags like LOA
    // describe a state, not a standing). A Discord role imported on the Access page
    // (keys like `g_<id>`) arrives here as a rank/tier and becomes grantable at once.
    for (const row of rows) {
      if (row.kind === "rank" || row.kind === "tier") keys.add(row.role_key);
    }
  } catch {
    // No database configured — the seeded universe above stands.
  }
  return keys;
}

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
  const grantable = await grantableRoles();

  for (const [permission, roles] of Object.entries(grants)) {
    if (!PERMISSIONS[permission]) {
      errors.push(`Unknown permission: ${permission}`);
      continue;
    }
    if (!Array.isArray(roles)) {
      errors.push(`${permission}: roles must be an array.`);
      continue;
    }
    const unknown = roles.filter((role) => !grantable.has(role));
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
