import { useEffect, useState } from "react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import StatTile from "../../components/hub/StatTile";
import { api } from "../../lib/api";
import { dashboard as seedDashboard } from "../../data/staffHubData";

/** Activity overview for the team — volumes, response time and a weekly shape. */
export default function HubDashboard() {
  const [data, setData] = useState(seedDashboard);

  useEffect(() => {
    let active = true;
    api.hubDashboard().then((next) => {
      if (active && next) setData(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const totals = data.totals ?? {};
  const week = data.weeklyClaims ?? [];
  const peak = Math.max(1, ...week.map((d) => d.claims));

  return (
    <>
      <HubPageHeader
        icon="ChartColumn"
        title="Staff Dashboard"
        subtitle="How the team is tracking this week — claim volume, response time and who is carrying the load."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile label="Active staff" value={totals.activeStaff} tone="white" />
        <StatTile label="On leave" value={totals.onLeave} tone="amber" />
        <StatTile label="Tickets open" value={totals.ticketsOpen} tone="primary" />
        <StatTile
          label="Closed (7 days)"
          value={totals.ticketsClosed7d}
          tone="green"
        />
        <StatTile
          label="Avg first response"
          value={totals.avgFirstResponse}
          tone="brand"
        />
        <StatTile
          label="Vest hours (7 days)"
          value={totals.vestHours7d}
          tone="white"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Tickets closed this week
          </h2>
          {/* A plain bar row rather than a chart library — seven values do not
              justify the dependency, and this stays legible at every width. */}
          <div className="mt-6 flex h-44 items-end gap-2 sm:gap-4">
            {week.map((day) => (
              <div key={day.day} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-bold text-slate-300">{day.claims}</span>
                <div
                  className="w-full rounded-t-lg bg-primary-500/70 transition-all duration-300 hover:bg-primary-400"
                  style={{ height: `${Math.round((day.claims / peak) * 100)}%` }}
                />
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  {day.day}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Top claimers this week
          </h2>
          <ol className="mt-4 space-y-2.5">
            {(data.leaderboard ?? []).map((entry, index) => (
              <li
                key={entry.name}
                className="flex items-center gap-3 rounded-xl bg-black/25 p-3.5 ring-1 ring-inset ring-white/[0.06]"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-[11px] font-bold text-primary-400 ring-1 ring-inset ring-white/10">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                  {entry.name}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold text-white">
                    {entry.claims}
                  </span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {entry.vestHours}h vest
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}
