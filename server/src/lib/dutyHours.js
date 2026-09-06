/**
 * Duty hours, fed by the FiveM server.
 *
 * FiveM servers don't expose their HTTP port, so the game PUSHES to us (the
 * direction that already works for config sync) rather than us pulling from it.
 * flrp_onduty POSTs each completed shift to /api/fivem/duty/session, a heartbeat
 * to /api/fivem/duty/live (who's on duty + department metadata), and backfills
 * recent history once on boot. We accumulate the sessions here.
 *
 * The Hours page lists the WHOLE department: the community roster (the ranks the
 * Discord bot maintains) is the member list, and duty time is overlaid onto it
 * by callsign — so everyone shows, with 0 hours until they clock in. Anyone who
 * clocked in but isn't on the roster is appended so their time is never lost.
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
const normCallsign = (s) => String(s || "").toUpperCase().replace(/\s+/g, "");
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

/** The whole department + its duty hours, aggregated for an optional window. */
export async function fetchDeptDutyHours(deptId, range) {
  try {
    await ensureTables();
    const wantId = String(deptId || "").toLowerCase();

    // live snapshot → department metadata + who's on duty right now
    const lrows = await query("SELECT payload FROM fivem_duty_live WHERE id = 1");
    const live = lrows[0]?.payload ?? null;
    const depts = live?.departments ?? [];
    const meta =
      depts.find((d) => String(d.id).toLowerCase() === wantId) ||
      depts.find((d) => String(d.short || "").toLowerCase() === wantId) || null;
    const entity = (meta?.id ?? wantId).toLowerCase();
    const subLabelMap = new Map((meta?.subdivisions ?? []).map((s) => [s.id, s.label]));
    const gameRankLabel = new Map((meta?.ranks ?? []).map((r) => [r.id, r.label]));

    // ---- duty session aggregates for the window --------------------------
    const ranged = range && Number.isFinite(range.from) && Number.isFinite(range.to);
    const where = ["entity = $1"];
    const params = [entity];
    if (ranged) { where.push("started_at BETWEEN $2 AND $3"); params.push(Math.floor(range.from), Math.floor(range.to)); }
    const clause = where.join(" AND ");

    const totals = await query(
      `SELECT license, SUM(COALESCE(seconds,0)) AS total, COUNT(*) AS sessions, MAX(started_at) AS last_on
       FROM fivem_duty_sessions WHERE ${clause} GROUP BY license`, params);
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

    // one duty row per license, indexed by callsign for roster matching
    const dutyByLicense = new Map();
    const licenses = new Set([...totals.map((r) => r.license), ...liveBy.keys()]);
    for (const license of licenses) {
      const t = totals.find((r) => r.license === license);
      const l = latestBy.get(license) || {};
      const u = liveBy.get(license);
      const liveSecs = u ? Math.max(0, nowSec - Number(u.since)) : 0;
      dutyByLicense.set(license, {
        callsign: u?.callsign ?? l.callsign ?? null,
        name: u?.name ?? l.name ?? "Unknown",
        rank: u?.rank ?? l.rank ?? null,
        subdivision: u?.subdivision ?? l.subdivision ?? null,
        totalSeconds: Number(t?.total || 0) + liveSecs,
        sessions: Number(t?.sessions || 0),
        lastOn: Number(t?.last_on || (u ? u.since : 0)),
        onDutyNow: !!u,
      });
    }
    const dutyByCallsign = new Map();
    for (const d of dutyByLicense.values()) if (d.callsign) dutyByCallsign.set(normCallsign(d.callsign), d);

    // ---- the community roster: the full department membership -------------
    let rosterMembers = [];
    let rankRows = [];
    try {
      rosterMembers = await query(
        `SELECT character_name, display_name, rank_label, callsign, status
         FROM roster_members WHERE lower(department) = $1`, [wantId]);
      rankRows = await query(
        `SELECT rank_label, MAX(sort_order) AS sort_order
         FROM roster_role_map WHERE lower(coalesce(department,'')) = $1 AND kind = 'rank'
         GROUP BY rank_label ORDER BY MAX(sort_order) DESC`, [wantId]);
    } catch { /* roster not provisioned — fall back to duty-only members */ }

    // nothing anywhere → the page is genuinely waiting on the game
    if (rosterMembers.length === 0 && dutyByLicense.size === 0 && !live) {
      return { ok: false, code: "NO_DATA_YET", department: null, members: [], ranks: [], subdivisions: [] };
    }

    const usedCallsign = new Set();
    const members = [];

    // 1) every roster member, hours overlaid by callsign (0 until they clock in)
    for (const rm of rosterMembers) {
      const key = rm.callsign ? normCallsign(rm.callsign) : null;
      const d = key ? dutyByCallsign.get(key) : null;
      if (d && key) usedCallsign.add(key);
      members.push({
        name: rm.display_name || rm.character_name || d?.name || "Unknown",
        callsign: rm.callsign || d?.callsign || null,
        rank: rm.rank_label || "Unranked",
        rankLabel: rm.rank_label || "Unranked",
        subLabel: d ? (subLabelMap.get(d.subdivision) ?? null) : null,
        totalSeconds: d?.totalSeconds || 0,
        sessions: d?.sessions || 0,
        lastOn: d?.lastOn || 0,
        onDutyNow: d?.onDutyNow || false,
        status: rm.status || null,
      });
    }

    // 2) anyone who clocked in but isn't matched to a roster member
    const extraRanks = new Set();
    for (const d of dutyByLicense.values()) {
      const key = d.callsign ? normCallsign(d.callsign) : null;
      if (key && usedCallsign.has(key)) continue;
      const rl = gameRankLabel.get(d.rank) || "Unranked";
      extraRanks.add(rl);
      members.push({
        name: d.name, callsign: d.callsign, rank: rl, rankLabel: rl,
        subLabel: subLabelMap.get(d.subdivision) ?? null,
        totalSeconds: d.totalSeconds, sessions: d.sessions, lastOn: d.lastOn, onDutyNow: d.onDutyNow, status: null,
      });
    }

    // ranks list: roster ranks (senior first) + any extras from duty-only rows
    const ranks = rankRows.map((r) => ({ id: r.rank_label, label: r.rank_label }));
    const seen = new Set(ranks.map((r) => r.id));
    for (const rl of extraRanks) if (!seen.has(rl)) { ranks.push({ id: rl, label: rl }); seen.add(rl); }
    if (members.some((m) => m.rank === "Unranked") && !seen.has("Unranked")) ranks.push({ id: "Unranked", label: "Unranked" });

    return {
      ok: true,
      generatedAt: live?.generatedAt ?? nowSec,
      from: ranged ? Math.floor(range.from) : null,
      to: ranged ? Math.floor(range.to) : null,
      department: meta ? { id: meta.id, label: meta.label, short: meta.short } : { id: deptId },
      ranks,
      subdivisions: meta?.subdivisions ?? [],
      members,
      unmatched: members.length === 0,
    };
  } catch (err) {
    return { ok: false, code: "DB_ERROR", message: err.message, department: null, members: [], ranks: [], subdivisions: [] };
  }
}
