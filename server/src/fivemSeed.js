/**
 * FiveM config seed — the default in-game FLRP config the FiveM server pulls.
 *
 * This is the source-of-truth shape for `GET /api/fivem/config`. Following the
 * site's seed-fallback pattern, the endpoint serves this shape when the
 * `fivem_*` tables are empty or the database is unavailable, so the FiveM
 * server always gets a valid config even before anyone edits it here.
 *
 * The shape mirrors what the FiveM `flrp_api` sync consumer applies (see the
 * flrp-server repo, docs/LIVE_CONFIG_SYNC.md): roles, permissions,
 * role_permissions (the matrix), pay_rates, weapons, vehicles. Discord→group
 * mapping is NOT here — that lives in pCore on the FiveM side.
 *
 * Defaults mirror flrp-server migrations 008 (roles/permissions/matrix/pay/dev
 * weapons) and 009 (real imported BSO/FHP vehicles). Keep the two in sync.
 */

/* ---- Roles (FLRP groups) ------------------------------------------------- */
export const ROLES = [
  { key: "member", name: "Community Member", kind: "base", priority: 0, is_department: false, inherits: null },
  { key: "moderator", name: "Moderator", kind: "staff", priority: 10, is_department: false, inherits: "member" },
  { key: "administrator", name: "Administrator", kind: "staff", priority: 20, is_department: false, inherits: "moderator" },
  { key: "director", name: "Director", kind: "staff", priority: 30, is_department: false, inherits: "administrator" },
  { key: "ownership", name: "Ownership", kind: "staff", priority: 40, is_department: false, inherits: "director" },
  { key: "cert_civ_1", name: "Certified Civilian I", kind: "certification", priority: 5, is_department: false, inherits: null },
  { key: "cert_civ_2", name: "Certified Civilian II", kind: "certification", priority: 6, is_department: false, inherits: null },
  { key: "cert_civ_3", name: "Certified Civilian III", kind: "certification", priority: 7, is_department: false, inherits: null },
  { key: "bso", name: "BSO", kind: "department", priority: 15, is_department: true, inherits: null },
  { key: "fhp", name: "FHP", kind: "department", priority: 15, is_department: true, inherits: null },
  { key: "mpd", name: "MPD", kind: "department", priority: 15, is_department: true, inherits: null },
];

/* ---- Permissions --------------------------------------------------------- */
export const PERMISSIONS = [
  { key: "weapon.vmenu.spawn", description: "Spawn weapons directly via vMenu", category: "weapon", default_effect: "deny" },
  { key: "weapon.gunstore.purchase", description: "Purchase weapons at gun stores", category: "weapon", default_effect: "deny" },
  { key: "vehicle.bso.patrol", description: "Spawn BSO patrol vehicles", category: "vehicle", default_effect: "deny" },
  { key: "vehicle.bso.supervisor", description: "Spawn BSO supervisor vehicles", category: "vehicle", default_effect: "deny" },
  { key: "vehicle.bso.command", description: "Spawn BSO command vehicles", category: "vehicle", default_effect: "deny" },
  { key: "vehicle.fhp.patrol", description: "Spawn FHP patrol vehicles", category: "vehicle", default_effect: "deny" },
  { key: "vehicle.fhp.supervisor", description: "Spawn FHP supervisor vehicles", category: "vehicle", default_effect: "deny" },
  { key: "vehicle.fhp.command", description: "Spawn FHP command vehicles", category: "vehicle", default_effect: "deny" },
  { key: "vehicle.mpd.patrol", description: "Spawn MPD patrol vehicles", category: "vehicle", default_effect: "deny" },
  { key: "vehicle.mpd.supervisor", description: "Spawn MPD supervisor vehicles", category: "vehicle", default_effect: "deny" },
  { key: "vehicle.mpd.command", description: "Spawn MPD command vehicles", category: "vehicle", default_effect: "deny" },
  { key: "vehicle.civilian.cert1", description: "Spawn Cert Civ I vehicles", category: "vehicle", default_effect: "deny" },
  { key: "vehicle.civilian.cert2", description: "Spawn Cert Civ II vehicles", category: "vehicle", default_effect: "deny" },
  { key: "vehicle.civilian.cert3", description: "Spawn Cert Civ III vehicles", category: "vehicle", default_effect: "deny" },
  { key: "staff.noclip", description: "Use staff noclip", category: "staff", default_effect: "deny" },
  { key: "staff.manage.players", description: "Manage online players", category: "staff", default_effect: "deny" },
  { key: "economy.manage", description: "Manage economy settings + balances", category: "economy", default_effect: "deny" },
  { key: "permissions.manage", description: "Manage roles/permissions", category: "staff", default_effect: "deny" },
  { key: "vehicles.manage", description: "Manage vehicle registry", category: "staff", default_effect: "deny" },
  { key: "weapons.manage", description: "Manage weapon registry", category: "staff", default_effect: "deny" },
];

/* ---- Role → permission matrix (grant at the LOWEST role; FiveM applies
 *      inheritance, so director ⇒ ownership, moderator ⇒ up the chain) ------ */
export const ROLE_PERMISSIONS = [
  // weapon vMenu spawn: director (⇒ ownership) + cert_civ_3
  { role_key: "director", permission_key: "weapon.vmenu.spawn", effect: "allow" },
  { role_key: "cert_civ_3", permission_key: "weapon.vmenu.spawn", effect: "allow" },
  // gun store purchase: everyone (member)
  { role_key: "member", permission_key: "weapon.gunstore.purchase", effect: "allow" },
  // department patrol vehicles
  { role_key: "bso", permission_key: "vehicle.bso.patrol", effect: "allow" },
  { role_key: "fhp", permission_key: "vehicle.fhp.patrol", effect: "allow" },
  { role_key: "mpd", permission_key: "vehicle.mpd.patrol", effect: "allow" },
  // civilian cert vehicles (cascading)
  { role_key: "cert_civ_1", permission_key: "vehicle.civilian.cert1", effect: "allow" },
  { role_key: "cert_civ_2", permission_key: "vehicle.civilian.cert1", effect: "allow" },
  { role_key: "cert_civ_2", permission_key: "vehicle.civilian.cert2", effect: "allow" },
  { role_key: "cert_civ_3", permission_key: "vehicle.civilian.cert1", effect: "allow" },
  { role_key: "cert_civ_3", permission_key: "vehicle.civilian.cert2", effect: "allow" },
  { role_key: "cert_civ_3", permission_key: "vehicle.civilian.cert3", effect: "allow" },
  // director (⇒ ownership) manages all vehicle categories
  ...["vehicle.bso.patrol", "vehicle.bso.supervisor", "vehicle.bso.command",
      "vehicle.fhp.patrol", "vehicle.fhp.supervisor", "vehicle.fhp.command",
      "vehicle.mpd.patrol", "vehicle.mpd.supervisor", "vehicle.mpd.command",
      "vehicle.civilian.cert1", "vehicle.civilian.cert2", "vehicle.civilian.cert3"]
      .map((k) => ({ role_key: "director", permission_key: k, effect: "allow" })),
  // staff
  { role_key: "moderator", permission_key: "staff.noclip", effect: "allow" },
  { role_key: "moderator", permission_key: "staff.manage.players", effect: "allow" },
  { role_key: "director", permission_key: "economy.manage", effect: "allow" },
  { role_key: "director", permission_key: "permissions.manage", effect: "allow" },
  { role_key: "director", permission_key: "vehicles.manage", effect: "allow" },
  { role_key: "director", permission_key: "weapons.manage", effect: "allow" },
];

/* ---- Pay rates (DEV DEFAULTS — cents/hour — subject to change) ------------ */
export const PAY_RATES = [
  { role_key: "member", hourly_cents: 5000, enabled: true },
  { role_key: "cert_civ_1", hourly_cents: 7500, enabled: true },
  { role_key: "cert_civ_2", hourly_cents: 10000, enabled: true },
  { role_key: "cert_civ_3", hourly_cents: 12500, enabled: true },
  { role_key: "bso", hourly_cents: 15000, enabled: true },
  { role_key: "fhp", hourly_cents: 15000, enabled: true },
  { role_key: "mpd", hourly_cents: 15000, enabled: true },
];

/* ---- Weapons (DEV/TEST — replace with the real catalog) ------------------- */
export const WEAPONS = [
  { weapon_name: "WEAPON_PISTOL", display_name: "[DEV] Pistol", enabled: true, gunstore_available: true, price_cents: 25000, cert_required: null, required_permission: null, vmenu_spawnable: true, notes: "DEV/TEST — remove before production" },
  { weapon_name: "WEAPON_KNIFE", display_name: "[DEV] Knife", enabled: true, gunstore_available: true, price_cents: 1000, cert_required: null, required_permission: null, vmenu_spawnable: true, notes: "DEV/TEST — remove before production" },
  { weapon_name: "WEAPON_CARBINERIFLE", display_name: "[DEV] Carbine", enabled: true, gunstore_available: true, price_cents: 150000, cert_required: "cert_civ_2", required_permission: null, vmenu_spawnable: true, notes: "DEV/TEST — cert-gated example" },
];

/* ---- Vehicles (real imported BSO/FHP spawns; MPD none yet) --------------- */
function veh(spawn, dept, label) {
  return { spawn_name: spawn, display_name: label, resource: null, department: dept,
    category: "Patrol", min_rank: null, certification: null,
    required_permission: `vehicle.${dept.toLowerCase()}.patrol`, enabled: true, notes: "Imported livery" };
}
export const VEHICLES = [
  ...["a", "b", "c", "d", "e", "f", "g", "h"].map((s) => veh(`hcso1${s}`, "BSO", `BSO Unit (hcso1${s})`)),
  ..."abcdefghijkl".split("").map((s) => veh(`hp1${s}`, "FHP", `FHP Charger (hp1${s})`)),
  ..."abcdefghijklmnop".split("").map((s) => veh(`hp2${s}`, "FHP", `FHP Pursuit SUV (hp2${s})`)),
];

/** The full default config in the wire shape the FiveM server consumes. */
export function fivemConfigSeed(scope = "all") {
  const all = {
    roles: ROLES,
    permissions: PERMISSIONS,
    role_permissions: ROLE_PERMISSIONS,
    pay_rates: PAY_RATES,
    weapons: WEAPONS,
    vehicles: VEHICLES,
  };
  if (scope === "all") return all;
  const map = {
    permissions: { roles: ROLES, permissions: PERMISSIONS, role_permissions: ROLE_PERMISSIONS },
    payrates: { pay_rates: PAY_RATES },
    weapons: { weapons: WEAPONS },
    vehicles: { vehicles: VEHICLES },
  };
  return map[scope] || all;
}
