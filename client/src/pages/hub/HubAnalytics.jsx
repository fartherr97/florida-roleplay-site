import { useEffect, useMemo, useState } from "react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";
import { ACTION_TYPES, actionLabel, actionTone, bodyLabel, isVerbal, sourceOf } from "../../lib/discipline";
import { OPEN_STATUSES, statusLabel, statusTone, typeLabel } from "../../lib/support";

const WINDOWS = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "6 months" },
];

/**
 * What the team has actually been doing, across the surfaces that record it.
 *
 * Everything here is counted from rows that already exist — disciplinary
 * actions, support tickets, the roster. Nothing is a metric invented for a
 * dashboard, because a number nobody can trace back to a row is a number nobody
 * trusts the second it looks wrong.
 */
export default function HubAnalytics() {
  const [days, setDays] = useState(30);
  const [actions, setActions] = useState(null);
  const [tickets, setTickets] = useState(null);
  const [roster, setRoster] = useState([]);
  // Stamped once, so the window boundary does not slide while somebody reads.
  const [asOf] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    api.disciplinaryActions().then((d) => active && setActions(d.actions ?? [])).catch(() => active && setActions([]));
    api.supportTickets().then((d) => active && setTickets(d.tickets ?? [])).catch(() => active && setTickets([]));
    api.hubRoster().then((d) => active && setRoster(Array.isArray(d) ? d : [])).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const since = asOf - days * 86_400_000;
  const inWindow = (iso) => new Date(iso).getTime() >= since;

  const da = useMemo(() => {
    const list = (actions ?? []).filter((a) => inWindow(a.createdAt) && !a.voided);
    return {
      total: list.length,
      verbal: list.filter((a) => isVerbal(a.type)).length,
      staff: list.filter((a) => sourceOf(a.bodyId) === "staff").length,
      byType: ACTION_TYPES.map((type) => ({
        ...type,
        count: list.filter((a) => a.type === type.id).length,
      })).filter((t) => t.count > 0),
      byBody: Object.entries(
        list.reduce((acc, a) => ({ ...acc, [a.bodyId]: (acc[a.bodyId] ?? 0) + 1 }), {}),
      ).sort((a, b) => b[1] - a[1]),
      // Who is filing them. A team where one person writes every action is a
      // team with one person doing the unpleasant half of the job.
      byIssuer: Object.entries(
        list.reduce((acc, a) => ({ ...acc, [a.issuedByName]: (acc[a.issuedByName] ?? 0) + 1 }), {}),
      ).sort((a, b) => b[1] - a[1]).slice(0, 6),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, days, asOf]);

  const support = useMemo(() => {
    const list = tickets ?? [];
    const recent = list.filter((t) => inWindow(t.createdAt));
    return {
      opened: recent.length,
      live: list.filter((t) => OPEN_STATUSES.includes(t.status)).length,
      unassigned: list.filter((t) => OPEN_STATUSES.includes(t.status) && !t.assignedToDiscordId).length,
      byStatus: Object.entries(
        list.reduce((acc, t) => ({ ...acc, [t.status]: (acc[t.status] ?? 0) + 1 }), {}),
      ).sort((a, b) => b[1] - a[1]),
      byType: Object.entries(
        recent.reduce((acc, t) => ({ ...acc, [t.type]: (acc[t.type] ?? 0) + 1 }), {}),
      ).sort((a, b) => b[1] - a[1]),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, days, asOf]);

  const staff = useMemo(() => {
    const active = roster.filter((m) => m.status === "Active").length;
    return { total: roster.length, active, loa: roster.filter((m) => m.status === "LOA").length };
  }, [roster]);

  const loading = actions === null || tickets === null;

  return (
    <>
      <HubPageHeader
        icon="ChartColumn"
        eyebrow="Staff Hub"
        title="Analytics"
        subtitle="Counted from what the portal actually recorded — disciplinary actions, support tickets and the roster. Nothing here is a number you cannot trace to a row."
        actions={
          <div className="flex gap-2">
            {WINDOWS.map((w) => (
              <button
                key={w.value}
                type="button"
                onClick={() => setDays(w.value)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition",
                  days === w.value
                    ? "bg-primary-500/15 text-white ring-primary-400/40"
                    : "bg-black/20 text-slate-400 ring-white/[0.06] hover:text-white",
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Actions filed" value={da.total} sub={`${da.verbal} verbal · ${da.total - da.verbal} on paper`} />
            <Stat label="Tickets opened" value={support.opened} sub={`${support.live} still live`} />
            <Stat
              label="Nobody on it"
              value={support.unassigned}
              sub={support.unassigned ? "waiting to be picked up" : "queue is clear"}
              tone={support.unassigned > 0 ? "amber" : "green"}
            />
            <Stat label="Staff roster" value={staff.total} sub={`${staff.active} active · ${staff.loa} on leave`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Disciplinary actions by type">
              {da.byType.length === 0 ? (
                <Empty>Nothing filed in this window.</Empty>
              ) : (
                da.byType.map((type) => (
                  <Bar key={type.id} label={actionLabel(type.id)} value={type.count} total={da.total} tone={actionTone(type.id)} />
                ))
              )}
            </Panel>

            <Panel title="Who filed them">
              {da.byIssuer.length === 0 ? (
                <Empty>Nothing filed in this window.</Empty>
              ) : (
                da.byIssuer.map(([name, count]) => (
                  <Bar key={name} label={name} value={count} total={da.total} tone="brand" />
                ))
              )}
            </Panel>

            <Panel title="Actions by body">
              {da.byBody.length === 0 ? (
                <Empty>Nothing filed in this window.</Empty>
              ) : (
                da.byBody.map(([body, count]) => (
                  <Bar key={body} label={bodyLabel(body)} value={count} total={da.total} tone="primary" />
                ))
              )}
            </Panel>

            <Panel title="Tickets by type">
              {support.byType.length === 0 ? (
                <Empty>None opened in this window.</Empty>
              ) : (
                support.byType.map(([type, count]) => (
                  <Bar key={type} label={typeLabel(type)} value={count} total={support.opened} tone="green" />
                ))
              )}
            </Panel>
          </div>

          <Panel title="Where the tickets stand" className="mt-6">
            <div className="flex flex-wrap gap-2">
              {support.byStatus.map(([status, count]) => (
                <Badge key={status} tone={statusTone(status)}>
                  {statusLabel(status)} · {count}
                </Badge>
              ))}
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

function Stat({ label, value, sub, tone }) {
  return (
    <Card className="p-5">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p
        className={cn(
          "mt-1 text-3xl font-black tabular-nums",
          tone === "amber" ? "text-amber-300" : tone === "green" ? "text-emerald-300" : "text-white",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}

function Panel({ title, children, className }) {
  return (
    <Card className={cn("p-6", className)}>
      <p className="mb-4 text-sm font-bold text-white">{title}</p>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

function Empty({ children }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

const BAR_TONES = {
  amber: "bg-amber-500", primary: "bg-primary-500", brand: "bg-brand-500",
  green: "bg-emerald-500", rose: "bg-rose-500", violet: "bg-violet-500", slate: "bg-slate-500",
};

function Bar({ label, value, total, tone }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-slate-300">{label}</span>
        <span className="shrink-0 tabular-nums text-slate-500">
          {value} <span className="text-slate-600">· {pct}%</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={cn("h-full rounded-full", BAR_TONES[tone] ?? BAR_TONES.slate)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
