/**
 * Player metadata from txAdmin, for the background-check embed.
 *
 * txAdmin has no clean public "look up a player by Discord id" API, so this
 * talks to a small bridge you point it at (TXADMIN_META_URL) — the FiveM
 * resource in fivem/flrp-playermeta/ serves exactly the shape below by reading
 * txAdmin's player database. The site never needs txAdmin's internals; it just
 * asks the bridge for one player's play time, join date and last connection.
 *
 * Entirely optional and best-effort: unset the URL and the embed simply omits
 * these lines; any error or timeout does the same. It never blocks or fails a
 * background check.
 */

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Accept a unix timestamp (seconds or ms) or an ISO string; return ISO or null. */
function toIso(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    let n = Number(value);
    if (n < 1e12) n *= 1000; // seconds → ms
    const d = new Date(n);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** True once a bridge URL is configured. */
export function txConfigured() {
  return Boolean(String(process.env.TXADMIN_META_URL ?? "").trim());
}

/**
 * Fetch one player's txAdmin metadata by Discord id, or null when unconfigured,
 * unreachable, or the player is unknown. Accepts either the bridge's normalized
 * fields or txAdmin's native names.
 *
 * @returns {Promise<{playTimeMinutes: number|null, joinedAt: string|null, lastConnection: string|null} | null>}
 */
export async function fetchPlayerMeta(discordId) {
  const base = String(process.env.TXADMIN_META_URL ?? "").trim();
  if (!base || !/^\d{17,20}$/.test(String(discordId))) return null;
  const token = String(process.env.TXADMIN_META_TOKEN ?? "").trim();

  try {
    const url = new URL(base);
    url.searchParams.set("discord", String(discordId));
    const res = await fetch(url, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const d = await res.json().catch(() => null);
    if (!d || typeof d !== "object") return null;

    const playTimeMinutes = num(d.playTimeMinutes ?? d.playTime);
    const joinedAt = toIso(d.joinedAt ?? d.tsJoined ?? d.joinDate);
    const lastConnection = toIso(d.lastConnection ?? d.tsLastConnection ?? d.lastSeen);
    if (playTimeMinutes == null && !joinedAt && !lastConnection) return null;
    return { playTimeMinutes, joinedAt, lastConnection };
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
