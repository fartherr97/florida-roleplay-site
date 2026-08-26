/**
 * The /api/civilian-hub router. Same seed-fallback contract as the rest of the
 * API: try the database, and on any failure serve the seed shape.
 *
 * Two gates apply here. Personal records — characters, vehicles, property and
 * licences — need a whitelisted character. The community and resource sections
 * are open to any signed-in member, because a newcomer deciding whether to apply
 * should be able to read the penal code and see who is hiring.
 */
import { Router } from "express";
import { query } from "../db.js";
import * as seed from "../civilianHubSeed.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = Router();

/**
 * A member who is simply not whitelisted yet is not a permissions failure in the
 * staff sense, so these routes answer with their own code and the client renders
 * the "apply for whitelist" denial rather than the staff one.
 */
const requireWhitelist = () =>
  requirePermission("civilian.records", { code: "AUTH_NOT_WHITELISTED" });

/** Try the DB query; on any failure, return the seed fallback. */
async function safe(res, dbFn, fallback) {
  try {
    const rows = await dbFn();
    res.json(rows && rows.length ? rows : fallback);
  } catch {
    res.json(fallback);
  }
}

function isoDate(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

/* --------------------------- personal records --------------------------- */

router.get("/characters", requireWhitelist(), (req, res) =>
  safe(
    res,
    async () => {
      // Personal records: a member sees only their OWN characters, keyed by the
      // Discord id on the session — never the whole community's records.
      const rows = await query(
        "SELECT * FROM civ_characters WHERE discord_id = $1 ORDER BY is_primary DESC, name",
        [req.user.id],
      );
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        dob: isoDate(row.dob),
        occupation: row.occupation,
        residence: row.residence,
        phone: row.phone,
        bank: row.bank_balance,
        cash: row.cash_balance,
        status: row.status,
        joinedAt: isoDate(row.joined_at),
        primary: Boolean(row.is_primary),
      }));
    },
    seed.characters,
  ),
);

router.get("/vehicles", requireWhitelist(), (req, res) =>
  safe(
    res,
    async () => {
      const rows = await query(
        "SELECT * FROM civ_vehicles WHERE owner_character IN " +
          "(SELECT id FROM civ_characters WHERE discord_id = $1) ORDER BY plate",
        [req.user.id],
      );
      return rows.map((row) => ({
        id: row.id,
        plate: row.plate,
        make: row.make,
        model: row.model,
        year: row.model_year,
        colour: row.colour,
        owner: row.owner_name,
        garage: row.garage,
        status: row.status,
        insured: Boolean(row.insured),
        registeredUntil: isoDate(row.registered_until),
      }));
    },
    seed.vehicles,
  ),
);

router.get("/properties", requireWhitelist(), (req, res) =>
  safe(
    res,
    async () => {
      const rows = await query(
        "SELECT * FROM civ_properties WHERE owner_character IN " +
          "(SELECT id FROM civ_characters WHERE discord_id = $1) ORDER BY address",
        [req.user.id],
      );
      return rows.map((row) => ({
        id: row.id,
        address: row.address,
        type: row.property_type,
        owner: row.owner_name,
        district: row.district,
        purchasedAt: isoDate(row.purchased_at),
        value: row.value_usd,
        garageSlots: row.garage_slots,
        status: row.status,
      }));
    },
    seed.properties,
  ),
);

router.get("/licences", requireWhitelist(), (req, res) =>
  safe(
    res,
    async () => {
      const rows = await query(
        "SELECT * FROM civ_licences WHERE holder_character IN " +
          "(SELECT id FROM civ_characters WHERE discord_id = $1) ORDER BY holder_name, licence_type",
        [req.user.id],
      );
      return rows.map((row) => ({
        id: row.id,
        type: row.licence_type,
        holder: row.holder_name,
        number: row.licence_number,
        issuedAt: isoDate(row.issued_at),
        expiresAt: isoDate(row.expires_at),
        status: row.status,
        points: row.points,
      }));
    },
    seed.licences,
  ),
);

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
