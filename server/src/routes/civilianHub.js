/**
 * The /api/civilian-hub router. Same seed-fallback contract as the rest of the
 * API: try the database, and on any failure serve the seed shape.
 *
 * Everything here is open to any signed-in member: the business directory, the
 * penal code and the civilian guides. The per-character personal-records section
 * (characters, vehicles, property, licences) was removed.
 */
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { query } from "../db.js";
import * as seed from "../civilianHubSeed.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { str } from "../validate.js";

const router = Router();

/** Try the DB query; on any failure, return the seed fallback. */
async function safe(res, dbFn, fallback) {
  try {
    const rows = await dbFn();
    res.json(rows && rows.length ? rows : fallback);
  } catch {
    res.json(fallback);
  }
}

/* ------------------------------- community ------------------------------ */

router.get("/businesses", requirePermission("civilian.view"), (_req, res) =>
  safe(
    res,
    async () => {
      const rows = await query("SELECT * FROM civ_businesses ORDER BY name");
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        owner: row.owner_name,
        district: row.district,
        phone: row.phone,
        hiring: Boolean(row.hiring),
        blurb: row.blurb,
      }));
    },
    seed.businesses,
  ),
);

/* ------------------------------- resources ------------------------------ */

/** Mirrors the client's fallback filter so both paths behave identically. */
function filterPenalCode(entries, q) {
  const needle = q.toLowerCase();
  return entries.filter(
    (entry) =>
      entry.title.toLowerCase().includes(needle) ||
      entry.code.toLowerCase().includes(needle) ||
      entry.degree.toLowerCase().includes(needle) ||
      entry.notes.toLowerCase().includes(needle),
  );
}

/** The ids that came from the import, so an override can be told from a new charge. */
const SEED_IDS = new Set(seed.penalCode.map((e) => e.id));

/** An override row as the charge shape the page renders. */
function mapOverride(row) {
  return {
    id: row.id,
    code: row.code ?? "",
    title: row.title ?? "",
    degree: row.degree ?? "",
    bond: row.bond ?? "",
    fine: row.fine ?? "",
    jail: row.jail ?? "",
    points: row.points ?? 0,
    notes: row.notes ?? "",
  };
}

/**
 * The seeded charges with edits applied, deletions removed and new charges
 * appended. Without a database the seed is the whole list, so the penal code is
 * always readable; the overrides only ever add to or amend it.
 */
async function loadPenalCode() {
  let overrides;
  try {
    overrides = await query("SELECT * FROM penal_overrides");
  } catch {
    return seed.penalCode;
  }
  const byId = new Map(overrides.map((o) => [o.id, o]));
  const merged = [];
  for (const base of seed.penalCode) {
    const o = byId.get(base.id);
    if (!o) merged.push(base);
    else if (!o.deleted) merged.push({ ...base, ...mapOverride(o) });
  }
  for (const o of overrides) {
    if (!SEED_IDS.has(o.id) && !o.deleted) merged.push(mapOverride(o));
  }
  return merged;
}

// The penal code is public reference — anyone may read it. Editing is gated below.
router.get("/penal-code", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const all = await loadPenalCode();
  res.json(q ? filterPenalCode(all, q) : all);
});

/** Validates a charge submitted for create or edit. */
function validatePenal(body) {
  const value = {
    code: str(body?.code).slice(0, 24).trim(),
    title: str(body?.title).slice(0, 200).trim(),
    degree: str(body?.degree).slice(0, 48).trim(),
    bond: str(body?.bond).slice(0, 32).trim(),
    fine: str(body?.fine).slice(0, 32).trim(),
    jail: str(body?.jail).slice(0, 48).trim(),
    notes: str(body?.notes).slice(0, 1000),
    points: 0,
  };
  const points = Number(body?.points);
  if (Number.isFinite(points) && points >= 0) value.points = Math.trunc(points);

  const errors = [];
  if (!value.code) errors.push("A code is required.");
  if (value.title.length < 2) errors.push("A charge title is required.");
  if (!value.degree) errors.push("A class is required.");
  return { errors, value };
}

const UPSERT_OVERRIDE = `INSERT INTO penal_overrides
     (id, code, title, degree, bond, fine, jail, points, notes, deleted, updated_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, CURRENT_TIMESTAMP)
   ON CONFLICT (id) DO UPDATE SET
     code = EXCLUDED.code, title = EXCLUDED.title, degree = EXCLUDED.degree,
     bond = EXCLUDED.bond, fine = EXCLUDED.fine, jail = EXCLUDED.jail,
     points = EXCLUDED.points, notes = EXCLUDED.notes,
     deleted = FALSE, updated_at = CURRENT_TIMESTAMP`;

async function writeOverride(id, value) {
  await query(UPSERT_OVERRIDE, [
    id, value.code, value.title, value.degree, value.bond, value.fine, value.jail, value.points, value.notes,
  ]);
}

/** Add a brand-new charge. */
router.post("/penal-code", requirePermission("civilian.penal.manage"), async (req, res) => {
  const { errors, value } = validatePenal(req.body ?? {});
  if (errors.length) return res.status(400).json({ ok: false, errors });
  const id = `custom-${randomUUID().slice(0, 12)}`;
  try {
    await writeOverride(id, value);
    return res.json({ ok: true, charge: { id, ...value } });
  } catch {
    return res.status(503).json({ ok: false, message: "Not saved — no database is configured." });
  }
});

/** Edit any charge, seeded or custom — the edit is stored as an override. */
router.put("/penal-code/:id", requirePermission("civilian.penal.manage"), async (req, res) => {
  const id = str(req.params.id).slice(0, 40);
  if (!id) return res.status(400).json({ ok: false, errors: ["A charge id is required."] });
  const { errors, value } = validatePenal(req.body ?? {});
  if (errors.length) return res.status(400).json({ ok: false, errors });
  try {
    await writeOverride(id, value);
    return res.json({ ok: true, charge: { id, ...value } });
  } catch {
    return res.status(503).json({ ok: false, message: "Not saved — no database is configured." });
  }
});

/** Remove a charge. A seeded charge is hidden; a custom one is tombstoned. */
router.delete("/penal-code/:id", requirePermission("civilian.penal.manage"), async (req, res) => {
  const id = str(req.params.id).slice(0, 40);
  if (!id) return res.status(400).json({ ok: false, errors: ["A charge id is required."] });
  try {
    await query(
      `INSERT INTO penal_overrides (id, deleted, updated_at) VALUES ($1, TRUE, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET deleted = TRUE, updated_at = CURRENT_TIMESTAMP`,
      [id],
    );
    return res.json({ ok: true, id });
  } catch {
    return res.status(503).json({ ok: false, message: "Not saved — no database is configured." });
  }
});

router.get("/guides", requirePermission("civilian.view"), (_req, res) =>
  safe(res, async () => [], seed.guides),
);

export default router;
