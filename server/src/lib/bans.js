/**
 * The active Discord ban list.
 *
 * The florida-roleplay-manager bot owns enforcement: `/globalban` bans a user
 * across every registered server and reports it here; `/globalunban` clears it.
 * The website only records and displays what the bot reports, so the Staff Hub
 * has a live view of who is globally banned — the guild display name and Discord
 * id above all — without anyone needing the bot console.
 *
 * One self-creating table, keyed by Discord id so a re-ban updates the same row.
 * A temporary ban carries an expiry; the active list hides it once it passes,
 * so an expired temp ban falls off on its own without the bot writing again.
 */
import { query, execute } from "../db.js";

let ready = null;

export function ensureTable() {
  if (!ready) {
    ready = execute(`CREATE TABLE IF NOT EXISTS discord_bans (
      discord_id      VARCHAR(32)  PRIMARY KEY,
      display_name    VARCHAR(120) NULL,
      reason          TEXT         NULL,
      actor_id        VARCHAR(32)  NULL,
      actor_name      VARCHAR(120) NULL,
      servers_applied INTEGER      NULL,
      servers_total   INTEGER      NULL,
      expires_at      TIMESTAMPTZ  NULL,
      active          BOOLEAN      NOT NULL DEFAULT true,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
      unbanned_at     TIMESTAMPTZ  NULL,
      unbanned_by     VARCHAR(32)  NULL,
      unbanned_by_name VARCHAR(120) NULL
    )`).catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

function mapBan(row) {
  return {
    discordId: row.discord_id,
    displayName: row.display_name ?? null,
    reason: row.reason ?? null,
    actorId: row.actor_id ?? null,
    actorName: row.actor_name ?? null,
    serversApplied: row.servers_applied ?? null,
    serversTotal: row.servers_total ?? null,
    expiresAt: row.expires_at ?? null,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Record (or refresh) a ban reported by the bot. Re-banning reactivates the row. */
export async function upsertBan({
  discordId,
  displayName,
  reason,
  actorId,
  actorName,
  serversApplied,
  serversTotal,
  expiresAt,
}) {
  await ensureTable();
  const rows = await query(
    `INSERT INTO discord_bans
       (discord_id, display_name, reason, actor_id, actor_name, servers_applied, servers_total,
        expires_at, active, created_at, updated_at, unbanned_at, unbanned_by, unbanned_by_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NULL,NULL,NULL)
     ON CONFLICT (discord_id) DO UPDATE SET
       display_name    = EXCLUDED.display_name,
       reason          = EXCLUDED.reason,
       actor_id        = EXCLUDED.actor_id,
       actor_name      = EXCLUDED.actor_name,
       servers_applied = EXCLUDED.servers_applied,
       servers_total   = EXCLUDED.servers_total,
       expires_at      = EXCLUDED.expires_at,
       active          = true,
       updated_at      = CURRENT_TIMESTAMP,
       unbanned_at     = NULL,
       unbanned_by     = NULL,
       unbanned_by_name = NULL
     RETURNING *`,
    [
      discordId,
      displayName ?? null,
      reason ?? null,
      actorId ?? null,
      actorName ?? null,
      Number.isFinite(serversApplied) ? serversApplied : null,
      Number.isFinite(serversTotal) ? serversTotal : null,
      expiresAt ?? null,
    ],
  );
  return mapBan(rows[0]);
}

/** Mark a ban lifted (kept for history, hidden from the active list). */
export async function deactivateBan({ discordId, actorId, actorName }) {
  await ensureTable();
  const result = await execute(
    `UPDATE discord_bans
        SET active = false, updated_at = CURRENT_TIMESTAMP,
            unbanned_at = CURRENT_TIMESTAMP, unbanned_by = $2, unbanned_by_name = $3
      WHERE discord_id = $1 AND active = true`,
    [discordId, actorId ?? null, actorName ?? null],
  );
  return result?.rowCount ?? 0;
}

/** Every currently-active ban, newest first, with expired temp bans excluded. */
export async function listActiveBans() {
  await ensureTable();
  const rows = await query(
    `SELECT * FROM discord_bans
      WHERE active = true AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      ORDER BY updated_at DESC`,
  );
  return rows.map(mapBan);
}
