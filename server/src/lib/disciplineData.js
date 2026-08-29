/**
 * Loading disciplinary rows from the store.
 *
 * Split out of routes/discipline.js so more than one route can read the same
 * record: the DA Hub reads it to render the hub, and the transfer portal reads
 * one member's folded record for the ticket's Background Check. Keeping the query
 * (and its seed fallback) in one place is what stops those two drifting apart.
 */
import { query } from "../db.js";
import * as seed from "../disciplineSeed.js";
import { normalizeAction } from "./discipline.js";

const COLUMNS = `
  id, type, body_id AS "bodyId", target_name AS "targetName",
  target_discord_id AS "targetDiscordId", issued_by_name AS "issuedByName",
  issued_by_discord_id AS "issuedByDiscordId", reason, expires_at AS "expiresAt",
  voided, void_reason AS "voidReason", created_at AS "createdAt", updated_at AS "updatedAt"`;

/**
 * Every action, or one member's, newest first. A missing/unreachable database
 * falls back to the seeds so the hub and the embed both still render.
 *
 * @param {{targetDiscordId?: string, since?: string|Date}} [filter]
 */
export async function loadActions({ targetDiscordId, since } = {}) {
  // Postgres numbers its placeholders, so a clause is written after its value is
  // pushed and reads its own position off the array. Building the two lists
  // independently is how a filter ends up bound to the wrong value.
  const where = [];
  const params = [];
  if (targetDiscordId) {
    params.push(targetDiscordId);
    where.push(`target_discord_id = $${params.length}`);
  }
  if (since) {
    params.push(since);
    where.push(`created_at >= $${params.length}`);
  }
  try {
    const rows = await query(
      `SELECT ${COLUMNS} FROM disciplinary_actions${where.length ? ` WHERE ${where.join(" AND ")}` : ""}
       ORDER BY created_at DESC LIMIT 2000`,
      params,
    );
    if (rows.length) return rows.map((row) => normalizeAction({ ...row, voided: Boolean(row.voided) }));
  } catch {
    // No database — the seeds stand, so the hub and the embed both render.
  }
  return seed.ACTIONS.map(normalizeAction).filter(
    (a) => !targetDiscordId || a.targetDiscordId === targetDiscordId,
  );
}
