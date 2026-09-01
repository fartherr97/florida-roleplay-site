/**
 * The storefront API.
 *
 * Three surfaces on one router:
 *   - **Public** (`/api/store/...`): the packages the player sees, and creating a
 *     checkout that hands back Tebex's hosted checkout URL. Nothing here charges
 *     a card or grants anything — Tebex takes the payment, and only its webhook
 *     grants entitlements.
 *   - **Management** (`/api/store/manage/...`): Ownership-only. Every one of these
 *     is gated by `store.manage` server-side, never merely hidden in the UI.
 *   - **Webhook** (`/api/store/webhook`): Tebex's authoritative payment
 *     confirmation. Verified by signature, de-duplicated by event id, and the
 *     only path that fulfills or revokes a purchase.
 */
import { Router } from "express";
import { requirePermission } from "../middleware/requirePermission.js";
import { fetchGuildRoles } from "../lib/discord.js";
import { str } from "../validate.js";
import * as tebex from "../lib/tebex.js";
import * as store from "../lib/store.js";

const router = Router();

function siteOrigin() {
  const raw = String(process.env.SITE_URL ?? process.env.PUBLIC_SITE_URL ?? "").trim();
  return raw ? raw.replace(/\/+$/, "") : "https://www.flrp.us";
}

/* ------------------------------------------------------------- public */

/** The storefront: enabled packages plus whether the store is even connected. */
router.get("/packages", async (_req, res) => {
  if (!tebex.tebexConfigured()) {
    return res.json({ configured: false, packages: [], storeUrl: tebex.tebexStoreUrl() });
  }
  try {
    const packages = await store.listStorefront();
    return res.json({ configured: true, packages, storeUrl: tebex.tebexStoreUrl() });
  } catch {
    return res.json({ configured: true, packages: [], storeUrl: tebex.tebexStoreUrl() });
  }
});

/**
 * Start a checkout for one package. Requires a signed-in FLRP user so the
 * eventual payment can be attributed back to them via the basket's custom data.
 * Returns Tebex's hosted checkout URL; the browser is sent there to pay.
 */
router.post("/checkout", async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(403).json({
      ok: false,
      code: "AUTH_SIGNED_OUT",
      message: "Sign in with Discord before checking out.",
    });
  }
  if (!tebex.tebexConfigured()) {
    return res.status(503).json({ ok: false, code: "STORE_OFFLINE", message: "The store isn't connected to Tebex yet." });
  }

  const packageId = str(req.body?.packageId);
  if (!packageId) {
    return res.status(400).json({ ok: false, message: "A package is required." });
  }

  let pkg;
  try {
    pkg = await store.getPackage(packageId);
  } catch {
    pkg = null;
  }
  if (!pkg || !pkg.displayEnabled || !pkg.active || pkg.tebexStatus !== "active") {
    return res.status(404).json({ ok: false, code: "PACKAGE_UNAVAILABLE", message: "That package isn't available." });
  }

  try {
    const origin = siteOrigin();
    const { ident, checkoutUrl } = await tebex.createCheckout({
      packageId,
      completeUrl: `${origin}/store?status=complete`,
      cancelUrl: `${origin}/store?status=cancel`,
      custom: { flrp_user_id: user.id, flrp_username: user.displayName ?? user.username ?? null },
    });

    // Record the intent so the webhook can adopt it and, until then, the player
    // sees a pending purchase. Never a grant — that waits for Tebex.
    try {
      await store.recordPendingPurchase({
        basketIdent: ident,
        tebexPackageId: packageId,
        packageName: pkg.name,
        userId: user.id,
        username: user.displayName ?? user.username ?? null,
        amount: pkg.price,
        currency: pkg.currency,
        isSubscription: pkg.isSubscription,
      });
    } catch {
      // A missing pending row doesn't block checkout — the webhook still fulfills.
    }

    return res.json({ ok: true, checkoutUrl });
  } catch (err) {
    const code = err?.code === "TEBEX_UNREACHABLE" ? "TEBEX_UNREACHABLE" : "CHECKOUT_FAILED";
    return res.status(502).json({ ok: false, code, message: "Couldn't start checkout with Tebex. Please try again shortly." });
  }
});

/** A signed-in player's own purchases and their fulfillment state. */
router.get("/purchases/me", async (req, res) => {
  if (!req.user) {
    return res.status(403).json({ ok: false, code: "AUTH_SIGNED_OUT", message: "Sign in to see your purchases." });
  }
  try {
    return res.json({ purchases: await store.listPurchasesForUser(req.user.id) });
  } catch {
    return res.json({ purchases: [] });
  }
});

/* --------------------------------------------------------- management */

const manage = requirePermission("store.manage");

router.get("/manage/overview", manage, async (_req, res) => {
  try {
    return res.json({ configured: tebex.tebexConfigured(), storeUrl: tebex.tebexStoreUrl(), ...(await store.storeOverview()) });
  } catch {
    return res.status(503).json({ ok: false, message: "The store needs a database." });
  }
});

router.get("/manage/packages", manage, async (_req, res) => {
  try {
    return res.json({ configured: tebex.tebexConfigured(), storeUrl: tebex.tebexStoreUrl(), packages: await store.listPackages() });
  } catch {
    return res.json({ configured: tebex.tebexConfigured(), storeUrl: tebex.tebexStoreUrl(), packages: [] });
  }
});

router.post("/manage/sync", manage, async (req, res) => {
  if (!tebex.tebexConfigured()) {
    return res.status(503).json({ ok: false, code: "STORE_OFFLINE", message: "Set TEBEX_STORE_TOKEN before syncing." });
  }
  try {
    const result = await store.syncFromTebex(tebex);
    await store.recordAudit(req.user, "sync", "packages", result);
    return res.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err?.code === "TEBEX_UNREACHABLE"
        ? "Could not reach Tebex. Nothing was changed."
        : "Tebex rejected the sync. Nothing was changed.";
    return res.status(502).json({ ok: false, message });
  }
});

router.get("/manage/packages/:id", manage, async (req, res) => {
  try {
    const pkg = await store.getPackage(str(req.params.id));
    if (!pkg) return res.status(404).json({ ok: false, message: "No such package." });
    const entitlements = await store.listEntitlements(str(req.params.id));
    return res.json({ package: pkg, entitlements });
  } catch {
    return res.status(503).json({ ok: false, message: "The store needs a database." });
  }
});

router.patch("/manage/packages/:id", manage, async (req, res) => {
  const b = req.body ?? {};
  const fields = {
    name: b.name != null ? str(b.name).slice(0, 255) : undefined,
    slug: b.slug != null ? str(b.slug).slice(0, 160).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || null : undefined,
    shortDescription: b.shortDescription != null ? str(b.shortDescription).slice(0, 400) : undefined,
    description: b.description != null ? str(b.description).slice(0, 5000) : undefined,
    imageUrl: b.imageUrl != null ? str(b.imageUrl).slice(0, 500) || null : undefined,
    category: b.category != null ? str(b.category).slice(0, 160) : undefined,
    featured: typeof b.featured === "boolean" ? b.featured : undefined,
    displayEnabled: typeof b.displayEnabled === "boolean" ? b.displayEnabled : undefined,
    sortOrder: Number.isInteger(b.sortOrder) ? b.sortOrder : undefined,
  };
  try {
    const changed = await store.updatePackageDisplay(str(req.params.id), fields);
    if (!changed) return res.status(404).json({ ok: false, message: "No such package." });
    await store.recordAudit(req.user, "package.update", str(req.params.id), fields);
    return res.json({ ok: true, package: await store.getPackage(str(req.params.id)) });
  } catch {
    return res.status(503).json({ ok: false, message: "The store needs a database." });
  }
});

router.post("/manage/packages/:id/entitlements", manage, async (req, res) => {
  const b = req.body ?? {};
  const type = str(b.type);
  const value = str(b.value).slice(0, 255);
  if (!store.isEntitlementType(type)) {
    return res.status(400).json({ ok: false, message: "Unknown entitlement type." });
  }
  if (!value) return res.status(400).json({ ok: false, message: "A value is required." });
  if (type === "discord_role" && !/^\d{17,20}$/.test(value)) {
    return res.status(400).json({ ok: false, message: "A Discord role entitlement needs a valid role id." });
  }
  const durationDays = Number.isInteger(b.durationDays) && b.durationDays > 0 ? b.durationDays : null;
  try {
    const pkg = await store.getPackage(str(req.params.id));
    if (!pkg) return res.status(404).json({ ok: false, message: "No such package." });
    const entitlement = await store.addEntitlement(str(req.params.id), {
      type,
      value,
      label: str(b.label).slice(0, 255) || null,
      durationDays,
      enabled: b.enabled !== false,
    });
    await store.recordAudit(req.user, "entitlement.add", str(req.params.id), { type, value });
    return res.status(201).json({ ok: true, entitlement });
  } catch {
    return res.status(503).json({ ok: false, message: "The store needs a database." });
  }
});

router.patch("/manage/entitlements/:entId", manage, async (req, res) => {
  const b = req.body ?? {};
  try {
    const changed = await store.updateEntitlement(Number(req.params.entId), {
      value: b.value != null ? str(b.value).slice(0, 255) : undefined,
      label: b.label != null ? str(b.label).slice(0, 255) || null : undefined,
      durationDays: Number.isInteger(b.durationDays) ? b.durationDays : b.durationDays === null ? null : undefined,
      enabled: typeof b.enabled === "boolean" ? b.enabled : undefined,
    });
    if (!changed) return res.status(404).json({ ok: false, message: "No such entitlement." });
    await store.recordAudit(req.user, "entitlement.update", str(req.params.entId), b);
    return res.json({ ok: true });
  } catch {
    return res.status(503).json({ ok: false, message: "The store needs a database." });
  }
});

router.delete("/manage/entitlements/:entId", manage, async (req, res) => {
  try {
    const changed = await store.deleteEntitlement(Number(req.params.entId));
    if (!changed) return res.status(404).json({ ok: false, message: "No such entitlement." });
    await store.recordAudit(req.user, "entitlement.remove", str(req.params.entId), null);
    return res.json({ ok: true });
  } catch {
    return res.status(503).json({ ok: false, message: "The store needs a database." });
  }
});

router.get("/manage/purchases", manage, async (req, res) => {
  try {
    const result = await store.listPurchases({
      search: str(req.query.q),
      status: str(req.query.status),
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    });
    return res.json(result);
  } catch {
    return res.json({ purchases: [], total: 0 });
  }
});

router.get("/manage/purchases/:id", manage, async (req, res) => {
  try {
    const purchase = await store.getPurchase(Number(req.params.id));
    if (!purchase) return res.status(404).json({ ok: false, message: "No such purchase." });
    const fulfillments = await store.listFulfillments(Number(req.params.id));
    return res.json({ purchase, fulfillments });
  } catch {
    return res.status(503).json({ ok: false, message: "The store needs a database." });
  }
});

router.post("/manage/purchases/:id/retry", manage, async (req, res) => {
  try {
    const purchase = await store.getPurchase(Number(req.params.id));
    if (!purchase) return res.status(404).json({ ok: false, message: "No such purchase." });
    const status = await store.fulfillPurchase(Number(req.params.id));
    await store.recordAudit(req.user, "fulfillment.retry", str(req.params.id), { status });
    return res.json({ ok: true, status });
  } catch {
    return res.status(503).json({ ok: false, message: "The store needs a database." });
  }
});

router.post("/manage/purchases/:id/revoke", manage, async (req, res) => {
  try {
    const purchase = await store.getPurchase(Number(req.params.id));
    if (!purchase) return res.status(404).json({ ok: false, message: "No such purchase." });
    const status = await store.revokePurchase(Number(req.params.id));
    await store.recordAudit(req.user, "fulfillment.revoke", str(req.params.id), { status });
    return res.json({ ok: true, status });
  } catch {
    return res.status(503).json({ ok: false, message: "The store needs a database." });
  }
});

router.get("/manage/audit", manage, async (_req, res) => {
  try {
    return res.json({ entries: await store.listAudit() });
  } catch {
    return res.json({ entries: [] });
  }
});

/** Live Discord roles, so an entitlement can be picked rather than typed raw. */
router.get("/manage/discord-roles", manage, async (_req, res) => {
  try {
    const roles = await fetchGuildRoles();
    return res.json({ roles: roles ?? [] });
  } catch {
    return res.json({ roles: [] });
  }
});

/* ------------------------------------------------------------ webhook */

/**
 * Tebex's payment webhook — the single authority for fulfillment.
 *
 * The signature is verified against the exact bytes received (stashed as
 * `req.rawBody`), the event id de-duplicates retries and replays, and only then
 * is anything granted or revoked. A `validation.webhook` (sent once when the
 * endpoint is first saved in Tebex) is answered by echoing its id.
 */
router.post("/webhook", async (req, res) => {
  const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const type = str(req.body?.type);
  const id = str(req.body?.id);

  // The setup handshake. Tebex sends this with the signature once you save the
  // endpoint; echo the id back so it can confirm the URL is live.
  if (type === "validation.webhook") {
    if (tebex.webhookSecret() && !tebex.verifyWebhookSignature(raw, req.get("X-Tebex-Signature"))) {
      return res.status(403).json({ ok: false, message: "Invalid signature." });
    }
    return res.json({ id });
  }

  // Every real event must verify. With no secret set we cannot, so we refuse
  // rather than act on an unverified payment.
  if (!tebex.verifyWebhookSignature(raw, req.get("X-Tebex-Signature"))) {
    return res.status(403).json({ ok: false, message: "Invalid signature." });
  }

  if (!id) return res.status(400).json({ ok: false, message: "Missing event id." });

  try {
    const fresh = await store.claimWebhookEvent(id, type);
    if (!fresh) return res.json({ ok: true, duplicate: true }); // already processed

    const parsed = tebex.parseWebhookSubject(req.body?.subject);
    if (tebex.FULFILL_TYPES.has(type)) {
      await store.applyPaymentCompleted(parsed);
    } else if (tebex.REVOKE_TYPES.has(type)) {
      await store.applyPaymentReversed(parsed, type);
    }
    // Any other verified type is acknowledged without action.
    return res.json({ ok: true });
  } catch {
    // Acknowledge so Tebex does not retry-storm; the event is recorded and
    // Ownership can retry fulfillment from the Purchases page.
    return res.json({ ok: true, deferred: true });
  }
});

export default router;
