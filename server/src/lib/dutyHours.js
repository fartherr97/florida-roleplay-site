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
let cache = { at: 0, data: null };

/** Fetch (and cache) the whole duty-hours report from the FiveM server. */
export async function fetchDutyReport() {
  const base = process.env.FXSERVER_SYNC_URL;
  const secret = process.env.FXSERVER_SYNC_SECRET;
  if (!base || !secret) return { ok: false, code: "FXSERVER_UNSET" };

  const now = Date.now();
  if (cache.data && now - cache.at < TTL_MS) return cache.data;

  const url = `${base.replace(/\/+$/, "")}/duty/hours`;
  try {
    const res = await fetch(url, {
      headers: { "X-FLRP-Secret": secret },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { ok: false, code: `FXSERVER_HTTP_${res.status}` };
    const json = await res.json();
    const data = { ok: true, generatedAt: json.generatedAt ?? null, departments: json.departments ?? [] };
    cache = { at: now, data };
    return data;
  } catch (err) {
    return { ok: false, code: "FXSERVER_UNREACHABLE", message: err.message };
  }
}

/** The duty-hours slice for one department (matched by id, then short code). */
export async function fetchDeptDutyHours(deptId) {
  const report = await fetchDutyReport();
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
      department: null, members: [], ranks: [], subdivisions: [],
    };
  }
  return {
    ok: true,
    generatedAt: report.generatedAt,
    department: { id: match.id, label: match.label, short: match.short },
    ranks: match.ranks || [],
    subdivisions: match.subdivisions || [],
    members: match.members || [],
  };
}
