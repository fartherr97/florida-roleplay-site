import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Users } from "lucide-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import DeptBrandMark from "../../components/dept/DeptBrandMark";
import RosterFilters from "../../components/roster/RosterFilters";
import RosterHeader from "../../components/roster/RosterHeader";
import RosterTable from "../../components/roster/RosterTable";
import StatusEditor, { StatusPill } from "../../components/hub/StatusEditor";
import { useAuth } from "../../context/useAuth";
import { useDeptConfig } from "../../context/useDeptConfig";
import { statValue } from "../../lib/deptRoster";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { ACTIVITY_STATUSES } from "../../data/rosterData";

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
  const [notice, setNotice] = useState("");
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
        insigniaUrl: category.insigniaUrl,
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
        mark={<DeptBrandMark config={config} className="size-10" />}
        title={`${config.branding.shortName} · ${page.label}`}
        subtitle="Personnel follow Discord roles — promote someone there and they move here."
        views={subdivisions.map((sub) => ({ id: sub.id, label: sub.name }))}
        activeView={active?.id}
        onView={setActiveId}
        onRefresh={() => setReloadKey((key) => key + 1)}
        total={everyone.length}
        counts={counts}
      />

      {active && <SubdivisionBanner config={config} sub={active} />}

      <StatsBar
        title={stats?.title || `${active?.name ?? config.branding.shortName} statistics`}
        totals={totals}
      />

      <RosterFilters
        query={query}
        onQuery={setQuery}
        placeholder="Search name, rank or callsign…"
        filters={[
          { id: "status", label: "Status", value: status, onChange: setStatus, options: STATUS_OPTIONS },
        ]}
      />

      {notice && (
        <Card className="mb-5 p-4">
          <p className="text-sm font-semibold text-amber-300">{notice}</p>
        </Card>
      )}

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
        <RosterTable
          columns={columns}
          groups={groups}
          empty={`Nobody in ${config.branding.shortName} matches that search.`}
        />
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

/**
 * The banner across the top of the active subdivision — the reference hub's
 * centrepiece. Uses the subdivision's own banner artwork when it has any, and
 * otherwise an accent-tinted gradient with the department mark, so every roster
 * gets the same strong header whether or not one has been uploaded.
 */
function SubdivisionBanner({ config, sub }) {
  const banner = sub?.banner ?? {};
  const title = banner.title || sub?.name || config.branding.shortName;
  const subtitle = banner.subtitle || config.branding.tagline;

  return (
    <div className="relative mb-5 overflow-hidden rounded-2xl border border-white/10">
      {banner.imageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${banner.imageUrl})` }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: banner.imageUrl
            ? "linear-gradient(90deg, rgba(6,12,24,0.92) 0%, rgba(6,12,24,0.7) 55%, color-mix(in srgb, var(--dept-accent) 24%, rgba(6,12,24,0.5)) 100%)"
            : "linear-gradient(120deg, color-mix(in srgb, var(--dept-accent) 22%, #0b1424) 0%, #0b1424 62%)",
        }}
      />
      <div className="relative flex items-center gap-4 px-5 py-6 sm:px-8">
        {banner.logoUrl ? (
          <img src={banner.logoUrl} alt="" className="size-14 shrink-0 object-contain sm:size-16" />
        ) : (
          <DeptBrandMark config={config} className="size-14 text-base sm:size-16" />
        )}
        <div className="min-w-0 flex-1 text-center">
          <h2 className="dept-accent-text truncate text-xl font-extrabold tracking-tight sm:text-3xl">
            {title}
          </h2>
          {subtitle && (
            <div className="mt-0.5 truncate text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 sm:text-sm">
              {subtitle}
            </div>
          )}
        </div>
        {/* A mirror slot on the right keeps the title optically centred. */}
        {banner.logoUrl2 ? (
          <img src={banner.logoUrl2} alt="" className="size-14 shrink-0 object-contain sm:size-16" />
        ) : (
          <span className="hidden size-14 shrink-0 sm:block sm:size-16" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

/**
 * The full-width statistics bar — a titled header and a row of accent-edged
 * tiles, exactly where the reference hub puts it, rather than tucked into a
 * side rail.
 */
function StatsBar({ title, totals }) {
  if (totals.length === 0) return null;
  return (
    <Card className="mb-4 overflow-hidden p-0">
      <div
        className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5"
        style={{ borderLeft: "3px solid var(--dept-accent)" }}
      >
        <BarChart3 className="dept-accent-text size-4" />
        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-200">
          {title}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
        {totals.map((item) => (
          <div
            key={item.id}
            className="hub-card-hover rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
            style={{ borderLeft: `3px solid ${item.color || "var(--dept-accent)"}` }}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              {item.label}
            </div>
            <div
              className="dept-accent-text mt-0.5 text-2xl font-black tabular-nums"
              style={item.color ? { color: item.color } : undefined}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </Card>
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
    if (!value) return <span className="text-slate-600">—</span>;
    const color = field.optionColors?.[value];
    if (color) {
      return (
        <span
          className="inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-bold"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
            borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
            color,
          }}
        >
          {value}
        </span>
      );
    }
    return <Badge tone="slate">{value}</Badge>;
  }
  return value ? <span className="text-slate-400">{value}</span> : <span className="text-slate-600">—</span>;
}
