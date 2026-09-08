/**
 * The community URL shortener.
 *
 * Two tables, created on demand like the rest of the site's feature tables so a
 * deploy that never re-runs the schema still works:
 *
 *   short_link_domains  the hosts short links live on (go.flrp.us, etc.). Each
 *                       is a real subdomain an Owner has pointed at this server;
 *                       adding a row here does not create DNS — it records a host
 *                       the shortener will answer for and lets links be minted on
 *                       it. Removing a row hides it and its links stop resolving.
 *   short_links         one row per short link: which host, the slug, where it
 *                       points, who made it, and a click counter.
 *
 * Resolution (the public redirect) is deliberately scoped to registered hosts
 * only: a request is treated as a short link solely when its Host is one of
 * these domains, so slugs can never collide with the main site's real routes.
 */
import { query, execute } from "../db.js";
import { randomUUID } from "node:crypto";

let ready = null;

export function ensureTables() {
  if (!ready) {
    ready = (async () => {
      await execute(`CREATE TABLE IF NOT EXISTS short_link_domains (
        id          VARCHAR(64)  PRIMARY KEY,
        host        VARCHAR(255) NOT NULL UNIQUE,
        label       VARCHAR(120) NULL,
        active      BOOLEAN      NOT NULL DEFAULT true,
        created_by  VARCHAR(32)  NULL,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await execute(`CREATE TABLE IF NOT EXISTS short_links (
        id          VARCHAR(64)  PRIMARY KEY,
        host        VARCHAR(255) NOT NULL,
        slug        VARCHAR(80)  NOT NULL,
        target_url  TEXT         NOT NULL,
        note        VARCHAR(200) NULL,
        active      BOOLEAN      NOT NULL DEFAULT true,
        clicks      INTEGER      NOT NULL DEFAULT 0,
        created_by  VARCHAR(32)  NULL,
        created_by_name VARCHAR(120) NULL,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      // A slug is unique per host (lower-cased), so the same slug can exist on
      // two different subdomains but never twice on one.
      await execute(
        `CREATE UNIQUE INDEX IF NOT EXISTS short_links_host_slug
           ON short_links (host, lower(slug))`,
      );
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

const SLUG_RE = /^[A-Za-z0-9_-]{1,80}$/;
const HOST_RE = /^(?=.{1,255}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes

export function normalizeHost(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\.$/, "");
}

export function validHost(host) {
  return HOST_RE.test(host);
}

export function validSlug(slug) {
  return SLUG_RE.test(slug);
}

/** A short random slug. */
export function randomSlug(len = 7) {
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return out;
}

/** True for a target we're willing to redirect to: an absolute http(s) URL. */
export function validTarget(url) {
  const s = String(url ?? "").trim();
  if (s.length === 0 || s.length > 2048) return false;
  try {
    const parsed = new URL(s);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function mapDomain(row) {
  return {
    id: row.id,
    host: row.host,
    label: row.label ?? "",
    active: Boolean(row.active),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapLink(row) {
  return {
    id: row.id,
    host: row.host,
    slug: row.slug,
    targetUrl: row.target_url,
    note: row.note ?? "",
    active: Boolean(row.active),
    clicks: row.clicks ?? 0,
    createdBy: row.created_by,
    createdByName: row.created_by_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    shortUrl: `https://${row.host}/${row.slug}`,
  };
}

export async function listDomains() {
  await ensureTables();
  const rows = await query("SELECT * FROM short_link_domains ORDER BY host");
  return rows.map(mapDomain);
}

export async function addDomain({ host, label, actorId }) {
  await ensureTables();
  const rows = await query(
    `INSERT INTO short_link_domains (id, host, label, created_by)
       VALUES ($1, $2, $3, $4)
     ON CONFLICT (host) DO UPDATE SET label = EXCLUDED.label, active = true
     RETURNING *`,
    [`sld-${randomUUID()}`, host, label || null, actorId ?? null],
  );
  return mapDomain(rows[0]);
}

export async function removeDomain(id) {
  await ensureTables();
  await execute("DELETE FROM short_link_domains WHERE id = $1", [id]);
}

export async function listLinks() {
  await ensureTables();
  const rows = await query("SELECT * FROM short_links ORDER BY created_at DESC");
  return rows.map(mapLink);
}

export async function getDomainByHost(host) {
  await ensureTables();
  const rows = await query("SELECT * FROM short_link_domains WHERE host = $1 LIMIT 1", [host]);
  return rows[0] ? mapDomain(rows[0]) : null;
}

export async function createLink({ host, slug, targetUrl, note, actorId, actorName }) {
  await ensureTables();
  const rows = await query(
    `INSERT INTO short_links (id, host, slug, target_url, note, created_by, created_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [`slk-${randomUUID()}`, host, slug, targetUrl, note || null, actorId ?? null, actorName ?? null],
  );
  return mapLink(rows[0]);
}

export async function updateLink(id, fields) {
  await ensureTables();
  const rows = await query(
    `UPDATE short_links SET
       target_url = COALESCE($2, target_url),
       slug       = COALESCE($3, slug),
       note       = COALESCE($4, note),
       active     = COALESCE($5, active),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [
      id,
      fields.targetUrl ?? null,
      fields.slug ?? null,
      fields.note ?? null,
      typeof fields.active === "boolean" ? fields.active : null,
    ],
  );
  return rows[0] ? mapLink(rows[0]) : null;
}

export async function deleteLink(id) {
  await ensureTables();
  await execute("DELETE FROM short_links WHERE id = $1", [id]);
}

/**
 * Resolve a hit on a shortener host to its target and count the click. Returns
 * the target URL, or null when the host isn't a registered (active) domain or
 * the slug doesn't exist. Best-effort: any database trouble resolves to null so
 * the caller falls through to the normal site rather than erroring.
 */
export async function resolveAndCount(host, slug) {
  try {
    await ensureTables();
    const domain = await query(
      "SELECT 1 FROM short_link_domains WHERE host = $1 AND active = true LIMIT 1",
      [host],
    );
    if (!domain.length) return null;
    const rows = await query(
      "SELECT id, target_url FROM short_links WHERE host = $1 AND lower(slug) = lower($2) AND active = true LIMIT 1",
      [host, slug],
    );
    if (!rows.length) return null;
    // Count the click without blocking the redirect on it.
    execute("UPDATE short_links SET clicks = clicks + 1 WHERE id = $1", [rows[0].id]).catch(() => {});
    return rows[0].target_url;
  } catch {
    return null;
  }
}
