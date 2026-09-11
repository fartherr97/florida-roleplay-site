/**
 * The public Applications page.
 *
 * One table, created on demand like the rest of the site's feature tables so a
 * deploy that never re-runs the schema still works:
 *
 *   application_departments  one row per department shown on /applications: its
 *                            name, the recruitment status (open / interviews /
 *                            closed), an optional interviews-until date, and the
 *                            external Apply Now URL applicants are sent to.
 *
 * Department Heads, Directorship and Ownership set the status and the
 * interviews-until date (applications.manage). Ownership adds and removes the
 * departments themselves and edits the Apply Now URLs (applications.admin).
 */
import { query, execute } from "../db.js";
import { randomUUID } from "node:crypto";

/** The recruitment states a department card can be in. */
export const APPLICATION_STATUSES = [
  { id: "open", label: "Now Open", color: "#22c55e", apply: true },
  { id: "interviews", label: "Open Interviews", color: "#f59e0b", apply: true },
  { id: "closed", label: "Closed", color: "#ef4444", apply: false },
];

const STATUS_IDS = new Set(APPLICATION_STATUSES.map((s) => s.id));

export function validStatus(value) {
  return STATUS_IDS.has(String(value ?? ""));
}

let ready = null;

export function ensureTables() {
  if (!ready) {
    ready = (async () => {
      await execute(`CREATE TABLE IF NOT EXISTS application_departments (
        id               VARCHAR(64)  PRIMARY KEY,
        name             VARCHAR(160) NOT NULL,
        short_name       VARCHAR(40)  NULL,
        accent           VARCHAR(40)  NULL,
        blurb            VARCHAR(400) NULL,
        status           VARCHAR(24)  NOT NULL DEFAULT 'closed',
        interviews_until DATE         NULL,
        apply_url        TEXT         NULL,
        sort_order       INTEGER      NOT NULL DEFAULT 0,
        updated_by       VARCHAR(32)  NULL,
        updated_by_name  VARCHAR(120) NULL,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await seedDefaults();
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

/**
 * Seed the three saved departments the first time the table is empty. Never
 * touches an existing row, so once Ownership has edited the page this does
 * nothing — it only bootstraps a fresh install.
 */
async function seedDefaults() {
  const existing = await query("SELECT 1 FROM application_departments LIMIT 1");
  if (existing.length) return;
  const seeds = [
    { id: "fhp", name: "Florida Highway Patrol", short: "FHP", accent: "#d2b48c" },
    { id: "bso", name: "Broward County Sheriff's Office", short: "BSO", accent: "#22c55e" },
    { id: "mpd", name: "Miami Police Department", short: "MPD", accent: "#3b82f6" },
  ];
  for (let i = 0; i < seeds.length; i += 1) {
    const s = seeds[i];
    await execute(
      `INSERT INTO application_departments (id, name, short_name, accent, status, sort_order)
         VALUES ($1, $2, $3, $4, 'closed', $5)
       ON CONFLICT (id) DO NOTHING`,
      [`ad-${s.id}`, s.name, s.short, s.accent, i],
    );
  }
}

function mapDept(row) {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name ?? "",
    accent: row.accent ?? "",
    blurb: row.blurb ?? "",
    status: row.status,
    interviewsUntil: row.interviews_until
      ? new Date(row.interviews_until).toISOString().slice(0, 10)
      : null,
    applyUrl: row.apply_url ?? "",
    sortOrder: row.sort_order ?? 0,
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name ?? null,
    updatedAt: row.updated_at,
  };
}

/** True for an Apply Now target we're willing to link to: an absolute http(s) URL. */
export function validApplyUrl(url) {
  const s = String(url ?? "").trim();
  if (s.length === 0) return true; // empty is allowed — the button just hides
  if (s.length > 2048) return false;
  try {
    const parsed = new URL(s);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** An interviews-until value: null, or a YYYY-MM-DD date string. */
export function normalizeUntil(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined; // undefined = invalid
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : s;
}

export async function listDepartments() {
  await ensureTables();
  const rows = await query(
    "SELECT * FROM application_departments ORDER BY sort_order, name",
  );
  return rows.map(mapDept);
}

export async function createDepartment({ name, shortName, accent, blurb, applyUrl, actorId, actorName }) {
  await ensureTables();
  const orderRows = await query(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM application_departments",
  );
  const nextOrder = orderRows[0]?.next ?? 0;
  const rows = await query(
    `INSERT INTO application_departments
       (id, name, short_name, accent, blurb, status, apply_url, sort_order, updated_by, updated_by_name)
       VALUES ($1, $2, $3, $4, $5, 'closed', $6, $7, $8, $9)
     RETURNING *`,
    [
      `ad-${randomUUID()}`,
      name,
      shortName || null,
      accent || null,
      blurb || null,
      applyUrl || null,
      nextOrder,
      actorId ?? null,
      actorName ?? null,
    ],
  );
  return mapDept(rows[0]);
}

/** Status + interviews-until edit (applications.manage). */
export async function setStatus(id, { status, interviewsUntil, actorId, actorName }) {
  await ensureTables();
  const rows = await query(
    `UPDATE application_departments SET
       status           = COALESCE($2, status),
       interviews_until = $3,
       updated_by       = $4,
       updated_by_name  = $5,
       updated_at       = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [id, status ?? null, interviewsUntil ?? null, actorId ?? null, actorName ?? null],
  );
  return rows[0] ? mapDept(rows[0]) : null;
}

/** Full edit — name, apply URL, branding (applications.admin). */
export async function updateDepartment(id, fields) {
  await ensureTables();
  const rows = await query(
    `UPDATE application_departments SET
       name       = COALESCE($2, name),
       short_name = COALESCE($3, short_name),
       accent     = COALESCE($4, accent),
       blurb      = COALESCE($5, blurb),
       apply_url  = COALESCE($6, apply_url),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [
      id,
      fields.name ?? null,
      fields.shortName ?? null,
      fields.accent ?? null,
      fields.blurb ?? null,
      fields.applyUrl ?? null,
    ],
  );
  return rows[0] ? mapDept(rows[0]) : null;
}

export async function deleteDepartment(id) {
  await ensureTables();
  await execute("DELETE FROM application_departments WHERE id = $1", [id]);
}
