import { useEffect, useMemo, useState } from "react";
import { Clock, RefreshCw, Search, Users } from "lucide-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import DeptPageHeader from "../../components/dept/DeptPageHeader";
import { relativeTime } from "../../lib/format";
import { api } from "../../lib/api";

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

  const load = async (soft) => {
    if (soft) setRefreshing(true); else setLoading(true);
    const res = await api.deptDutyHours(config.id).catch(() => null);
    setData(res);
    setLoading(false);
    setRefreshing(false);
  };
  useEffect(() => { load(false); /* eslint-disable-next-line */ }, [config.id]);
  useEffect(() => {
    const t = setInterval(() => load(true), 30_000);
    return () => clearInterval(t);
    /* eslint-disable-next-line */
  }, [config.id]);

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
          <div className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            The site can’t reach the game’s duty API right now. Once the FiveM server’s duty endpoint is
            reachable (FXSERVER_SYNC_URL / FXSERVER_SYNC_SECRET), hours appear here automatically.
          </div>
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
