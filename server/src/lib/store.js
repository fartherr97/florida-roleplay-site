/**
 * The store's data layer: the FLRP mirror of Tebex packages, the entitlements a
 * package grants, recorded purchases, and the fulfillment ledger that grants and
 * revokes those entitlements idempotently.
 *
 * Tebex owns commerce; this owns *presentation and entitlement*. A package here
 * is a thin FLRP-side record keyed by its Tebex package id — how it looks on our
 * store and what buying it grants. Prices and payment status are only ever a
 * synced copy of what Tebex reports.
 *
 * Every table is self-creating, the same pattern the newer features use: an
 * older database that never ran a store migration gets the tables on first use,
 * so nothing here needs a manual schema step to work in production.
 *
 * Fulfillment is idempotent by construction. Each (purchase, entitlement,
 * action) is a unique row in `store_fulfillments`; a webhook delivered twice
 * finds the grant already recorded and does nothing the second time. The
 * authoritative list of what a player currently holds lives in
 * `store_player_entitlements`, which the FiveM server can read directly.
 */
import { query, execute, changedRows } from "../db.js";
import { addMemberRole, removeMemberRole } from "./discord.js";

let ensured = null;

/** Creates the store tables once per process. Safe to call on every request. */
export async function ensureStoreTables() {
  if (ensured) return ensured;
  ensured = (async () => {
    await execute(`CREATE TABLE IF NOT EXISTS store_packages (
        tebex_package_id   VARCHAR(64)  PRIMARY KEY,
        tebex_category_id  VARCHAR(64)  NULL,
        tebex_name         VARCHAR(255) NOT NULL DEFAULT '',
        tebex_status       VARCHAR(32)  NOT NULL DEFAULT 'active',
        name               VARCHAR(255) NOT NULL DEFAULT '',
        slug               VARCHAR(160) NULL,
        short_description   VARCHAR(400) NOT NULL DEFAULT '',
        description        TEXT         NOT NULL DEFAULT '',
        image_url          TEXT         NULL,
        category           VARCHAR(160) NOT NULL DEFAULT '',
        featured           BOOLEAN      NOT NULL DEFAULT false,
        display_enabled    BOOLEAN      NOT NULL DEFAULT true,
        active             BOOLEAN      NOT NULL DEFAULT true,
        sort_order         INT          NOT NULL DEFAULT 0,
        price              NUMERIC(10,2) NULL,
        currency           VARCHAR(3)   NOT NULL DEFAULT 'USD',
        is_subscription    BOOLEAN      NOT NULL DEFAULT false,
        metadata           JSONB        NULL,
        created_at         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);

    await execute(`CREATE TABLE IF NOT EXISTS store_package_entitlements (
        id                SERIAL       PRIMARY KEY,
        tebex_package_id  VARCHAR(64)  NOT NULL,
        type              VARCHAR(32)  NOT NULL,
        value             VARCHAR(255) NOT NULL,
        label             VARCHAR(255) NULL,
        duration_days     INT          NULL,
        enabled           BOOLEAN      NOT NULL DEFAULT true,
        metadata          JSONB        NULL,
        created_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    await execute(
      `CREATE INDEX IF NOT EXISTS store_pkg_ent_pkg ON store_package_entitlements (tebex_package_id)`,
    );

    await execute(`CREATE TABLE IF NOT EXISTS store_purchases (
        id                    SERIAL       PRIMARY KEY,
        tebex_transaction_id  VARCHAR(80)  NULL,
        basket_ident          VARCHAR(80)  NULL,
        tebex_package_id      VARCHAR(64)  NOT NULL,
        package_name          VARCHAR(255) NOT NULL DEFAULT '',
        flrp_user_id          VARCHAR(32)  NULL,
        flrp_username         VARCHAR(120) NULL,
        amount                NUMERIC(10,2) NULL,
        currency              VARCHAR(3)   NOT NULL DEFAULT 'USD',
        payment_status        VARCHAR(24)  NOT NULL DEFAULT 'pending',
        fulfillment_status    VARCHAR(24)  NOT NULL DEFAULT 'pending',
        is_subscription       BOOLEAN      NOT NULL DEFAULT false,
        expires_at            TIMESTAMPTZ  NULL,
        note                  TEXT         NULL,
        created_at            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    // One purchase row per (transaction, package) so a basket with several
    // packages records cleanly and a replayed webhook can't duplicate it.
    await execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS store_purchases_txn_pkg
         ON store_purchases (tebex_transaction_id, tebex_package_id)
         WHERE tebex_transaction_id IS NOT NULL`,
    );
    await execute(
      `CREATE INDEX IF NOT EXISTS store_purchases_basket ON store_purchases (basket_ident)`,
    );

    await execute(`CREATE TABLE IF NOT EXISTS store_fulfillments (
        id              SERIAL       PRIMARY KEY,
        purchase_id     INT          NOT NULL,
        type            VARCHAR(32)  NOT NULL,
        value           VARCHAR(255) NOT NULL,
        action          VARCHAR(12)  NOT NULL,
        status          VARCHAR(16)  NOT NULL DEFAULT 'pending',
        attempts        INT          NOT NULL DEFAULT 0,
        last_error      TEXT         NULL,
        last_attempt_at TIMESTAMPTZ  NULL,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    await execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS store_fulfillments_key
         ON store_fulfillments (purchase_id, type, value, action)`,
    );

    // The authoritative "what does this player hold right now" table. Permanent,
    // timed and subscription grants all land here; FiveM reads it for ACE/queue
    // decisions and a revocation flips active to false rather than deleting.
    await execute(`CREATE TABLE IF NOT EXISTS store_player_entitlements (
        id             SERIAL       PRIMARY KEY,
        discord_id     VARCHAR(32)  NOT NULL,
        type           VARCHAR(32)  NOT NULL,
        value          VARCHAR(255) NOT NULL,
        active         BOOLEAN      NOT NULL DEFAULT true,
        source_purchase_id INT      NULL,
        tebex_package_id   VARCHAR(64) NULL,
        granted_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at     TIMESTAMPTZ  NULL,
        revoked_at     TIMESTAMPTZ  NULL
      )`);
    await execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS store_player_ent_key
         ON store_player_entitlements (discord_id, type, value)`,
    );

    await execute(`CREATE TABLE IF NOT EXISTS store_webhook_events (
        id           VARCHAR(80)  PRIMARY KEY,
        type         VARCHAR(64)  NOT NULL DEFAULT '',
        received_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);

    await execute(`CREATE TABLE IF NOT EXISTS store_audit_log (
        id          SERIAL       PRIMARY KEY,
        actor_id    VARCHAR(32)  NULL,
        actor_name  VARCHAR(120) NULL,
        action      VARCHAR(64)  NOT NULL,
        target      VARCHAR(255) NULL,
        detail      JSONB        NULL,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);

    await execute(`CREATE TABLE IF NOT EXISTS store_settings (
        id              INT          PRIMARY KEY DEFAULT 1,
        last_sync_at    TIMESTAMPTZ  NULL,
        last_sync_status VARCHAR(24) NULL,
        metadata        JSONB        NULL
      )`);
  })().catch((err) => {
    // Let a later call retry rather than caching a failed create forever.
    ensured = null;
    throw err;
  });
  return ensured;
}

/* --------------------------------------------------------------- audit */

export async function recordAudit(actor, action, target, detail = null) {
  try {
    await ensureStoreTables();
    await execute(
      `INSERT INTO store_audit_log (actor_id, actor_name, action, target, detail)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        actor?.id ?? null,
        actor?.displayName ?? actor?.username ?? (actor ? null : "system"),
        action,
        target ?? null,
        detail ? JSON.stringify(detail) : null,
      ],
    );
  } catch {
    // Audit is best-effort; never fail the operation it describes.
  }
}

/* ------------------------------------------------------------ packages */

const ENTITLEMENT_TYPES = new Set([
  "discord_role",
  "fivem_permission",
  "queue_priority",
  "website_badge",
  "cosmetic",
  "other",
]);

export function isEntitlementType(type) {
  return ENTITLEMENT_TYPES.has(String(type));
}

function shapePackage(row, entitlementCount) {
  return {
    tebexPackageId: row.tebex_package_id,
    tebexCategoryId: row.tebex_category_id,
    tebexName: row.tebex_name,
    tebexStatus: row.tebex_status,
    name: row.name || row.tebex_name,
    slug: row.slug,
    shortDescription: row.short_description,
    description: row.description,
    imageUrl: row.image_url,
    category: row.category,
    featured: Boolean(row.featured),
    displayEnabled: Boolean(row.display_enabled),
    active: Boolean(row.active),
    sortOrder: row.sort_order,
    price: row.price == null ? null : Number(row.price),
    currency: row.currency,
    isSubscription: Boolean(row.is_subscription),
    entitlementCount: entitlementCount ?? undefined,
    updatedAt: row.updated_at,
  };
}

/** Every mirrored package, newest-featured first, with entitlement counts. */
export async function listPackages() {
  await ensureStoreTables();
  const rows = await query(`SELECT * FROM store_packages ORDER BY sort_order, name, tebex_name`);
  const counts = await query(
    `SELECT tebex_package_id, COUNT(*)::int AS n FROM store_package_entitlements GROUP BY tebex_package_id`,
  );
  const byId = new Map(counts.map((c) => [c.tebex_package_id, c.n]));
  return rows.map((row) => shapePackage(row, byId.get(row.tebex_package_id) ?? 0));
}

/** The public storefront view: only enabled, active packages Tebex still lists. */
export async function listStorefront() {
  await ensureStoreTables();
  const rows = await query(
    `SELECT * FROM store_packages
      WHERE display_enabled = true AND active = true AND tebex_status = 'active'
      ORDER BY sort_order, name, tebex_name`,
  );
  return rows.map((row) => ({
    tebexPackageId: row.tebex_package_id,
    name: row.name || row.tebex_name,
    slug: row.slug,
    shortDescription: row.short_description,
    description: row.description,
    imageUrl: row.image_url,
    category: row.category || row.tebex_name,
    featured: Boolean(row.featured),
    price: row.price == null ? null : Number(row.price),
    currency: row.currency,
    isSubscription: Boolean(row.is_subscription),
  }));
}

export async function getPackage(tebexPackageId) {
  await ensureStoreTables();
  const rows = await query(`SELECT * FROM store_packages WHERE tebex_package_id = $1 LIMIT 1`, [
    String(tebexPackageId),
  ]);
  return rows[0] ? shapePackage(rows[0]) : null;
}

/**
 * Sync packages from Tebex, preserving every FLRP-side setting.
 *
 * A sync only ever touches the synced columns (Tebex name, price, currency,
 * status, category id). The display name, descriptions, image, featured flag,
 * enabled flag, sort order and — crucially — the entitlement mappings are the
 * community's and are never overwritten by a sync. A package that vanishes from
 * Tebex is marked inactive, not deleted, so its configuration survives a mistake
 * or a temporary API blip and comes back when the package does.
 */
export async function syncFromTebex(tebex) {
  await ensureStoreTables();
  const packages = await tebex.fetchPackages();
  let created = 0;
  let updated = 0;

  const seen = new Set();
  for (const pkg of packages) {
    if (!pkg.tebexPackageId) continue;
    seen.add(pkg.tebexPackageId);
    const existing = await query(
      `SELECT tebex_package_id FROM store_packages WHERE tebex_package_id = $1 LIMIT 1`,
      [pkg.tebexPackageId],
    );
    if (existing.length) {
      await execute(
        `UPDATE store_packages SET
           tebex_name = $2, tebex_status = $3, tebex_category_id = $4,
           price = $5, currency = $6, is_subscription = $7, active = true,
           updated_at = CURRENT_TIMESTAMP
         WHERE tebex_package_id = $1`,
        [
          pkg.tebexPackageId,
          pkg.tebexName,
          pkg.status,
          pkg.categoryId,
          pkg.price,
          pkg.currency,
          pkg.type === "subscription",
        ],
      );
      updated += 1;
    } else {
      await execute(
        `INSERT INTO store_packages
           (tebex_package_id, tebex_category_id, tebex_name, tebex_status, name,
            short_description, description, image_url, category, price, currency,
            is_subscription, display_enabled, active, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,true,$13)`,
        [
          pkg.tebexPackageId,
          pkg.categoryId,
          pkg.tebexName,
          pkg.status,
          pkg.tebexName,
          "",
          pkg.description || "",
          pkg.imageUrl,
          pkg.categoryName || "",
          pkg.price,
          pkg.currency,
          pkg.type === "subscription",
          created,
        ],
      );
      // New packages arrive hidden (display_enabled=false), so a sync can never
      // silently publish something to the public store before it's been set up.
      created += 1;
    }
  }

  // Mark packages Tebex no longer returns inactive, keeping their config.
  if (seen.size) {
    await execute(
      `UPDATE store_packages SET active = false, tebex_status = 'removed', updated_at = CURRENT_TIMESTAMP
        WHERE NOT (tebex_package_id = ANY($1))`,
      [[...seen]],
    );
  }

  await execute(
    `INSERT INTO store_settings (id, last_sync_at, last_sync_status)
       VALUES (1, CURRENT_TIMESTAMP, 'ok')
     ON CONFLICT (id) DO UPDATE SET last_sync_at = CURRENT_TIMESTAMP, last_sync_status = 'ok'`,
  );

  return { created, updated, total: packages.length };
}

/** The editable FLRP-side display fields; Tebex commerce data is never set here. */
export async function updatePackageDisplay(tebexPackageId, fields) {
  await ensureStoreTables();
  const result = await execute(
    `UPDATE store_packages SET
       name = COALESCE($2, name),
       slug = $3,
       short_description = COALESCE($4, short_description),
       description = COALESCE($5, description),
       image_url = $6,
       category = COALESCE($7, category),
       featured = COALESCE($8, featured),
       display_enabled = COALESCE($9, display_enabled),
       sort_order = COALESCE($10, sort_order),
       updated_at = CURRENT_TIMESTAMP
     WHERE tebex_package_id = $1`,
    [
      String(tebexPackageId),
      fields.name ?? null,
      fields.slug ?? null,
      fields.shortDescription ?? null,
      fields.description ?? null,
      fields.imageUrl ?? null,
      fields.category ?? null,
      typeof fields.featured === "boolean" ? fields.featured : null,
      typeof fields.displayEnabled === "boolean" ? fields.displayEnabled : null,
      Number.isInteger(fields.sortOrder) ? fields.sortOrder : null,
    ],
  );
  return changedRows(result);
}

/* -------------------------------------------------------- entitlements */

function shapeEntitlement(row) {
  return {
    id: row.id,
    tebexPackageId: row.tebex_package_id,
    type: row.type,
    value: row.value,
    label: row.label,
    durationDays: row.duration_days,
    enabled: Boolean(row.enabled),
  };
}

export async function listEntitlements(tebexPackageId) {
  await ensureStoreTables();
  const rows = await query(
    `SELECT * FROM store_package_entitlements WHERE tebex_package_id = $1 ORDER BY id`,
    [String(tebexPackageId)],
  );
  return rows.map(shapeEntitlement);
}

export async function addEntitlement(tebexPackageId, { type, value, label, durationDays, enabled }) {
  await ensureStoreTables();
  const rows = await query(
    `INSERT INTO store_package_entitlements (tebex_package_id, type, value, label, duration_days, enabled)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      String(tebexPackageId),
      String(type),
      String(value),
      label ?? null,
      Number.isInteger(durationDays) ? durationDays : null,
      enabled !== false,
    ],
  );
  return shapeEntitlement(rows[0]);
}

export async function updateEntitlement(id, { value, label, durationDays, enabled }) {
  await ensureStoreTables();
  const result = await execute(
    `UPDATE store_package_entitlements SET
       value = COALESCE($2, value),
       label = $3,
       duration_days = $4,
       enabled = COALESCE($5, enabled),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [
      Number(id),
      value ?? null,
      label ?? null,
      Number.isInteger(durationDays) ? durationDays : null,
      typeof enabled === "boolean" ? enabled : null,
    ],
  );
  return changedRows(result);
}

export async function deleteEntitlement(id) {
  await ensureStoreTables();
  const result = await execute(`DELETE FROM store_package_entitlements WHERE id = $1`, [Number(id)]);
  return changedRows(result);
}

/* ---------------------------------------------------------- purchases */

function shapePurchase(row) {
  return {
    id: row.id,
    transactionId: row.tebex_transaction_id,
    basketIdent: row.basket_ident,
    tebexPackageId: row.tebex_package_id,
    packageName: row.package_name,
    userId: row.flrp_user_id,
    username: row.flrp_username,
    amount: row.amount == null ? null : Number(row.amount),
    currency: row.currency,
    paymentStatus: row.payment_status,
    fulfillmentStatus: row.fulfillment_status,
    isSubscription: Boolean(row.is_subscription),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Record the pending intent when a checkout basket is created. */
export async function recordPendingPurchase({ basketIdent, tebexPackageId, packageName, userId, username, amount, currency, isSubscription }) {
  await ensureStoreTables();
  const rows = await query(
    `INSERT INTO store_purchases
       (basket_ident, tebex_package_id, package_name, flrp_user_id, flrp_username,
        amount, currency, is_subscription, payment_status, fulfillment_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending','pending') RETURNING *`,
    [
      basketIdent,
      String(tebexPackageId),
      packageName ?? "",
      userId ?? null,
      username ?? null,
      amount ?? null,
      currency ?? "USD",
      Boolean(isSubscription),
    ],
  );
  return shapePurchase(rows[0]);
}

export async function listPurchases({ search = "", status = "", limit = 50, offset = 0 } = {}) {
  await ensureStoreTables();
  const where = [];
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    const i = params.length;
    where.push(
      `(flrp_username ILIKE $${i} OR flrp_user_id ILIKE $${i} OR package_name ILIKE $${i} OR tebex_transaction_id ILIKE $${i})`,
    );
  }
  if (status) {
    params.push(status);
    where.push(`payment_status = $${params.length}`);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  params.push(Math.min(Number(limit) || 50, 200));
  params.push(Math.max(Number(offset) || 0, 0));
  const rows = await query(
    `SELECT * FROM store_purchases ${clause}
      ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const [{ count }] = await query(
    `SELECT COUNT(*)::int AS count FROM store_purchases ${clause}`,
    params.slice(0, params.length - 2),
  );
  return { purchases: rows.map(shapePurchase), total: count };
}

export async function listPurchasesForUser(userId) {
  await ensureStoreTables();
  const rows = await query(
    `SELECT * FROM store_purchases WHERE flrp_user_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [String(userId)],
  );
  return rows.map(shapePurchase);
}

export async function getPurchase(id) {
  await ensureStoreTables();
  const rows = await query(`SELECT * FROM store_purchases WHERE id = $1 LIMIT 1`, [Number(id)]);
  return rows[0] ? shapePurchase(rows[0]) : null;
}

/** The fulfillment ledger for one purchase, so support can see what happened. */
export async function listFulfillments(purchaseId) {
  await ensureStoreTables();
  const rows = await query(
    `SELECT * FROM store_fulfillments WHERE purchase_id = $1 ORDER BY id`,
    [Number(purchaseId)],
  );
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    value: row.value,
    action: row.action,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    lastAttemptAt: row.last_attempt_at,
  }));
}

/* --------------------------------------------------------- fulfillment */

/** Grant one entitlement to a player. Returns { ok, error }. Never throws. */
async function grantEntitlement(discordId, ent, purchaseId, tebexPackageId) {
  const expiresAt =
    Number.isInteger(ent.duration_days) && ent.duration_days > 0
      ? new Date(Date.now() + ent.duration_days * 86_400_000)
      : null;

  // Discord roles are applied through the bot token, the same path the roster
  // uses. Everything else is a database entitlement the FiveM server reads.
  if (ent.type === "discord_role") {
    const guildId = String(process.env.DISCORD_GUILD_ID ?? "").trim();
    if (!guildId) return { ok: false, error: "No DISCORD_GUILD_ID configured." };
    if (!/^\d{17,20}$/.test(String(ent.value))) return { ok: false, error: "Not a Discord role id." };
    let applied = false;
    try {
      applied = await addMemberRole(guildId, discordId, String(ent.value), "FLRP store purchase");
    } catch (err) {
      return { ok: false, error: err?.message || "Discord role grant failed." };
    }
    if (!applied) return { ok: false, error: "Discord refused the role (bot permissions or membership)." };
  }

  // Record the authoritative grant regardless of type (Discord roles included,
  // so a revocation and an expiry have a row to act on).
  try {
    await execute(
      `INSERT INTO store_player_entitlements
         (discord_id, type, value, active, source_purchase_id, tebex_package_id, granted_at, expires_at, revoked_at)
       VALUES ($1,$2,$3,true,$4,$5,CURRENT_TIMESTAMP,$6,NULL)
       ON CONFLICT (discord_id, type, value) DO UPDATE SET
         active = true, source_purchase_id = EXCLUDED.source_purchase_id,
         tebex_package_id = EXCLUDED.tebex_package_id, granted_at = CURRENT_TIMESTAMP,
         expires_at = EXCLUDED.expires_at, revoked_at = NULL`,
      [discordId, ent.type, String(ent.value), purchaseId, tebexPackageId, expiresAt],
    );
  } catch (err) {
    return { ok: false, error: err?.message || "Could not store the entitlement." };
  }
  return { ok: true };
}

/** Revoke one entitlement from a player. Returns { ok, error }. Never throws. */
async function revokeEntitlement(discordId, type, value) {
  if (type === "discord_role") {
    const guildId = String(process.env.DISCORD_GUILD_ID ?? "").trim();
    if (guildId && /^\d{17,20}$/.test(String(value))) {
      try {
        await removeMemberRole(guildId, discordId, String(value), "FLRP store revocation");
      } catch (err) {
        return { ok: false, error: err?.message || "Discord role removal failed." };
      }
    }
  }
  try {
    await execute(
      `UPDATE store_player_entitlements SET active = false, revoked_at = CURRENT_TIMESTAMP
        WHERE discord_id = $1 AND type = $2 AND value = $3`,
      [discordId, type, String(value)],
    );
  } catch (err) {
    return { ok: false, error: err?.message || "Could not update the entitlement." };
  }
  return { ok: true };
}

/**
 * Fulfill a purchase: grant every enabled entitlement its package maps, once.
 *
 * Idempotent. Each grant is a unique (purchase, type, value, grant) row; one
 * already marked `granted` is skipped, so a webhook delivered twice never grants
 * twice. Returns the resulting fulfillment_status for the purchase.
 */
export async function fulfillPurchase(purchaseId) {
  await ensureStoreTables();
  const purchase = await getPurchase(purchaseId);
  if (!purchase) return "none";
  if (!purchase.userId) {
    await setFulfillmentStatus(purchaseId, "pending");
    return "pending"; // No linked FLRP account to grant to yet.
  }

  const entitlements = await query(
    `SELECT * FROM store_package_entitlements WHERE tebex_package_id = $1 AND enabled = true`,
    [purchase.tebexPackageId],
  );
  if (!entitlements.length) {
    await setFulfillmentStatus(purchaseId, "none");
    return "none";
  }

  let granted = 0;
  let failed = 0;
  for (const ent of entitlements) {
    // Claim the (purchase, entitlement, grant) slot. If it already existed as
    // granted, skip; if it existed as failed, we retry it below.
    const existing = await query(
      `SELECT id, status FROM store_fulfillments
        WHERE purchase_id = $1 AND type = $2 AND value = $3 AND action = 'grant' LIMIT 1`,
      [purchaseId, ent.type, String(ent.value)],
    );
    if (existing[0]?.status === "granted") {
      granted += 1;
      continue;
    }

    const res = await grantEntitlement(purchase.userId, ent, purchaseId, purchase.tebexPackageId);
    await upsertFulfillment(purchaseId, ent.type, String(ent.value), "grant", res.ok ? "granted" : "failed", res.error);
    if (res.ok) granted += 1;
    else failed += 1;
  }

  const status = failed === 0 ? "fulfilled" : granted === 0 ? "failed" : "partial";
  await setFulfillmentStatus(purchaseId, status);
  return status;
}

/** Revoke every entitlement a purchase granted, idempotently. */
export async function revokePurchase(purchaseId) {
  await ensureStoreTables();
  const purchase = await getPurchase(purchaseId);
  if (!purchase || !purchase.userId) return "revoked";

  const grants = await query(
    `SELECT type, value FROM store_fulfillments
      WHERE purchase_id = $1 AND action = 'grant' AND status = 'granted'`,
    [purchaseId],
  );
  for (const g of grants) {
    const already = await query(
      `SELECT status FROM store_fulfillments
        WHERE purchase_id = $1 AND type = $2 AND value = $3 AND action = 'revoke' LIMIT 1`,
      [purchaseId, g.type, g.value],
    );
    if (already[0]?.status === "revoked") continue;
    const res = await revokeEntitlement(purchase.userId, g.type, g.value);
    await upsertFulfillment(purchaseId, g.type, g.value, "revoke", res.ok ? "revoked" : "failed", res.error);
  }
  await setFulfillmentStatus(purchaseId, "revoked");
  return "revoked";
}

async function upsertFulfillment(purchaseId, type, value, action, status, error) {
  await execute(
    `INSERT INTO store_fulfillments (purchase_id, type, value, action, status, attempts, last_error, last_attempt_at)
     VALUES ($1,$2,$3,$4,$5,1,$6,CURRENT_TIMESTAMP)
     ON CONFLICT (purchase_id, type, value, action) DO UPDATE SET
       status = EXCLUDED.status,
       attempts = store_fulfillments.attempts + 1,
       last_error = EXCLUDED.last_error,
       last_attempt_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP`,
    [purchaseId, type, String(value), action, status, error ?? null],
  );
}

async function setFulfillmentStatus(purchaseId, status) {
  await execute(
    `UPDATE store_purchases SET fulfillment_status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [Number(purchaseId), status],
  );
}

/* --------------------------------------------------- webhook plumbing */

/**
 * Claim a webhook id for processing. Returns true when it is new; a repeated id
 * (Tebex retry or replay) returns false so the caller does nothing further.
 */
export async function claimWebhookEvent(id, type) {
  await ensureStoreTables();
  const result = await execute(
    `INSERT INTO store_webhook_events (id, type) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
    [String(id), String(type ?? "")],
  );
  return changedRows(result);
}

/**
 * Apply a verified payment webhook: for each purchased package, upsert the
 * purchase row keyed by (transaction, package), link it to the FLRP user carried
 * in the basket's custom data, and fulfill it. Idempotent end to end.
 */
export async function applyPaymentCompleted(parsed) {
  await ensureStoreTables();
  const userId = normaliseUserId(parsed.custom);
  const username = parsed.custom?.flrp_username ?? parsed.customerName ?? null;
  const results = [];

  const packageIds = parsed.products.length ? parsed.products : parsed.packageIds.map((id) => ({ id, name: "" }));
  for (const product of packageIds) {
    const packageId = String(product.id);
    if (!packageId) continue;
    const pkg = await getPackage(packageId);

    // Adopt any pending row for this basket, else upsert by (transaction, package).
    let purchaseId = null;
    if (parsed.basketIdent) {
      const pending = await query(
        `SELECT id FROM store_purchases WHERE basket_ident = $1 AND tebex_package_id = $2
           AND tebex_transaction_id IS NULL ORDER BY id DESC LIMIT 1`,
        [parsed.basketIdent, packageId],
      );
      purchaseId = pending[0]?.id ?? null;
    }

    if (purchaseId) {
      await execute(
        `UPDATE store_purchases SET tebex_transaction_id = $2, payment_status = 'completed',
           flrp_user_id = COALESCE(flrp_user_id, $3), flrp_username = COALESCE(flrp_username, $4),
           amount = COALESCE($5, amount), currency = $6, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [purchaseId, parsed.transactionId, userId, username, parsed.amount, parsed.currency],
      );
    } else {
      const rows = await query(
        `INSERT INTO store_purchases
           (tebex_transaction_id, basket_ident, tebex_package_id, package_name, flrp_user_id,
            flrp_username, amount, currency, payment_status, fulfillment_status, is_subscription)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'completed','pending',$9)
         ON CONFLICT (tebex_transaction_id, tebex_package_id)
           WHERE tebex_transaction_id IS NOT NULL
           DO UPDATE SET payment_status = 'completed', updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          parsed.transactionId,
          parsed.basketIdent,
          packageId,
          product.name || pkg?.name || "",
          userId,
          username,
          parsed.amount,
          parsed.currency,
          Boolean(pkg?.isSubscription),
        ],
      );
      purchaseId = rows[0]?.id ?? null;
    }

    if (purchaseId) {
      const status = await fulfillPurchase(purchaseId);
      results.push({ purchaseId, packageId, status });
    }
  }

  await recordAudit(null, "payment.completed", parsed.transactionId, {
    userId,
    packages: results,
  });
  return results;
}

/** Apply a verified refund/chargeback/subscription-end webhook: revoke. */
export async function applyPaymentReversed(parsed, type) {
  await ensureStoreTables();
  if (!parsed.transactionId) return [];
  const rows = await query(
    `SELECT id FROM store_purchases WHERE tebex_transaction_id = $1`,
    [parsed.transactionId],
  );
  const newStatus =
    type === "recurring-payment.ended" || type === "recurring-payment.cancelled"
      ? "revoked"
      : type.includes("chargeback") || type.includes("dispute")
        ? "chargeback"
        : "refunded";

  const results = [];
  for (const row of rows) {
    await execute(`UPDATE store_purchases SET payment_status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
      row.id,
      newStatus,
    ]);
    const status = await revokePurchase(row.id);
    results.push({ purchaseId: row.id, status });
  }
  await recordAudit(null, type, parsed.transactionId, { results });
  return results;
}

function normaliseUserId(custom) {
  const raw = custom?.flrp_user_id ?? custom?.flrpUserId ?? custom?.discord_id ?? null;
  const id = raw == null ? "" : String(raw).trim();
  return /^\d{17,20}$/.test(id) ? id : null;
}

/* ---------------------------------------------------------- overview */

export async function storeOverview() {
  await ensureStoreTables();
  const [pkg] = await query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE active AND display_enabled)::int AS visible,
       COUNT(*) FILTER (WHERE active)::int AS active
     FROM store_packages`,
  );
  const [purch] = await query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE payment_status = 'completed')::int AS completed,
       COUNT(*) FILTER (WHERE fulfillment_status = 'pending')::int AS pending_fulfillment,
       COUNT(*) FILTER (WHERE fulfillment_status IN ('failed','partial'))::int AS failed_fulfillment,
       COALESCE(SUM(amount) FILTER (WHERE payment_status = 'completed'), 0) AS revenue,
       MAX(currency) FILTER (WHERE payment_status = 'completed') AS currency
     FROM store_purchases`,
  );
  const settings = await query(`SELECT last_sync_at, last_sync_status FROM store_settings WHERE id = 1`);
  return {
    packages: pkg ?? { total: 0, visible: 0, active: 0 },
    purchases: {
      total: purch?.total ?? 0,
      completed: purch?.completed ?? 0,
      pendingFulfillment: purch?.pending_fulfillment ?? 0,
      failedFulfillment: purch?.failed_fulfillment ?? 0,
      revenue: purch?.revenue == null ? 0 : Number(purch.revenue),
      currency: purch?.currency ?? "USD",
    },
    lastSyncAt: settings[0]?.last_sync_at ?? null,
    lastSyncStatus: settings[0]?.last_sync_status ?? null,
  };
}

export async function listAudit(limit = 100) {
  await ensureStoreTables();
  const rows = await query(
    `SELECT * FROM store_audit_log ORDER BY created_at DESC LIMIT $1`,
    [Math.min(Number(limit) || 100, 300)],
  );
  return rows.map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    action: row.action,
    target: row.target,
    detail: row.detail,
    createdAt: row.created_at,
  }));
}
