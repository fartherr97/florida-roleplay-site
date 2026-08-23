import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import Card from "../../components/ui/Card";
import Logo from "../../components/layout/Logo";
import RosterFilters from "../../components/roster/RosterFilters";
import RosterHeader from "../../components/roster/RosterHeader";
import RosterStats from "../../components/roster/RosterStats";
import RosterTable from "../../components/roster/RosterTable";
import StatusEditor, { StatusPill } from "../../components/hub/StatusEditor";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { formatDate } from "../../lib/format";
import { toneHex } from "../../lib/tones";
import { SITE } from "../../data/mockData";
import {
  ACTIVITY_STATUSES,
  DEPARTMENTS,
  DIVISIONS,
  roster as seedRoster,
  statusColor,
} from "../../data/rosterData";

const DIVISION_OPTIONS = [
  { value: "all", label: "All divisions" },
  ...DIVISIONS.map((d) => ({ value: d.id, label: d.label })),
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...ACTIVITY_STATUSES.map((s) => ({ value: s.id, label: s.label })),
];

/** Relative time, so a stale sync is obvious without doing date arithmetic. */
function sinceLabel(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const hours = Math.round((Date.now() - then) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/**
 * The community roster: every member across every department, kept current by
 * the Discord bot.
 *
 * Grouped by department rather than listed flat, using the same table the Staff
 * Hub and the department sites use — one roster layout across the whole
 * community, so moving between them needs no relearning. Entries here are
 * written by the sync API; the Staff Hub's roster is the operational view of the
 * staff slice, carrying fields that only matter internally.
 */
export default function CivRoster() {
  const { hasPermission } = useAuth();
  const [entries, setEntries] = useState(seedRoster);
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("all");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const canEditStatus = hasPermission("roster.edit_status");
  const canManageLoa = hasPermission("roster.manage_loa");

  useEffect(() => {
    let active = true;
    api.roster().then((next) => {
      if (active && next?.length) setEntries(next);
    });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const departmentOptions = useMemo(() => {
    const inDivision =
      division === "all"
        ? DEPARTMENTS
        : DEPARTMENTS.filter((d) => d.division === division);
    return [
      { value: "all", label: "All departments" },
      ...inDivision.map((d) => ({ value: d.id, label: d.label })),
    ];
  }, [division]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const dept = DEPARTMENTS.find((d) => d.id === entry.department);
      if (division !== "all" && dept?.division !== division) return false;
      if (department !== "all" && entry.department !== department) return false;
      if (status !== "all" && entry.status !== status) return false;
      if (!needle) return true;
      return [entry.characterName, entry.displayName, entry.rank, entry.rankFull, entry.callsign]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [entries, query, division, department, status]);

  // Departments in the order they are declared, so the roster always reads
  // civilian → law → fire → federal → staff → management.
  const groups = useMemo(
    () =>
      DEPARTMENTS.map((dept) => ({
        id: dept.id,
        label: dept.label,
        color: toneHex(dept.tone),
        rows: rows.filter((entry) => entry.department === dept.id),
      })).filter((group) => group.rows.length > 0),
    [rows],
  );

  const counts = useMemo(
    () =>
      ACTIVITY_STATUSES.map((entry) => ({
        label: entry.label,
        value: entries.filter((member) => member.status === entry.id).length,
        color: entry.color,
      })).filter((entry) => entry.value > 0),
    [entries],
  );

  const byDivision = useMemo(
    () =>
      DIVISIONS.map((d) => ({
        label: d.label,
        color: toneHex(d.tone),
        value: entries.filter(
          (e) => DEPARTMENTS.find((x) => x.id === e.department)?.division === d.id,
        ).length,
      })).filter((d) => d.value > 0),
    [entries],
  );

  const lastSync = useMemo(
    () => entries.map((e) => e.syncedAt).filter(Boolean).sort().at(-1),
    [entries],
  );

  const columns = [
    {
      key: "callsign",
      label: "Callsign",
      width: "w-24",
      render: (e) =>
        e.callsign ? (
          <span className="font-bold text-primary-400">{e.callsign}</span>
        ) : (
          <span className="text-slate-600">—</span>
        ),
    },
    {
      key: "member",
      label: "Member",
      render: (e) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{e.characterName}</p>
          <p className="truncate text-xs text-slate-500">{e.displayName}</p>
        </div>
      ),
    },
    {
      key: "rank",
      label: "Rank",
      render: (e) => (
        <span className="text-sm font-semibold text-brand-300">{e.rankFull ?? e.rank}</span>
      ),
    },
    {
      key: "joined",
      label: "Joined",
      hideBelow: "lg",
      render: (e) => (
        <span className="whitespace-nowrap text-slate-400">{formatDate(e.joinedAt)}</span>
      ),
    },
    {
      key: "synced",
      label: "Synced",
      hideBelow: "xl",
      render: (e) => (
        <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          {sinceLabel(e.syncedAt)}
          {e.source === "manual" && " · manual"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (e) => <StatusPill member={e} editable={canEditStatus} onEdit={setEditing} />,
    },
  ];

  const saveStatus = async (payload) => {
    const result = await api.updateRosterStatus(payload.id, payload);
    setEntries((current) =>
      current.map((entry) =>
        entry.id === payload.id
          ? { ...entry, status: payload.status, loaUntil: payload.loaUntil, loaReason: payload.loaReason }
          : entry,
      ),
    );
    setNotice(
      result?.message
        ? { tone: "amber", text: result.message }
        : { tone: "green", text: `${payload.characterName ?? "Status"} updated.` },
    );
  };

  return (
    <>
      <RosterHeader
        mark={<Logo size="size-10" />}
        title={`${SITE.name} · Community Roster`}
        subtitle="Everyone in the community and the department they serve in."
        onRefresh={() => setReloadKey((key) => key + 1)}
        total={entries.length}
        counts={counts}
      />

      <RosterFilters
        query={query}
        onQuery={setQuery}
        placeholder="Search by name, rank or callsign…"
        filters={[
          {
            id: "division",
            label: "Division",
            value: division,
            onChange: (value) => {
              setDivision(value);
              setDepartment("all");
            },
            options: DIVISION_OPTIONS,
          },
          {
            id: "department",
            label: "Department",
            value: department,
            onChange: setDepartment,
            options: departmentOptions,
          },
          { id: "status", label: "Status", value: status, onChange: setStatus, options: STATUS_OPTIONS },
        ]}
      />

      {notice && (
        <Card className="mb-5 p-4">
          <p
            className={
              notice.tone === "green"
                ? "text-sm font-semibold text-emerald-300"
                : "text-sm font-semibold text-amber-300"
            }
          >
            {notice.text}
          </p>
        </Card>
      )}

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_19rem]">
        <RosterTable columns={columns} groups={groups} empty="No members match that search." />

        <aside className="space-y-5">
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              <RefreshCw className="size-3.5 text-emerald-400" />
              Synced {sinceLabel(lastSync)}
            </h2>
            <p className="text-xs leading-relaxed text-slate-500">
              Ranks and display names are maintained by the roster bot. If yours is wrong, your
              Discord roles are the thing to fix — the roster follows them.
              {canEditStatus && " Activity status is set here, and the bot mirrors LOA into Discord."}
            </p>
          </Card>

          <RosterStats title="By division" rows={byDivision} total={entries.length} />

          <RosterStats
            title="By status"
            rows={ACTIVITY_STATUSES.map((entry) => ({
              label: entry.label,
              value: entries.filter((member) => member.status === entry.id).length,
              color: statusColor(entry.id),
            })).filter((row) => row.value > 0)}
            total={entries.length}
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
