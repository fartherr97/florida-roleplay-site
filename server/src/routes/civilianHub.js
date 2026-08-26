/**
 * The /api/civilian-hub router. Same seed-fallback contract as the rest of the
 * API: try the database, and on any failure serve the seed shape.
 *
 * Everything here is open to any signed-in member: the business directory, the
 * penal code and the civilian guides. The per-character personal-records section
 * (characters, vehicles, property, licences) was removed.
 */
import { Router } from "express";
import { query } from "../db.js";
import * as seed from "../civilianHubSeed.js";
import { requirePermission } from "../middleware/requirePermission.js";

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

router.get("/penal-code", requirePermission("civilian.view"), (req, res) => {
  const q = String(req.query.q || "").trim();
  const fallback = q ? filterPenalCode(seed.penalCode, q) : seed.penalCode;

  safe(
    res,
    async () => {
      if (!q) {
        const rows = await query("SELECT * FROM civ_penal_code ORDER BY code");
        return rows.map(mapPenalRow);
      }
      const like = `%${q}%`;
      const rows = await query(`SELECT * FROM civ_penal_code
          WHERE title LIKE $1 OR code LIKE $2 OR degree LIKE $3 OR notes LIKE $4
          ORDER BY code`,
        [like, like, like, like],
      );
      return rows.map(mapPenalRow);
    },
    fallback,
  );
});

function mapPenalRow(row) {
  return {
    code: row.code,
    title: row.title,
    degree: row.degree,
    fine: row.fine,
    jail: row.jail_time,
    points: row.points,
    notes: row.notes,
  };
}

router.get("/guides", requirePermission("civilian.view"), (_req, res) =>
  safe(res, async () => [], seed.guides),
);

export default router;
