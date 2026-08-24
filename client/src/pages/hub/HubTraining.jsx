import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { cn } from "../../lib/cn";
import { training as seedTraining, STAFF_TEAMS } from "../../data/staffHubData";

/**
 * Days between a date and `now`.
 *
 * `now` is passed in rather than read here: a clock read during render makes the
 * day count slide while somebody reads the table, and the row that was 29 days
 * old at the top of the page is 30 by the time they scroll to it.
 */
function daysSince(iso, now) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((now - then) / 86_400_000);
}

/**
 * Who is in training, who is training them, and how long it has been running.
 *
 * The number that matters is the days column. A trial who has been shadowing for
 * six weeks is either being neglected or is not going to make it, and both need
 * somebody to notice — so anything past the threshold is flagged rather than
 * left for a supervisor to work out by subtracting dates in their head.
 */
const LONG_RUNNING_DAYS = 30;

export default function HubTraining() {
  const [training, setTraining] = useState(seedTraining);
  const [roster, setRoster] = useState([]);
  // Stamped once, so every row is measured against the same moment.
  const [asOf] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    api.hubTraining().then((data) => {
      if (active && Array.isArray(data) && data.length) setTraining(data);
    }).catch(() => {});
    api.hubRoster().then((data) => {
      if (active && Array.isArray(data)) setRoster(data);
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(
    () =>
      training
        .map((entry) => ({ ...entry, days: daysSince(entry.since, asOf) }))
        .sort((a, b) => (b.days ?? 0) - (a.days ?? 0)),
    [training, asOf],
  );

  const trials = useMemo(
    () => roster.filter((member) => member.team === "trial-mod" || member.rankId === "trial_mod"),
    [roster],
  );

  const overdue = rows.filter((r) => (r.days ?? 0) >= LONG_RUNNING_DAYS);

  return (
    <>
      <HubPageHeader
        icon="GraduationCap"
        eyebrow="Staff Hub"
        title="Training Dashboard"
        subtitle="Every trial moderator currently being trained, who has them, and how long it has been running."
        actions={
          <Button as={Link} to="/staff-hub/trial-checklist" variant="secondary" size="sm">
            The checklist
            <ArrowRight className="size-4" />
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="In training" value={rows.length} />
        <Stat label="Trial moderators on the roster" value={trials.length} />
        <Stat
          label={`Running over ${LONG_RUNNING_DAYS} days`}
          value={overdue.length}
          tone={overdue.length ? "amber" : undefined}
        />
      </div>

      {overdue.length > 0 && (
        <Card className="mb-6 p-5 ring-1 ring-inset ring-amber-400/25">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
            <GraduationCap className="size-4" />
            {overdue.length === 1 ? "One trial has" : `${overdue.length} trials have`} been in
            training over {LONG_RUNNING_DAYS} days
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">
            {overdue.map((r) => r.trainee).join(", ")}. Either they need a decision or their
            trainer needs help — both want somebody to look.
          </p>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <p className="text-sm font-bold text-white">Current pairings</p>
        </div>
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">Nobody is in training.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-[0.68rem] uppercase tracking-[0.14em] text-slate-500">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-5 py-3 font-bold">Trainee</th>
                  <th className="px-3 py-3 font-bold">Trainer</th>
                  <th className="px-3 py-3 font-bold">Since</th>
                  <th className="px-5 py-3 text-right font-bold">Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {rows.map((entry) => (
                  <tr key={entry.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5 font-semibold text-white">{entry.trainee}</td>
                    <td className="px-3 py-3.5 text-slate-300">{entry.admin}</td>
                    <td className="px-3 py-3.5 text-slate-500">{formatDate(entry.since)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Badge tone={(entry.days ?? 0) >= LONG_RUNNING_DAYS ? "amber" : "slate"}>
                        {entry.days ?? "—"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-6 p-6">
        <p className="text-sm font-bold text-white">The bands they move through</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-400">
          A trial who passes moves into the moderation team and out of this list.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {STAFF_TEAMS.slice().reverse().map((team) => (
            <span
              key={team.id}
              className="rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
              style={{
                color: team.color,
                backgroundColor: `${team.color}1a`,
                borderColor: `${team.color}4d`,
              }}
            >
              {team.label}
            </span>
          ))}
        </div>
      </Card>
    </>
  );
}

function Stat({ label, value, tone }) {
  return (
    <Card className="p-5">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={cn("mt-1 text-3xl font-black tabular-nums", tone === "amber" ? "text-amber-300" : "text-white")}>
        {value}
      </p>
    </Card>
  );
}
