import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Search } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import DataTable from "../../components/hub/DataTable";
import StatTile from "../../components/hub/StatTile";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import StatusEditor, { StatusPill } from "../../components/hub/StatusEditor";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { formatDate } from "../../lib/format";
import {
  ACTIVITY_STATUSES,
  DEPARTMENTS,
  DIVISIONS,
  roster as seedRoster,
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
 * the Discord bot. Entries here are written by the sync API — the ops-focused
 * staff roster in the Staff Hub is a different view for a different job.
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
  }, []);

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
      return [entry.characterName, entry.displayName, entry.rank, entry.callsign]
        .concat(" ", entry.rankFull ?? "")
        .toLowerCase()
        .includes(needle);
    });
  }, [entries, query, division, department, status]);

  const byDivision = useMemo(
    () =>
      DIVISIONS.map((d) => ({
        ...d,
        count: entries.filter(
          (e) => DEPARTMENTS.find((x) => x.id === e.department)?.division === d.id,
        ).length,
      })).filter((d) => d.count > 0),
    [entries],
  );

  const lastSync = useMemo(
    () =>
      entries
        .map((e) => e.syncedAt)
        .filter(Boolean)
        .sort()
        .at(-1),
    [entries],
  );

  const columns = [
    {
      key: "member",
      label: "Member",
      render: (e) => (
        <>
          <p className="font-semibold text-white">{e.characterName}</p>
          <p className="truncate text-xs text-slate-500">{e.displayName}</p>
        </>
      ),
    },
    {
      key: "department",
      label: "Department",
      render: (e) => {
        const dept = DEPARTMENTS.find((d) => d.id === e.department);
        return <Badge tone={dept?.tone ?? "slate"}>{dept?.abbr ?? e.department}</Badge>;
      },
    },
    {
      key: "rank",
      label: "Rank",
      render: (e) => (
        <span className="text-slate-300">{e.rankFull ?? e.rank}</span>
      ),
    },
    {
      key: "callsign",
      label: "Callsign",
      render: (e) =>
        e.callsign ? (
          <code className="rounded-lg bg-black/30 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-inset ring-white/10">
            {e.callsign}
          </code>
        ) : (
          <span className="text-slate-600">—</span>
        ),
    },
    { key: "joined", label: "Joined", render: (e) => <span className="text-slate-400">{formatDate(e.joinedAt)}</span> },
    {
      key: "synced",
      label: "Synced",
      render: (e) => (
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          {sinceLabel(e.syncedAt)}
          {e.source === "manual" && " · manual"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (e) => (
        <StatusPill member={e} editable={canEditStatus} onEdit={setEditing} />
      ),
    },
  ];

  return (
    <>
      <HubPageHeader
        icon="Users"
        eyebrow="Civilian Hub"
        title="Community Roster"
        subtitle="Everyone in the community and the department they serve in — civilians, law enforcement, fire and EMS, staff and management."
        actions={<Badge tone="brand">{rows.length} shown</Badge>}
      />

      <Card className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 p-5">
        <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          <RefreshCw className="size-3.5 text-emerald-400" />
          Synced from Discord · {sinceLabel(lastSync)}
        </span>
        <p className="min-w-0 flex-1 text-xs text-slate-500">
          Ranks and display names are maintained by the roster bot. If yours is
          wrong, your Discord roles are the thing to fix — the roster follows them.
          {canEditStatus && " Activity status is set here, and the bot mirrors LOA into Discord."}
        </p>
      </Card>

      {notice && (
        <Card className="mb-6 p-4">
          <p
            className={
              notice.tone === "green" ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-amber-300"
            }
          >
            {notice.text}
          </p>
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {byDivision.map((d) => (
          <StatTile
            key={d.id}
            label={d.label}
            value={d.count}
            tone={d.tone === "slate" ? "white" : d.tone}
          />
        ))}
      </div>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, rank or callsign"
            aria-label="Search the roster"
            className="pl-11"
          />
        </div>
        <Select
          value={division}
          onChange={(value) => {
            setDivision(value);
            setDepartment("all");
          }}
          options={DIVISION_OPTIONS}
          className="lg:w-52"
        />
        <Select
          value={department}
          onChange={setDepartment}
          options={departmentOptions}
          className="lg:w-56"
        />
        <Select
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
          className="lg:w-44"
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(e) => e.id}
        empty="No members match that search."
      />

      <StatusEditor
        key={editing?.id}
        member={editing}
        open={Boolean(editing)}
        canManageLoa={canManageLoa}
        onClose={() => setEditing(null)}
        onSave={async (payload) => {
          const result = await api.updateRosterStatus(editing.id, payload);
          setEntries((prev) =>
            prev.map((entry) =>
              entry.id === editing.id ? { ...entry, ...payload } : entry,
            ),
          );
          setNotice({
            tone: result?.message ? "amber" : "green",
            text:
              result?.message ??
              `${editing.characterName} set to ${payload.status}.`,
          });
        }}
      />

      <p className="mt-6 text-center text-xs text-slate-500">
        Staff looking for claim counts and vest hours want the{" "}
        <Link to="/staff-hub/roster" className="font-semibold text-primary-400 hover:underline">
          Staff Hub roster
        </Link>{" "}
        instead.
      </p>
    </>
  );
}
