import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import DeptBrandMark from "../../components/dept/DeptBrandMark";
import RosterFilters from "../../components/roster/RosterFilters";
import RosterHeader from "../../components/roster/RosterHeader";
import RosterStats from "../../components/roster/RosterStats";
import RosterTable from "../../components/roster/RosterTable";
import StatusEditor, { StatusPill } from "../../components/hub/StatusEditor";
import { useAuth } from "../../context/useAuth";
import { useDeptConfig } from "../../context/useDeptConfig";
import { statValue } from "../../lib/deptRoster";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { ACTIVITY_STATUSES, statusColor } from "../../data/rosterData";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...ACTIVITY_STATUSES.map((s) => ({ value: s.id, label: s.label })),
];

/**
 * A department's personnel.
 *
 * The layout is the department's own — which bands exist, what colour each one
 * is, which columns show — but the people in it are the community roster,
 * filtered to this department and bucketed by the Discord role map. That is the
 * whole point of the projection: promoting someone in Discord moves them here,
 * and there is no second roster for the bot to keep in step.
 *
 * Activity status is therefore edited against the community roster too, which is
 * why the control asks for the site-wide `roster.edit_status` permission rather
 * than a department capability — a status set here is the same status the
 * Civilian Hub's roster shows.
 */
export default function DeptRoster({ page, config }) {
  const { hasPermission } = useAuth();
  const { id } = useDeptConfig();
  const [loaded, setLoaded] = useState({ id: null, subdivisions: [] });
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    api.deptRoster(id).then((result) => {
      if (active) setLoaded({ id, subdivisions: result?.subdivisions ?? [] });
    });
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  const subdivisions = loaded.id === id ? loaded.subdivisions : [];
  // Derived rather than reset in an effect, so switching department renders the
  // new department's first unit instead of the old department's selection.
  const active = subdivisions.find((sub) => sub.id === activeId) ?? subdivisions[0] ?? null;

  const canEditStatus = hasPermission("roster.edit_status");
  const canManageLoa = hasPermission("roster.manage_loa");
  const fields = config.roster.memberFields ?? [];
  const stats = config.roster.stats;

  const everyone = useMemo(
    () => (active?.categories ?? []).flatMap((category) => category.members),
    [active],
  );

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (active?.categories ?? [])
      .map((category) => ({
        id: category.id,
        label: category.name,
        color: category.color,
        rows: category.members.filter((member) => {
          if (status !== "all" && member.status !== status) return false;
          if (!needle) return true;
          return [member.characterName, member.rank, member.rankFull, member.callsign]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle));
        }),
      }))
      .filter((group) => group.rows.length > 0);
  }, [active, query, status]);

  const totals = useMemo(
    () =>
      active && stats?.show
        ? (stats.items ?? []).map((item) => ({ ...item, value: statValue(item, active) }))
        : [],
    [active, stats],
  );

  const counts = useMemo(
    () =>
      ACTIVITY_STATUSES.map((entry) => ({
        label: entry.label,
        value: everyone.filter((member) => member.status === entry.id).length,
        color: entry.color,
      })).filter((entry) => entry.value > 0),
    [everyone],
  );

  const columns = [
    {
      key: "callsign",
      label: "Callsign",
      width: "w-24",
      render: (member) =>
        member.callsign ? (
          <span className="dept-accent-text font-bold">{member.callsign}</span>
        ) : (
          <span className="text-slate-600">—</span>
        ),
    },
    {
      key: "name",
      label: "Name",
      render: (member) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{member.characterName}</p>
          <p className="truncate text-xs text-slate-500">{member.displayName}</p>
        </div>
      ),
    },
    {
      key: "rank",
      label: "Rank",
      render: (member) => (
        <span className="text-sm font-semibold text-slate-300">
          {member.rankFull || member.rank}
        </span>
      ),
    },
    // The columns beyond rank are the department's own, so they come from its
    // config rather than being fixed here.
    ...fields
      .filter((field) => field.id !== "callsign")
      .map((field) => ({
        key: field.id,
        label: field.label,
        hideBelow: field.id === "status" ? undefined : "lg",
        render: (member) => (
          <MemberCell field={field} member={member} editable={canEditStatus} onEdit={setEditing} />
        ),
      })),
  ];

  const saveStatus = async (payload) => {
    await api.updateRosterStatus(payload.id, payload);
    setReloadKey((key) => key + 1);
  };

  return (
    <>
      <RosterHeader
        mark={<DeptBrandMark config={config} className="size-10" />}
        title={`${config.branding.shortName} · ${page.label}`}
        subtitle={
          active?.banner?.subtitle ||
          "Personnel follow Discord roles — promote someone there and they move here."
        }
        views={subdivisions.map((sub) => ({ id: sub.id, label: sub.name }))}
        activeView={active?.id}
        onView={setActiveId}
        onRefresh={() => setReloadKey((key) => key + 1)}
        total={everyone.length}
        counts={counts}
      />

      <RosterFilters
        query={query}
        onQuery={setQuery}
        placeholder="Search name, rank or callsign…"
        filters={[
          { id: "status", label: "Status", value: status, onChange: setStatus, options: STATUS_OPTIONS },
        ]}
      />

      {everyone.length === 0 ? (
        <Card className="p-10 text-center">
          <Users className="mx-auto size-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">
            Nobody holds a {config.branding.shortName} role in Discord yet. As soon as someone
            does, the roster bot adds them here.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Ranks are bound to Discord roles on the{" "}
            <Link to="/staff-hub/discord-roles" className="underline hover:text-slate-300">
              role mapping page
            </Link>
            .
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_19rem]">
          <RosterTable
            columns={columns}
            groups={groups}
            empty={`Nobody in ${config.branding.shortName} matches that search.`}
          />

          <aside className="space-y-5">
            {totals.length > 0 && (
              <Card className="p-5">
                <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {active?.name ?? config.branding.shortName}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {totals.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-white/[0.02] p-3 ring-1 ring-inset ring-white/[0.06]"
                    >
                      <div className="dept-accent-text text-xl font-extrabold tracking-tight">
                        {item.value}
                      </div>
                      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <RosterStats
              title="By status"
              rows={ACTIVITY_STATUSES.map((entry) => ({
                label: entry.label,
                value: everyone.filter((member) => member.status === entry.id).length,
                color: statusColor(entry.id),
              })).filter((row) => row.value > 0)}
              total={everyone.length}
            />
          </aside>
        </div>
      )}

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

/** One configured column for one member. */
function MemberCell({ field, member, editable, onEdit }) {
  const value = member[field.id];

  if (field.id === "status" || field.type === "status") {
    return <StatusPill member={member} editable={editable} onEdit={onEdit} />;
  }
  if (field.type === "date") {
    return value ? (
      <span className="whitespace-nowrap text-slate-400">{formatDate(value)}</span>
    ) : (
      <span className="text-slate-600">—</span>
    );
  }
  if (field.type === "checkbox") {
    return value ? <span className="dept-accent-text font-bold">✓</span> : <span className="text-slate-600">—</span>;
  }
  if (field.type === "cert") {
    return value ? <Badge tone="green">Certified</Badge> : <Badge tone="slate">N/A</Badge>;
  }
  if (field.type === "select" && field.pill) {
    return value ? <Badge tone="slate">{value}</Badge> : <span className="text-slate-600">—</span>;
  }
  return value ? <span className="text-slate-400">{value}</span> : <span className="text-slate-600">—</span>;
}
