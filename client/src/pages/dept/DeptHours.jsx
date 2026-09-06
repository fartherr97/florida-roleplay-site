import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, RefreshCw, Search, Users } from "lucide-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import DeptPageHeader from "../../components/dept/DeptPageHeader";
import { formatDate, relativeTime } from "../../lib/format";
import { api } from "../../lib/api";

const RANGE_PRESETS = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range…" },
];

/** Resolve a preset / custom dates to a { from, to } window in unix seconds. */
function computeRange(preset, from, to) {
  const nowSec = Math.floor(Date.now() / 1000);
  if (preset === "7d") return { from: nowSec - 7 * 86400, to: nowSec };
  if (preset === "30d") return { from: nowSec - 30 * 86400, to: nowSec };
  if (preset === "month") {
    const d = new Date();
    return { from: Math.floor(new Date(d.getFullYear(), d.getMonth(), 1).getTime() / 1000), to: nowSec };
  }
  if (preset === "custom") {
    if (!from || !to) return null;
    const f = Math.floor(new Date(`${from}T00:00:00`).getTime() / 1000);
    const t = Math.floor(new Date(`${to}T23:59:59`).getTime() / 1000);
    if (!Number.isFinite(f) || !Number.isFinite(t) || f > t) return null;
    return { from: f, to: t };
  }
  return null; // "all"
}

/** Seconds → "12h 30m" / "45m" / "8s". */
function fmtDuration(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
const toHours = (seconds) => Math.round(((Number(seconds) || 0) / 3600) * 10) / 10;

/** Turn the failure code from the server into a plain-English cause + fix. */
function diagnose(code) {
  if (code === "FXSERVER_UNSET" || code === "OFFLINE")
    return "The site isn’t configured to reach the game yet — set FXSERVER_SYNC_URL and FXSERVER_SYNC_SECRET in the site environment.";
  if (code === "FXSERVER_UNREACHABLE")
    return "The site reached out but the game server didn’t answer — the game’s flrp_api HTTP port isn’t reachable from the site (firewall / not exposed), or FXSERVER_SYNC_URL is wrong.";
  if (code === "FXSERVER_HTTP_404")
    return "The game answered, but the /duty/hours endpoint is missing — restart flrp_api on the game so the new route loads.";
  if (code === "FXSERVER_HTTP_401")
    return "The game rejected the request — FXSERVER_SYNC_SECRET must exactly match the game’s flrp_api_shared_secret.";
  if (code === "FXSERVER_HTTP_503")
    return "The game’s flrp_api isn’t configured (its flrp_api_shared_secret is unset) or the duty system isn’t running.";
  return "The site can’t reach the game’s duty API right now. Once the FiveM duty endpoint is reachable, hours appear here automatically.";
}

const SORTS = [
  { value: "hours", label: "Most hours" },
  { value: "name", label: "Name (A–Z)" },
  { value: "recent", label: "Recently on duty" },
  { value: "sessions", label: "Most sessions" },
];

export default function DeptHours({ page, config }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [rank, setRank] = useState("all");
  const [sub, setSub] = useState("all");
  const [onlyOnDuty, setOnlyOnDuty] = useState(false);
  const [sort, setSort] = useState("hours");
  const [grouped, setGrouped] = useState(true);

  const [preset, setPreset] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const range = useMemo(() => computeRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const rangeKey = range ? `${range.from}:${range.to}` : "all";

  const load = useCallback(async (soft) => {
    if (soft) setRefreshing(true); else setLoading(true);
    const res = await api.deptDutyHours(config.id, range).catch(() => null);
    setData(res);
    setLoading(false);
    setRefreshing(false);
    // range is captured via rangeKey below; recreated only when the window changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.id, rangeKey]);
  useEffect(() => { load(false); }, [load]);
  useEffect(() => {
    const t = setInterval(() => load(true), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const members = useMemo(() => data?.members ?? [], [data]);
  const ranks = useMemo(() => data?.ranks ?? [], [data]);
  const subs = useMemo(() => data?.subdivisions ?? [], [data]);

  const rankLabel = useMemo(() => {
    const m = new Map(ranks.map((r) => [r.id, r.label]));
    return (id) => m.get(id) || id || "—";
  }, [ranks]);
  const rankOrder = useMemo(() => new Map(ranks.map((r, i) => [r.id, i])), [ranks]);

  const stats = useMemo(() => {
    const totalSeconds = members.reduce((s, m) => s + (Number(m.totalSeconds) || 0), 0);
    const onNow = members.filter((m) => m.onDutyNow).length;
    return {
      hours: toHours(totalSeconds),
      people: members.length,
      onNow,
      average: members.length ? Math.round((toHours(totalSeconds) / members.length) * 10) / 10 : 0,
    };
  }, [members]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = members.filter((m) => {
      if (onlyOnDuty && !m.onDutyNow) return false;
      if (rank !== "all" && m.rank !== rank) return false;
      if (sub !== "all") {
        if (sub === "__none" ? m.subdivision : m.subdivision !== sub) return false;
      }
      if (q && !(`${m.name} ${m.callsign ?? ""}`.toLowerCase().includes(q))) return false;
      return true;
    });
    const cmp = {
      hours: (a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0),
      sessions: (a, b) => (b.sessions || 0) - (a.sessions || 0),
      recent: (a, b) => (b.lastOn || 0) - (a.lastOn || 0),
      name: (a, b) => String(a.name).localeCompare(String(b.name)),
    }[sort];
    return [...list].sort(cmp);
  }, [members, search, rank, sub, onlyOnDuty, sort]);

  const groups = useMemo(() => {
    if (!grouped) return null;
    const by = new Map();
    for (const m of filtered) {
      const key = m.rank || "__none";
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(m);
    }
    return [...by.entries()]
      .sort((a, b) => (rankOrder.get(a[0]) ?? 999) - (rankOrder.get(b[0]) ?? 999))
      .map(([id, list]) => ({
        id,
        label: id === "__none" ? "Unranked" : rankLabel(id),
        list,
        seconds: list.reduce((s, m) => s + (Number(m.totalSeconds) || 0), 0),
      }));
  }, [filtered, grouped, rankOrder, rankLabel]);

  const subOptions = [
    { value: "all", label: "All subdivisions" },
    ...subs.map((s) => ({ value: s.id, label: s.label })),
    { value: "__none", label: "No subdivision" },
  ];
  const rankOptions = [{ value: "all", label: "All ranks" }, ...ranks.map((r) => ({ value: r.id, label: r.label }))];

  const unavailable = data && data.ok === false;
  const unmatched = data && data.ok === true && data.unmatched;
  const colCount = 5 + (grouped ? 0 : 1) + (subs.length > 0 ? 1 : 0);

  return (
    <>
      <DeptPageHeader
        icon={page.icon}
        eyebrow={config.branding?.shortName}
        title={page.label}
        subtitle="Live on-duty time pulled from the in-game duty system."
      />

      {/* stats */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Hours logged", value: `${stats.hours}h` },
          { label: "Members", value: stats.people },
          { label: "On duty now", value: stats.onNow },
          { label: "Avg / member", value: `${stats.average}h` },
        ].map((s) => (
          <Card key={s.label} className="p-5">
            <div className="dept-accent-text text-2xl font-extrabold tracking-tight tabular-nums">{s.value}</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* timeframe */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Timeframe</span>
        <Select value={preset} onChange={setPreset} options={RANGE_PRESETS} className="min-w-[150px]" />
        {preset === "custom" && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.02] px-3 text-sm text-slate-200 [color-scheme:dark]" />
            <span className="text-slate-500">→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.02] px-3 text-sm text-slate-200 [color-scheme:dark]" />
          </>
        )}
        {data?.from && data?.to ? (
          <span className="text-[11px] text-slate-500">
            Shifts started {formatDate(data.from * 1000)} – {formatDate(data.to * 1000)}
          </span>
        ) : (
          <span className="text-[11px] text-slate-500">All recorded shifts</span>
        )}
      </div>

      {/* controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <TextInput className="!h-10 pl-9" placeholder="Search name or callsign…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={rank} onChange={setRank} options={rankOptions} className="min-w-[150px]" />
        {subs.length > 0 && <Select value={sub} onChange={setSub} options={subOptions} className="min-w-[160px]" />}
        <Select value={sort} onChange={setSort} options={SORTS} className="min-w-[170px]" />
        <button type="button" onClick={() => setOnlyOnDuty((v) => !v)}
          className={`h-10 rounded-xl border px-3 text-sm font-semibold transition-colors ${onlyOnDuty ? "border-green-500/50 bg-green-500/10 text-green-300" : "border-white/10 text-slate-300 hover:bg-white/5"}`}>
          On duty now
        </button>
        <button type="button" onClick={() => setGrouped((v) => !v)}
          className={`h-10 rounded-xl border px-3 text-sm font-semibold transition-colors ${grouped ? "dept-accent-text border-white/25 bg-white/[0.05]" : "border-white/10 text-slate-300 hover:bg-white/5"}`}>
          Group by rank
        </button>
        <button type="button" onClick={() => load(true)} title="Refresh"
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-slate-300 hover:bg-white/5">
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* body */}
      {loading ? (
        <Card className="p-10 text-center text-sm text-slate-400">Loading duty hours…</Card>
      ) : unavailable ? (
        <Card className="p-10 text-center">
          <Clock className="mx-auto mb-3 size-6 text-slate-500" />
          <div className="text-sm font-semibold text-slate-200">Live duty data isn’t connected yet</div>
          <div className="mx-auto mt-1 max-w-md text-xs text-slate-500">{diagnose(data?.code)}</div>
          {data?.code && (
            <div className="mx-auto mt-3 inline-block rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-1 font-mono text-[11px] text-slate-400">
              {data.code}
            </div>
          )}
        </Card>
      ) : unmatched ? (
        <Card className="p-10 text-center">
          <div className="text-sm font-semibold text-slate-200">No in-game department linked</div>
          <div className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            The game has no duty department with the id “{config.id}”. Match this hub’s id to a department
            in the game’s <code className="text-slate-400">/duty config</code>, and its hours show here.
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-400">
          {members.length === 0 ? "No duty time logged yet." : "No members match these filters."}
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                <th className="px-4 py-2.5">Member</th>
                <th className="px-3 py-2.5">Callsign</th>
                {!grouped && <th className="px-3 py-2.5">Rank</th>}
                {subs.length > 0 && <th className="px-3 py-2.5">Subdivision</th>}
                <th className="px-3 py-2.5 text-right">Hours</th>
                <th className="px-3 py-2.5 text-right">Sessions</th>
                <th className="px-3 py-2.5">Last on duty</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            {grouped ? (
              groups.map((g) => (
                <tbody key={g.id}>
                  <tr className="bg-white/[0.02]">
                    <td colSpan={colCount} className="px-4 py-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{g.label}</span>
                      <span className="ml-2 text-[11px] text-slate-500">{g.list.length} · {fmtDuration(g.seconds)}</span>
                    </td>
                  </tr>
                  {g.list.map((m, i) => <Row key={m.name + i} m={m} showRank={false} showSub={subs.length > 0} />)}
                </tbody>
              ))
            ) : (
              <tbody>
                {filtered.map((m, i) => <Row key={m.name + i} m={m} showRank showSub={subs.length > 0} rankLabel={rankLabel} />)}
              </tbody>
            )}
          </table>
        </Card>
      )}

      {data?.generatedAt && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
          <Users className="size-3" />
          Live from the in-game duty system · updated {relativeTime(data.generatedAt * 1000)}
        </div>
      )}
    </>
  );
}

function Row({ m, showRank, showSub, rankLabel }) {
  return (
    <tr className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
      <td className="px-4 py-2.5 font-medium text-slate-100">{m.name}</td>
      <td className="px-3 py-2.5 tabular-nums text-slate-300">{m.callsign || "—"}</td>
      {showRank && <td className="px-3 py-2.5 text-slate-300">{rankLabel ? rankLabel(m.rank) : m.rankLabel || "—"}</td>}
      {showSub && <td className="px-3 py-2.5 text-slate-400">{m.subLabel || "—"}</td>}
      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-100">{fmtDuration(m.totalSeconds)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{m.sessions || 0}</td>
      <td className="px-3 py-2.5 text-slate-400">{m.lastOn ? relativeTime(m.lastOn * 1000) : "—"}</td>
      <td className="px-3 py-2.5">
        {m.onDutyNow ? <Badge tone="green" dot>On duty</Badge> : <span className="text-xs text-slate-500">Off</span>}
      </td>
    </tr>
  );
}
