/**
 * Player metadata (play time, join date, last connection) for the /bgcheck embed.
 *
 * The source of truth is the FiveM server's own `players` table (see the
 * flrp-server repo: database/migrations/001_players.sql) — one row per player
 * keyed by license, carrying `discord_id`, `active_playtime_seconds`,
 * `total_playtime_seconds`, `first_seen` and `last_seen`.
 *
 * FiveM servers don't reliably expose their HTTP port, so — exactly like duty
 * hours — the game PUSHES these rows to us rather than us pulling from it. The
 * drop-in resource in fivem/flrp_playermeta/ reads the `players` table over
 * oxmysql and POSTs it to /api/fivem/players[_bulk] with the same shared secret
 * the config/duty sync already uses. We keep a local mirror here and /bgcheck
 * reads it back by Discord id — fast, and it never depends on the game being
 * reachable at check time.
 *
 * Entirely best-effort: with no mirror (nothing pushed yet, or no database) the
 * embed simply omits the play-time / join / last-connection lines. It never
 * blocks or fails a background check.
 */
import { execute, query } from "../db.js";

let ensured = null;
function ensureTable() {
  if (!ensured) {
    ensured = (async () => {
      await execute(`
        CREATE TABLE IF NOT EXISTS fivem_players (
          discord_id              TEXT    PRIMARY KEY,
          license                 TEXT,
          name                    TEXT,
          active_playtime_seconds BIGINT  NOT NULL DEFAULT 0,
          total_playtime_seconds  BIGINT  NOT NULL DEFAULT 0,
          first_seen              BIGINT,
          last_seen               BIGINT,
          updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
    })().catch((err) => { ensured = null; throw err; });
  }
  return ensured;
}

const isDiscordId = (v) => /^\d{17,20}$/.test(String(v ?? ""));

/** A finite number, or null. */
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Coerce a timestamp — unix seconds, unix milliseconds, or an ISO/date string —
 * to unix SECONDS, or null. The `players` table's first_seen/last_seen come over
 * as unix seconds from the bridge, but we accept the other shapes defensively.
 */
function toUnixSeconds(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    let n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (n > 1e12) n = Math.floor(n / 1000); // ms → s
    return n > 0 ? Math.floor(n) : null;
  }
  const t = Date.parse(String(value));
  return Number.isNaN(t) ? null : Math.floor(t / 1000);
}

/** Normalise one pushed player row, or null when it has no usable Discord id. */
function normalizeRow(p) {
  if (!p || typeof p !== "object") return null;
  const discordId = String(p.discordId ?? p.discord_id ?? "").trim();
  if (!isDiscordId(discordId)) return null;
  return {
    discordId,
    license: p.license != null ? String(p.license) : null,
    name: p.name != null ? String(p.name) : null,
    active: Math.max(0, Math.floor(num(p.activePlaytimeSeconds ?? p.active_playtime_seconds) || 0)),
    total: Math.max(0, Math.floor(num(p.totalPlaytimeSeconds ?? p.total_playtime_seconds) || 0)),
    firstSeen: toUnixSeconds(p.firstSeen ?? p.first_seen),
    lastSeen: toUnixSeconds(p.lastSeen ?? p.last_seen),
  };
}

/** Upsert one player row (idempotent on discord_id). Returns whether it landed. */
export async function ingestPlayer(row) {
  const p = normalizeRow(row);
  if (!p) return false;
  await ensureTable();
  await execute(
    `INSERT INTO fivem_players
       (discord_id, license, name, active_playtime_seconds, total_playtime_seconds, first_seen, last_seen, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now())
     ON CONFLICT (discord_id) DO UPDATE SET
       license = COALESCE(EXCLUDED.license, fivem_players.license),
       name = COALESCE(EXCLUDED.name, fivem_players.name),
       active_playtime_seconds = EXCLUDED.active_playtime_seconds,
       total_playtime_seconds = EXCLUDED.total_playtime_seconds,
       first_seen = COALESCE(fivem_players.first_seen, EXCLUDED.first_seen),
       last_seen = GREATEST(COALESCE(EXCLUDED.last_seen, 0), COALESCE(fivem_players.last_seen, 0)),
       updated_at = now()`,
    [p.discordId, p.license, p.name, p.active, p.total, p.firstSeen, p.lastSeen],
  );
  return true;
}

/** Upsert a batch of player rows (the boot backfill / periodic sync). */
export async function ingestPlayers(list) {
  if (!Array.isArray(list)) return 0;
  let n = 0;
  for (const row of list) if (await ingestPlayer(row)) n += 1;
  return n;
}

/** True once at least one player row has been mirrored. */
export async function playerMetaConfigured() {
  try {
    await ensureTable();
    const rows = await query("SELECT 1 FROM fivem_players LIMIT 1");
    return rows.length > 0;
  } catch {
    return false;
  }
}

const isoOf = (secs) => (secs ? new Date(secs * 1000).toISOString() : null);

/**
 * One player's metadata by Discord id, in the shape the background-check embed
 * expects, or null when unknown / no mirror / no database. Play time is the
 * compensated (non-AFK) active time, falling back to total connected time.
 *
 * @returns {Promise<{playTimeMinutes: number|null, joinedAt: string|null, lastConnection: string|null, name: string|null} | null>}
 */
export async function fetchPlayerMeta(discordId) {
  if (!isDiscordId(discordId)) return null;
  try {
    await ensureTable();
    const rows = await query(
      `SELECT name, active_playtime_seconds, total_playtime_seconds, first_seen, last_seen
       FROM fivem_players WHERE discord_id = $1`,
      [String(discordId)],
    );
    const r = rows[0];
    if (!r) return null;
    const secs = Number(r.active_playtime_seconds) || Number(r.total_playtime_seconds) || 0;
    const playTimeMinutes = secs > 0 ? Math.floor(secs / 60) : null;
    const joinedAt = isoOf(Number(r.first_seen) || null);
    const lastConnection = isoOf(Number(r.last_seen) || null);
    if (playTimeMinutes == null && !joinedAt && !lastConnection) return null;
    return { playTimeMinutes, joinedAt, lastConnection, name: r.name ?? null };
  } catch {
    return null;
  }
}

/** "3 days, 10 hours, 44 minutes" from a minute count, like the reference bot. */
export function formatPlayTime(minutes) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return null;
  const days = Math.floor(m / 1440);
  const hours = Math.floor((m % 1440) / 60);
  const mins = Math.floor(m % 60);
  const parts = [];
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (mins || parts.length === 0) parts.push(`${mins} minute${mins === 1 ? "" : "s"}`);
  return parts.join(", ");
}
