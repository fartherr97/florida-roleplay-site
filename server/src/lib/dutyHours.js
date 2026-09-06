/**
 * Duty-hours feed from the FiveM server.
 *
 * The game's flrp_api exposes GET /duty/hours (see the flrp-server repo,
 * resources/[flrp]/flrp_api and flrp_onduty:GetHoursReport). It returns every
 * department's aggregated on-duty time — total logged seconds, session counts,
 * who is on duty right now — plus each department's rank and subdivision lists,
 * so a department hub's Hours page can group, filter and sort.
 *
 * We reach it with the same machine credentials the config-sync push uses
 * (FXSERVER_SYNC_URL + FXSERVER_SYNC_SECRET) and cache the whole report briefly
 * so a busy hub page doesn't hammer the game server. A department page picks its
 * own slice out of the cached report.
 */
const TTL_MS = 15_000;
const cache = new Map(); // rangeKey -> { at, data }

/**
 * Fetch (and cache) the whole duty-hours report from the FiveM server. An
 * optional { from, to } (unix seconds) asks the game for shifts started in that
 * window only; each distinct range is cached on its own short TTL.
 */
export async function fetchDutyReport({ from, to } = {}) {
  const base = process.env.FXSERVER_SYNC_URL;
  const secret = process.env.FXSERVER_SYNC_SECRET;
  if (!base || !secret) return { ok: false, code: "FXSERVER_UNSET" };

  const ranged = Number.isFinite(from) && Number.isFinite(to);
  const key = ranged ? `${from}:${to}` : "all";
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.data;

  let url = `${base.replace(/\/+$/, "")}/duty/hours`;
  if (ranged) url += `?from=${from}&to=${to}`;
  try {
    const res = await fetch(url, {
      headers: { "X-FLRP-Secret": secret },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { ok: false, code: `FXSERVER_HTTP_${res.status}` };
    const json = await res.json();
    const data = {
      ok: true, generatedAt: json.generatedAt ?? null,
      from: json.from ?? null, to: json.to ?? null,
      departments: json.departments ?? [],
    };
    cache.set(key, { at: now, data });
    return data;
  } catch (err) {
    return { ok: false, code: "FXSERVER_UNREACHABLE", message: err.message };
  }
}

/** The duty-hours slice for one department (matched by id, then short code). */
export async function fetchDeptDutyHours(deptId, range) {
  const report = await fetchDutyReport(range);
  if (!report.ok) {
    return { ok: false, code: report.code, department: null, members: [], ranks: [], subdivisions: [] };
  }
  const want = String(deptId || "").toLowerCase();
  const list = report.departments || [];
  const match =
    list.find((d) => String(d.id).toLowerCase() === want) ||
    list.find((d) => String(d.short || "").toLowerCase() === want) ||
    null;

  if (!match) {
    // The game has no department with this id — the site dept just isn't linked.
    return {
      ok: true, unmatched: true, generatedAt: report.generatedAt,
      from: report.from ?? null, to: report.to ?? null,
      department: null, members: [], ranks: [], subdivisions: [],
    };
  }
  return {
    ok: true,
    generatedAt: report.generatedAt,
    from: report.from ?? null, to: report.to ?? null,
    department: { id: match.id, label: match.label, short: match.short },
    ranks: match.ranks || [],
    subdivisions: match.subdivisions || [],
    members: match.members || [],
  };
}
