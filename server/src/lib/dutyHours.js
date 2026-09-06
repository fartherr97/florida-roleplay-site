/**
 * Duty hours, fed by the FiveM server.
 *
 * FiveM servers don't expose their HTTP port, so the game PUSHES to us (the
 * direction that already works for config sync) rather than us pulling from it.
 * flrp_onduty POSTs each completed shift to /api/fivem/duty/session, a heartbeat
 * to /api/fivem/duty/live (who's on duty + department metadata), and backfills
 * recent history once on boot. We accumulate the sessions here and each
 * department hub's Hours page is served by aggregating them for the chosen
 * window — no request ever leaves the site.
 */
import { execute, query } from "../db.js";

let ensured = null;
function ensureTables() {
  if (!ensured) {
    ensured = (async () => {
      await execute(`
        CREATE TABLE IF NOT EXISTS fivem_duty_sessions (
          license     TEXT    NOT NULL,
          entity      TEXT    NOT NULL,
          started_at  BIGINT  NOT NULL,
          ended_at    BIGINT,
          seconds     INTEGER,
          rank        TEXT,
          subdivision TEXT,
          callsign    TEXT,
          name        TEXT,
          PRIMARY KEY (license, entity, started_at)
        )`);
      await execute(`CREATE INDEX IF NOT EXISTS idx_fds_entity_started ON fivem_duty_sessions (entity, started_at)`);
      await execute(`
        CREATE TABLE IF NOT EXISTS fivem_duty_live (
          id         INTEGER PRIMARY KEY,
          payload    JSONB   NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
    })().catch((err) => { ensured = null; throw err; });
  }
  return ensured;
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const validSession = (s) =>
  s && typeof s.license === "string" && typeof s.entity === "string" && Number.isFinite(Number(s.startedAt));

/** Upsert one completed shift (idempotent on license+entity+started_at). */
export async function ingestSession(s) {
  if (!validSession(s)) return false;
  await ensureTables();
  await execute(
    `INSERT INTO fivem_duty_sessions (license, entity, started_at, ended_at, seconds, rank, subdivision, callsign, name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (license, entity, started_at) DO UPDATE SET
       ended_at = EXCLUDED.ended_at, seconds = EXCLUDED.seconds, rank = EXCLUDED.rank,
       subdivision = EXCLUDED.subdivision, callsign = EXCLUDED.callsign, name = EXCLUDED.name`,
    [s.license, String(s.entity).toLowerCase(), Math.floor(Number(s.startedAt)), num(s.endedAt),
     num(s.seconds), s.rank ?? null, s.subdivision ?? null, s.callsign ?? null, s.name ?? null],
  );
  return true;
}

/** Upsert a batch of shifts (the boot backfill). Returns how many landed. */
export async function ingestSessions(list) {
  if (!Array.isArray(list)) return 0;
  let n = 0;
  for (const s of list) if (await ingestSession(s)) n += 1;
  return n;
}

/** Store the current live snapshot (who's on duty + department metadata). */
export async function setLive(payload) {
  await ensureTables();
  await execute(
    `INSERT INTO fivem_duty_live (id, payload, updated_at) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
    [JSON.stringify(payload ?? {})],
  );
}

/** The duty-hours slice for one department, aggregated for an optional window. */
export async function fetchDeptDutyHours(deptId, range) {
  try {
    await ensureTables();
    const wantId = String(deptId || "").toLowerCase();

    // live snapshot → department metadata + who's on duty right now
    let live = null;
    const lrows = await query("SELECT payload FROM fivem_duty_live WHERE id = 1");
    live = lrows[0]?.payload ?? null;
    const depts = live?.departments ?? [];
    const meta =
      depts.find((d) => String(d.id).toLowerCase() === wantId) ||
      depts.find((d) => String(d.short || "").toLowerCase() === wantId) || null;
    const entity = (meta?.id ?? wantId).toLowerCase();

    const ranged = range && Number.isFinite(range.from) && Number.isFinite(range.to);
    const where = ["entity = $1"];
    const params = [entity];
    if (ranged) { where.push("started_at BETWEEN $2 AND $3"); params.push(Math.floor(range.from), Math.floor(range.to)); }
    const clause = where.join(" AND ");

    const totals = await query(
      `SELECT license, SUM(COALESCE(seconds,0)) AS total, COUNT(*) AS sessions, MAX(started_at) AS last_on
       FROM fivem_duty_sessions WHERE ${clause} GROUP BY license`, params);

    // no data at all yet → tell the page it's still waiting on the game
    if (!live && totals.length === 0) {
      return { ok: false, code: "NO_DATA_YET", department: null, members: [], ranks: [], subdivisions: [] };
    }

    const latest = await query(
      `SELECT DISTINCT ON (license) license, name, rank, subdivision, callsign
       FROM fivem_duty_sessions WHERE ${clause} ORDER BY license, started_at DESC`, params);
    const latestBy = new Map(latest.map((r) => [r.license, r]));

    const nowSec = Math.floor(Date.now() / 1000);
    const liveBy = new Map();
    for (const u of live?.onDuty ?? []) {
      if (String(u.entity).toLowerCase() !== entity) continue;
      if (ranged && !(u.since >= range.from && u.since <= range.to)) continue;
      liveBy.set(u.license, u);
    }

    const rankLabel = new Map((meta?.ranks ?? []).map((r) => [r.id, r.label]));
    const subLabel = new Map((meta?.subdivisions ?? []).map((s) => [s.id, s.label]));

    const rowFor = (license, total, sessions, lastOn) => {
      const l = latestBy.get(license) || {};
      const u = liveBy.get(license);
      const liveSecs = u ? Math.max(0, nowSec - Number(u.since)) : 0;
      const rank = u?.rank ?? l.rank ?? null;
      const subdivision = u?.subdivision ?? l.subdivision ?? null;
      return {
        name: u?.name ?? l.name ?? "Unknown",
        callsign: u?.callsign ?? l.callsign ?? null,
        rank, subdivision,
        rankLabel: rankLabel.get(rank) ?? rank ?? "—",
        subLabel: subLabel.get(subdivision) ?? null,
        totalSeconds: Number(total || 0) + liveSecs,
        sessions: Number(sessions || 0),
        lastOn: Number(lastOn || (u ? u.since : 0)),
        onDutyNow: !!u,
      };
    };

    const members = totals.map((r) => rowFor(r.license, r.total, r.sessions, r.last_on));
    // people on duty now with no session rows in this window yet
    const seen = new Set(totals.map((r) => r.license));
    for (const [license, u] of liveBy) if (!seen.has(license)) members.push(rowFor(license, 0, 0, u.since));

    return {
      ok: true,
      generatedAt: live?.generatedAt ?? nowSec,
      from: ranged ? Math.floor(range.from) : null,
      to: ranged ? Math.floor(range.to) : null,
      department: meta ? { id: meta.id, label: meta.label, short: meta.short } : (members.length ? { id: deptId } : null),
      ranks: meta?.ranks ?? [],
      subdivisions: meta?.subdivisions ?? [],
      members,
      unmatched: !meta && members.length === 0,
    };
  } catch (err) {
    return { ok: false, code: "DB_ERROR", message: err.message, department: null, members: [], ranks: [], subdivisions: [] };
  }
}
