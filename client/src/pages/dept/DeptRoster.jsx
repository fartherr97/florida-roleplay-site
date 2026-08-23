import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Users } from "lucide-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import DeptPageHeader from "../../components/dept/DeptPageHeader";
import StatusEditor, { StatusPill } from "../../components/hub/StatusEditor";
import { useAuth } from "../../context/useAuth";
import { useDeptConfig } from "../../context/useDeptConfig";
import { statValue } from "../../lib/deptRoster";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { cn } from "../../lib/cn";

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
  // new department's first tab instead of the old department's selection.
  const active =
    subdivisions.find((sub) => sub.id === activeId) ?? subdivisions[0] ?? null;

  const canEditStatus = hasPermission("roster.edit_status");
  const canManageLoa = hasPermission("roster.manage_loa");
  const fields = config.roster.memberFields ?? [];
  const stats = config.roster.stats;

  const totals = useMemo(
    () =>
      active && stats?.show
        ? (stats.items ?? []).map((item) => ({ ...item, value: statValue(item, active) }))
        : [],
    [active, stats],
  );

  const saveStatus = async (payload) => {
    await api.updateRosterStatus(payload.id, payload);
    setReloadKey((key) => key + 1);
  };

  return (
    <>
      <DeptPageHeader
        icon={page.icon}
        eyebrow={config.branding.shortName}
        title={page.label}
        subtitle={
          active?.banner?.subtitle ||
          "Personnel are added and promoted through Discord — this page follows the roles."
        }
        actions={
          <Button variant="ghost" size="sm" onClick={() => setReloadKey((key) => key + 1)}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
      />

      {totals.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {totals.map((item) => (
            <Card key={item.id} className="p-5">
              <div className="dept-accent-text text-2xl font-extrabold tracking-tight">
                {item.value}
              </div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {item.label}
              </div>
            </Card>
          ))}
        </div>
      )}

      {subdivisions.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {subdivisions.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => setActiveId(sub.id)}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-semibold transition ring-1 ring-inset",
                sub.id === active?.id
                  ? "dept-accent-tile"
                  : "bg-white/[0.02] text-slate-300 ring-white/[0.06] hover:bg-white/[0.06] hover:text-white",
              )}
            >
              {sub.name}
              <span className="ml-2 text-xs font-normal text-slate-500">{sub.total}</span>
            </button>
          ))}
        </div>
      )}

      {!active || active.categories.every((category) => category.members.length === 0) ? (
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
        <div className="space-y-6">
          {active.categories
            .filter((category) => category.members.length > 0)
            .map((category) => (
              <Card key={category.id} className="overflow-hidden">
                <div
                  className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${category.color} 12%, transparent)`,
                  }}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: category.color }}
                    aria-hidden="true"
                  />
                  <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-white">
                    {category.name}
                  </h2>
                  <span className="ml-auto text-xs text-slate-400">
                    {category.members.length}
                  </span>
                  {category.unassigned && (
                    <Badge tone="amber">Rank not in a band</Badge>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.16em] text-slate-500">
                        <th className="px-5 py-3 font-bold">Rank</th>
                        <th className="px-5 py-3 font-bold">Name</th>
                        {fields.map((field) => (
                          <th key={field.id} className="px-5 py-3 font-bold">
                            {field.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {category.members.map((member) => (
                        <tr key={member.id} className="transition hover:bg-white/[0.02]">
                          <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-white">
                            {member.rankFull || member.rank}
                          </td>
                          <td className="px-5 py-3.5 text-slate-300">{member.characterName}</td>
                          {fields.map((field) => (
                            <td key={field.id} className="px-5 py-3.5 text-slate-400">
                              <MemberCell
                                field={field}
                                member={member}
                                editable={canEditStatus}
                                onEdit={setEditing}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
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
  if (field.type === "date") return value ? formatDate(value) : "—";
  if (field.type === "checkbox") {
    return value ? <span className="dept-accent-text font-bold">✓</span> : "—";
  }
  if (field.type === "cert") {
    return value ? <Badge tone="green">Certified</Badge> : <Badge tone="slate">N/A</Badge>;
  }
  if (field.type === "select" && field.pill) {
    return value ? <Badge tone="slate">{value}</Badge> : "—";
  }
  return value || "—";
}
