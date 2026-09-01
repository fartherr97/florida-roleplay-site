/**
 * Tebex Headless API client and webhook verification.
 *
 * Tebex stays the authoritative checkout and payment platform — this file never
 * touches money. It reads the store's packages/categories to mirror onto our
 * site, creates a basket and hands back Tebex's own hosted checkout URL, and
 * verifies the authenticity of the webhooks Tebex sends when a payment settles
 * or reverses. Fulfillment (granting FLRP entitlements) lives in store.js; this
 * module is the boundary with Tebex and nothing more.
 *
 * The Headless API is public — it is keyed by the store's public webstore token
 * carried in the URL path, not by a secret — so the only secret here is the
 * webhook signing secret used to prove an incoming webhook really came from
 * Tebex. Neither ever reaches the browser: every call is server-side.
 *
 * Docs: https://docs.tebex.io/developers/headless-api and
 *       https://docs.tebex.io/developers/webhooks
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const HEADLESS_BASE = "https://headless.tebex.io/api";

/** The public webstore token that identifies our store to the Headless API. */
export function storeToken() {
  return String(process.env.TEBEX_STORE_TOKEN ?? "").trim();
}

/** The webhook signing secret, from Developers → Webhooks in the Tebex panel. */
export function webhookSecret() {
  return String(process.env.TEBEX_WEBHOOK_SECRET ?? "").trim();
}

/** True once a store token is configured; the storefront is dormant until then. */
export function tebexConfigured() {
  return Boolean(storeToken());
}

/**
 * The public store URL for "Open in Tebex" links. Prefers an explicit
 * TEBEX_STORE_URL, else derives the conventional {token}.tebex.io host.
 */
export function tebexStoreUrl() {
  const explicit = String(process.env.TEBEX_STORE_URL ?? "").trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  const token = storeToken();
  return token ? `https://${token}.tebex.io` : "";
}

/** A short-timeout fetch that never hangs the request or leaks the reason raw. */
async function tebexFetch(path, { method = "GET", body } = {}) {
  const token = storeToken();
  if (!token) {
    const err = new Error("The store is not connected to Tebex yet.");
    err.code = "TEBEX_NOT_CONFIGURED";
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  const options = {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    signal: controller.signal,
  };
  if (body !== undefined) options.body = JSON.stringify(body);
  let res;
  try {
    res = await fetch(`${HEADLESS_BASE}${path}`, options);
  } catch (cause) {
    const err = new Error("Could not reach Tebex.");
    err.code = "TEBEX_UNREACHABLE";
    err.cause = cause;
    throw err;
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const err = new Error(payload?.title || payload?.message || `Tebex responded ${res.status}.`);
    err.code = "TEBEX_ERROR";
    err.status = res.status;
    throw err;
  }
  // The Headless API wraps most responses in { data: ... }.
  return payload && Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;
}

/**
 * Every package in the store, normalised to the fields we mirror locally. The
 * price Tebex reports is authoritative; we only ever store a copy of it.
 */
export async function fetchPackages() {
  const data = await tebexFetch(`/accounts/${encodeURIComponent(storeToken())}/packages`);
  const list = Array.isArray(data) ? data : Array.isArray(data?.packages) ? data.packages : [];
  return list.map(normalizePackage);
}

/** The store's categories, each with the ids of the packages inside it. */
export async function fetchCategories() {
  const data = await tebexFetch(
    `/accounts/${encodeURIComponent(storeToken())}/categories?includePackages=1`,
  );
  const list = Array.isArray(data) ? data : Array.isArray(data?.categories) ? data.categories : [];
  return list.map((cat) => ({
    id: String(cat.id ?? ""),
    name: String(cat.name ?? "").trim(),
    order: Number(cat.order ?? 0),
    packageIds: Array.isArray(cat.packages)
      ? cat.packages.map((p) => String(p.id ?? p)).filter(Boolean)
      : [],
  }));
}

/** Tebex's package shape varies by store type; pull the fields defensively. */
function normalizePackage(pkg) {
  const price = pkg.total_price ?? pkg.base_price ?? pkg.price ?? null;
  return {
    tebexPackageId: String(pkg.id ?? ""),
    tebexName: String(pkg.name ?? "").trim(),
    description: String(pkg.description ?? ""),
    imageUrl: pkg.image && typeof pkg.image === "string" ? pkg.image : null,
    price: price === null ? null : Number(price),
    currency: String(pkg.currency ?? "USD").toUpperCase().slice(0, 3),
    categoryId: pkg.category?.id != null ? String(pkg.category.id) : null,
    categoryName: pkg.category?.name ? String(pkg.category.name) : null,
    // "single" or "subscription" — a subscription is revocable when it lapses.
    type: String(pkg.type ?? "single"),
    status: pkg.disabled ? "disabled" : "active",
  };
}

/**
 * Create a basket for one package and return Tebex's hosted checkout URL plus
 * the basket ident. The FLRP user is stitched in as basket `custom` data, which
 * Tebex echoes back on the payment webhook — that is how a settled payment finds
 * its way back to the account that started it. We never fulfill on the return
 * redirect; only the webhook does.
 */
export async function createCheckout({ packageId, completeUrl, cancelUrl, custom }) {
  const token = encodeURIComponent(storeToken());
  const basket = await tebexFetch(`/accounts/${token}/baskets`, {
    method: "POST",
    body: {
      complete_url: completeUrl,
      cancel_url: cancelUrl,
      complete_auto_redirect: true,
      custom: custom ?? {},
    },
  });

  const ident = basket?.ident ?? basket?.id;
  if (!ident) {
    const err = new Error("Tebex did not return a basket.");
    err.code = "TEBEX_ERROR";
    throw err;
  }

  await tebexFetch(`/baskets/${encodeURIComponent(ident)}/packages`, {
    method: "POST",
    body: { package_id: Number(packageId), quantity: 1 },
  });

  // Re-read the basket so we hand back the freshest checkout link.
  let checkoutUrl = basket?.links?.checkout ?? null;
  try {
    const refreshed = await tebexFetch(`/accounts/${token}/baskets/${encodeURIComponent(ident)}`);
    checkoutUrl = refreshed?.links?.checkout ?? checkoutUrl;
  } catch {
    // The link from creation stands if the re-read fails.
  }

  if (!checkoutUrl) {
    const err = new Error("Tebex did not return a checkout link.");
    err.code = "TEBEX_ERROR";
    throw err;
  }
  return { ident: String(ident), checkoutUrl: String(checkoutUrl) };
}

/* ------------------------------------------------------------ webhooks */

/**
 * Verify a Tebex webhook's authenticity.
 *
 * Tebex signs each webhook by SHA-256 hashing the raw JSON body, then computing
 * an HMAC-SHA256 of that hash with the store's webhook secret. The result is
 * sent in the `X-Tebex-Signature` header. We recompute it from the exact bytes
 * we received (never a re-serialised object — a re-encode would change the
 * hash) and compare in constant time.
 *
 * Returns true only on a byte-for-byte match. With no secret configured it
 * returns false, so the caller can allow the one-off setup handshake through but
 * refuse to act on anything it cannot actually verify.
 */
export function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = webhookSecret();
  if (!secret || !signatureHeader) return false;

  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const expected = createHmac("sha256", secret).update(bodyHash).digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(String(signatureHeader), "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Webhook types that mean "the customer now owns these products". */
export const FULFILL_TYPES = new Set([
  "payment.completed",
  "recurring-payment.renewed",
]);

/**
 * Webhook types that mean "revoke what these products granted".
 *
 * Only definitive money-back events revoke — a refund, a *lost* dispute, or a
 * subscription that has actually ended. A dispute merely being *opened* is not
 * here on purpose: if the dispute is later won the money is kept, so yanking
 * perks the moment one opens would punish a customer you'll likely win against.
 */
export const REVOKE_TYPES = new Set([
  "payment.refunded",
  "payment.chargeback",
  "payment.dispute.lost",
  "recurring-payment.ended",
  "recurring-payment.cancelled",
]);

/**
 * Pull the fields we care about out of a webhook `subject`, defensively — Tebex's
 * exact shape differs a little between store types and product lines.
 */
export function parseWebhookSubject(subject) {
  const s = subject ?? {};
  const products = Array.isArray(s.products) ? s.products : [];
  const custom = s.custom ?? s.basket?.custom ?? {};
  return {
    transactionId: String(s.transaction_id ?? s.id ?? "").trim() || null,
    basketIdent: String(s.basket_ident ?? s.basket?.ident ?? "").trim() || null,
    amount: s.price?.amount != null ? Number(s.price.amount) : null,
    currency: String(s.price?.currency ?? "USD").toUpperCase().slice(0, 3),
    status: String(s.status?.description ?? s.status ?? "").trim() || null,
    customerName: String(s.customer?.username?.username ?? s.customer?.name ?? "").trim() || null,
    packageIds: products.map((p) => String(p.id ?? p.package?.id ?? "")).filter(Boolean),
    products: products.map((p) => ({
      id: String(p.id ?? p.package?.id ?? ""),
      name: String(p.name ?? p.package?.name ?? "").trim(),
    })),
    custom: custom && typeof custom === "object" ? custom : {},
  };
}
