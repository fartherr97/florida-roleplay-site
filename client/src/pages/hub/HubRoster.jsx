import { useEffect, useMemo, useState } from "react";
import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import Logo from "../../components/layout/Logo";
import RosterFilters from "../../components/roster/RosterFilters";
import RosterHeader from "../../components/roster/RosterHeader";
import RosterStats from "../../components/roster/RosterStats";
import RosterTable from "../../components/roster/RosterTable";
import StatusEditor, { StatusPill } from "../../components/hub/StatusEditor";
import { useAuth } from "../../context/useAuth";
import { api } from "../../lib/api";
import { roster as seedRoster, STAFF_TEAMS, training as seedTraining } from "../../data/staffHubData";
import { ACTIVITY_STATUSES, statusColor } from "../../data/rosterData";
import { SITE } from "../../data/mockData";
import { formatDate } from "../../lib/format";

const TEAM_OPTIONS = [
  { value: "all", label: "All teams" },
  ...STAFF_TEAMS.map((team) => ({ value: team.id, label: team.label })),
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...ACTIVITY_STATUSES.map((status) => ({ value: status.id, label: status.label })),
];

/**
 * The staff roster, grouped by team.
 *
 * Structured around positions rather than people: every team shows the seats it
 * is meant to have, including the ones nobody holds. A vacant Junior
 * Administrator slot is the sort of thing a roster exists to surface, so it
 * renders greyed out rather than being filtered away.
 */
export default function HubRoster() {
  const { hasPermission } = useAuth();
  const [members, setMembers] = useState(seedRoster);
  const [training, setTraining] = useState(seedTraining);
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const canEditStatus = hasPermission("roster.edit_status");
  const canManageLoa = hasPermission("roster.manage_loa");

  useEffect(() => {
    let active = true;
    Promise.all([api.hubRoster(), api.hubTraining()]).then(([next, nextTraining]) => {
      if (!active) return;
      if (next?.length) setMembers(next);
      if (nextTraining?.length) setTraining(nextTraining);
    });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const staffed = useMemo(() => members.filter((member) => !member.vacant), [members]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => {
      if (team !== "all" && member.team !== team) return false;
      // A vacancy has no status to match, so any status filter hides it — the
      // filtered view is about people, and an unfiltered view is about seats.
      if (status !== "all" && member.status !== status) return false;
      if (!needle) return true;
      return [member.name, member.handle, member.callsign, member.position, member.discordId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [members, query, status, team]);

  const groups = useMemo(
    () =>
      STAFF_TEAMS.map((entry) => ({
        id: entry.id,
        label: entry.label,
        color: entry.color,
        rows: matches.filter((member) => member.team === entry.id),
      })).filter((group) => group.rows.length > 0),
    [matches],
  );

  const counts = useMemo(
    () =>
      ACTIVITY_STATUSES.map((entry) => ({
        label: entry.label,
        value: staffed.filter((member) => member.status === entry.id).length,
        color: entry.color,
      })).filter((entry) => entry.value > 0),
    [staffed],
  );

  const online = useMemo(() => staffed.filter((member) => member.online), [staffed]);

  const columns = [
    {
      key: "callsign",
      label: "Callsign",
      width: "w-24",
      render: (row) => (
        <span className={row.vacant ? "text-slate-500" : "font-bold text-primary-400"}>
          {row.callsign || "—"}
        </span>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row) =>
        row.vacant ? (
          <span className="italic text-slate-500">Vacant</span>
        ) : (
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">{row.name}</p>
            <p className="truncate text-xs text-slate-500">@{row.handle}</p>
          </div>
        ),
    },
    {
      key: "position",
      label: "Position",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-brand-300">{row.position}</p>
          {row.positionNote && (
            <p className="truncate text-xs text-slate-500">{row.positionNote}</p>
          )}
        </div>
      ),
    },
    {
      key: "discordId",
      label: "Discord UID",
      hideBelow: "2xl",
      render: (row) =>
        row.discordId ? (
          <code className="text-[11px] text-slate-500">{row.discordId}</code>
        ) : (
          <span className="text-slate-600">—</span>
        ),
    },
    {
      key: "hired",
      label: "Hired",
      hideBelow: "lg",
      render: (row) =>
        row.hired ? (
          <span className="whitespace-nowrap text-slate-400">{formatDate(row.hired)}</span>
        ) : (
          <span className="text-slate-600">—</span>
        ),
    },
    {
      key: "lastMove",
      label: "Last move",
      hideBelow: "xl",
      render: (row) =>
        row.lastMove ? (
          <span className="whitespace-nowrap text-slate-400">{formatDate(row.lastMove)}</span>
        ) : (
          <span className="text-slate-600">—</span>
        ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) =>
        row.vacant ? (
          <span className="text-slate-600">—</span>
        ) : (
          <StatusPill member={row} editable={canEditStatus} onEdit={setEditing} />
        ),
    },
    {
      key: "notes",
      label: "Notes",
      hideBelow: "2xl",
      render: (row) =>
        row.notes ? (
          <span className="block max-w-56 truncate text-xs text-slate-400" title={row.notes}>
            {row.notes}
          </span>
        ) : (
          <span className="text-slate-600">—</span>
        ),
    },
  ];

  const saveStatus = async (payload) => {
    // The API answers with a message when the write did not land — a member who
    // has never been synced has no record to update. Discarding it would show
    // the new status until the next reload and then quietly revert.
    const result = await api.updateRosterStatus(payload.id, payload);
    setNotice(result?.message ?? "");
    setReloadKey((key) => key + 1);
  };

  return (
    <>
      <RosterHeader
        mark={<Logo size="size-10" />}
        title={`${SITE.name} · Staff Roster`}
        subtitle="Every seat on the team, and who holds it."
        onRefresh={() => setReloadKey((key) => key + 1)}
        total={staffed.length}
        counts={counts}
        live={{ count: online.length, names: online.map((member) => member.name) }}
      />

      <RosterFilters
        query={query}
        onQuery={setQuery}
        placeholder="Search name, handle, callsign or Discord ID…"
        filters={[
          { id: "team", label: "Team", value: team, onChange: setTeam, options: TEAM_OPTIONS },
          {
            id: "status",
            label: "Status",
            value: status,
            onChange: setStatus,
            options: STATUS_OPTIONS,
          },
        ]}
      />

      {notice && (
        <Card className="mb-5 p-4">
          <p className="text-sm font-semibold text-amber-300">{notice}</p>
        </Card>
      )}

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_19rem]">
        <RosterTable
          columns={columns}
          groups={groups}
          empty="No staff match that search."
        />

        <aside className="space-y-5">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Training
              </h2>
              {training.length > 0 && (
                <Badge tone="primary" className="ml-auto">
                  {training.length} pending
                </Badge>
              )}
            </div>
            {training.length === 0 ? (
              <p className="text-sm text-slate-400">Nobody is in training right now.</p>
            ) : (
              <ul className="space-y-2">
                {training.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-xl bg-white/[0.02] px-3 py-2.5 ring-1 ring-inset ring-white/[0.06]"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        Trainee
                      </span>
                      <span className="truncate text-sm font-semibold text-white">
                        {entry.trainee}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        Admin
                      </span>
                      <span className="truncate text-sm text-slate-300">{entry.admin}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <RosterStats
            rows={ACTIVITY_STATUSES.map((entry) => ({
              label: entry.label,
              value: staffed.filter((member) => member.status === entry.id).length,
              color: statusColor(entry.id),
            })).filter((row) => row.value > 0)}
            total={staffed.length}
          />
        </aside>
      </div>

      {editing && (
        <StatusEditor
          key={editing.id}
          member={editing}
          open
          onClose={() => setEditing(null)}
          onSave={saveStatus}
          canManageLoa={canManageLoa}
        />
      )}
    </>
  );
}
