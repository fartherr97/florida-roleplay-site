/**
 * The /api/fivem router — the in-game config the FiveM server runs on.
 *
 * Two audiences:
 *   - The FiveM server (a machine) pulls `GET /config` with a shared secret and
 *     applies it live. It also receives a push: on every edit here we POST the
 *     FiveM server's `flrp_api` sync webhook so the change goes live with no
 *     restart. See the flrp-server repo, docs/LIVE_CONFIG_SYNC.md.
 *   - Staff edit groups/permissions/pay/weapons/vehicles through the gated
 *     endpoints (permission `fivem.manage`); reads for the editor need `fivem.view`.
 *
 * Reads follow the site's seed-fallback pattern: an empty table (or no database)
 * serves the defaults in fivemSeed.js, so the FiveM server always gets a valid
 * config.
 */
import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { query, execute } from "../db.js";
import { fivemConfigSeed } from "../fivemSeed.js";
import { attachUser } from "../middleware/requireRole.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = Router();

/* ------------------------------------------------------------------ *
 * Machine auth: the FiveM server presents X-FLRP-Secret == FIVEM_CONFIG_SECRET
 * ------------------------------------------------------------------ */
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function requireFivemSecret(req, res, next) {
  const expected = process.env.FIVEM_CONFIG_SECRET;
  if (!expected) {
    return res.status(503).json({ ok: false, code: "FIVEM_CONFIG_SECRET_UNSET",
      message: "FiveM config sync is disabled: FIVEM_CONFIG_SECRET is not set." });
  }
  const presented = req.get("x-flrp-secret") || "";
  if (!presented || !safeEqual(presented, expected)) {
    return res.status(401).json({ ok: false, code: "FIVEM_UNAUTHORISED",
      message: "A valid FiveM sync secret is required." });
  }
  return next();
}

/* ------------------------------------------------------------------ *
 * Notify the FiveM server that config changed (fire-and-forget).
 * The FiveM server pulls the fresh scope and re-applies to online players.
 * ------------------------------------------------------------------ */
async function notifyFxserver(scope) {
  const base = process.env.FXSERVER_SYNC_URL;
  const secret = process.env.FXSERVER_SYNC_SECRET;
  if (!base || !secret) return; // sync not wired yet — reads still work
  const url = `${base.replace(/\/+$/, "")}/sync`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-FLRP-Secret": secret },
      body: JSON.stringify({ scope }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    // The background reconcile on the FiveM side will pick the change up anyway.
    console.warn(`[fivem] FXServer notify failed (${scope}): ${err.message}`);
  }
}

/* ------------------------------------------------------------------ *
 * Load a config scope from the DB, falling back to the seed per-slice.
 * ------------------------------------------------------------------ */
async function loadFromDb(scope) {
  const seed = fivemConfigSeed(scope);
  const out = {};

  async function slice(key, sql, mapRow) {
    if (!(key in seed)) return;
    try {
      const rows = await query(sql);
      out[key] = rows && rows.length ? rows.map(mapRow) : seed[key];
    } catch {
      out[key] = seed[key]; // no database — seed stands
    }
  }

  await slice("roles",
    "SELECT key, name, kind, priority, is_department, inherits_key FROM fivem_roles WHERE enabled = true ORDER BY priority",
    (r) => ({ key: r.key, name: r.name, kind: r.kind, priority: r.priority,
      is_department: r.is_department, inherits: r.inherits_key }));
  await slice("permissions",
    "SELECT key, description, category, default_effect FROM fivem_permissions",
    (r) => ({ key: r.key, description: r.description, category: r.category, default_effect: r.default_effect }));
  await slice("role_permissions",
    "SELECT role_key, permission_key, effect FROM fivem_role_permissions",
    (r) => ({ role_key: r.role_key, permission_key: r.permission_key, effect: r.effect }));
  await slice("pay_rates",
    "SELECT role_key, hourly_cents, enabled FROM fivem_pay_rates",
    (r) => ({ role_key: r.role_key, hourly_cents: Number(r.hourly_cents), enabled: r.enabled }));
  await slice("weapons",
    "SELECT weapon_name, display_name, enabled, gunstore_available, price_cents, cert_required, required_permission, vmenu_spawnable, notes FROM fivem_weapons",
    (r) => ({ weapon_name: r.weapon_name, display_name: r.display_name, enabled: r.enabled,
      gunstore_available: r.gunstore_available, price_cents: Number(r.price_cents),
      cert_required: r.cert_required, required_permission: r.required_permission,
      vmenu_spawnable: r.vmenu_spawnable, notes: r.notes }));
  await slice("vehicles",
    "SELECT spawn_name, display_name, resource, department, category, min_rank, certification, required_permission, enabled, notes FROM fivem_vehicles",
    (r) => ({ spawn_name: r.spawn_name, display_name: r.display_name, resource: r.resource,
      department: r.department, category: r.category, min_rank: r.min_rank,
      certification: r.certification, required_permission: r.required_permission,
      enabled: r.enabled, notes: r.notes }));

  return out;
}

const VALID_SCOPES = new Set(["all", "permissions", "payrates", "weapons", "vehicles"]);

/* ---- Machine: FiveM server pulls the live config ------------------------- */
router.get("/config", requireFivemSecret, async (req, res) => {
  const scope = VALID_SCOPES.has(req.query.scope) ? req.query.scope : "all";
  res.json(await loadFromDb(scope));
});

/* ---- Editor read (staff UI) --------------------------------------------- */
router.get("/catalogue", attachUser, requirePermission("fivem.view"), async (_req, res) => {
  res.json(await loadFromDb("all"));
});

/* ---- Edits (staff): each writes then pushes the change live -------------- */
const effectOk = (e) => e === "allow" || e === "deny" || e === "inherit";

// Set/clear a role's effect for a permission. effect 'inherit' removes the row.
router.put("/group-permission", attachUser, requirePermission("fivem.manage"), async (req, res) => {
  const { roleKey, permissionKey, effect } = req.body || {};
  if (typeof roleKey !== "string" || typeof permissionKey !== "string" || !effectOk(effect)) {
    return res.status(400).json({ ok: false, code: "BAD_INPUT" });
  }
  if (effect === "inherit") {
    await execute("DELETE FROM fivem_role_permissions WHERE role_key = $1 AND permission_key = $2",
      [roleKey, permissionKey]);
  } else {
    await execute(
      `INSERT INTO fivem_role_permissions (role_key, permission_key, effect) VALUES ($1, $2, $3)
       ON CONFLICT (role_key, permission_key) DO UPDATE SET effect = EXCLUDED.effect, updated_at = now()`,
      [roleKey, permissionKey, effect]);
  }
  await notifyFxserver("permissions");
  res.json({ ok: true });
});

router.put("/pay-rate", attachUser, requirePermission("fivem.manage"), async (req, res) => {
  const { roleKey, hourlyCents, enabled } = req.body || {};
  const cents = Math.floor(Number(hourlyCents));
  if (typeof roleKey !== "string" || !Number.isFinite(cents) || cents < 0 || cents > 100000000) {
    return res.status(400).json({ ok: false, code: "BAD_INPUT" });
  }
  await execute(
    `INSERT INTO fivem_pay_rates (role_key, hourly_cents, enabled) VALUES ($1, $2, $3)
     ON CONFLICT (role_key) DO UPDATE SET hourly_cents = EXCLUDED.hourly_cents, enabled = EXCLUDED.enabled, updated_at = now()`,
    [roleKey, cents, enabled !== false]);
  await notifyFxserver("payrates");
  res.json({ ok: true });
});

router.put("/weapon", attachUser, requirePermission("fivem.manage"), async (req, res) => {
  const w = req.body || {};
  if (typeof w.weaponName !== "string" || typeof w.displayName !== "string") {
    return res.status(400).json({ ok: false, code: "BAD_INPUT" });
  }
  await execute(
    `INSERT INTO fivem_weapons (weapon_name, display_name, enabled, gunstore_available, price_cents, cert_required, required_permission, vmenu_spawnable, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (weapon_name) DO UPDATE SET display_name = EXCLUDED.display_name,
       enabled = EXCLUDED.enabled, gunstore_available = EXCLUDED.gunstore_available,
       price_cents = EXCLUDED.price_cents, cert_required = EXCLUDED.cert_required,
       required_permission = EXCLUDED.required_permission, vmenu_spawnable = EXCLUDED.vmenu_spawnable,
       notes = EXCLUDED.notes, updated_at = now()`,
    [String(w.weaponName).toUpperCase(), w.displayName, w.enabled !== false,
     !!w.gunstoreAvailable, Math.floor(Number(w.priceCents) || 0), w.certRequired || null,
     w.requiredPermission || null, !!w.vmenuSpawnable, w.notes || null]);
  await notifyFxserver("weapons");
  res.json({ ok: true });
});

router.put("/vehicle", attachUser, requirePermission("fivem.manage"), async (req, res) => {
  const v = req.body || {};
  if (typeof v.spawnName !== "string" || typeof v.displayName !== "string") {
    return res.status(400).json({ ok: false, code: "BAD_INPUT" });
  }
  await execute(
    `INSERT INTO fivem_vehicles (spawn_name, display_name, resource, department, category, min_rank, certification, required_permission, enabled, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (spawn_name) DO UPDATE SET display_name = EXCLUDED.display_name,
       resource = EXCLUDED.resource, department = EXCLUDED.department, category = EXCLUDED.category,
       min_rank = EXCLUDED.min_rank, certification = EXCLUDED.certification,
       required_permission = EXCLUDED.required_permission, enabled = EXCLUDED.enabled,
       notes = EXCLUDED.notes, updated_at = now()`,
    [String(v.spawnName).toLowerCase(), v.displayName, v.resource || null, v.department || null,
     v.category || null, v.minRank || null, v.certification || null,
     v.requiredPermission || null, v.enabled !== false, v.notes || null]);
  await notifyFxserver("vehicles");
  res.json({ ok: true });
});

// Manual re-push of everything (e.g. after a bulk import) — no data change.
router.post("/resync", attachUser, requirePermission("fivem.manage"), async (_req, res) => {
  await notifyFxserver("all");
  res.json({ ok: true });
});

export default router;
