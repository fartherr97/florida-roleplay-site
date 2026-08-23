import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, Save, Search, TriangleAlert } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import {
  BASE_ROLES,
  DEFAULT_GRANTS,
  PERMISSION_GROUPS,
} from "../../data/permissions";
import { DEPARTMENTS, ROLE_MAP } from "../../data/rosterData";
import { cn } from "../../lib/cn";

/**
 * Builds the role columns the matrix offers, grouped so the header stays
 * readable: base roles, then the staff ladder, then each department.
 */
function buildRoleGroups(roles, departments) {
  const staff = roles.filter((r) => r.department === "staff");
  const civilian = roles.filter((r) => r.department === "civilian");
  const byDepartment = departments
    .filter((d) => !["staff", "management", "civilian"].includes(d.id))
    .map((department) => ({
      id: department.id,
      label: department.label,
      abbr: department.abbr,
      tone: department.tone,
      roles: roles.filter((r) => r.department === department.id),
    }))
    .filter((group) => group.roles.length > 0);

  return [
    {
      id: "base",
      label: "Base",
      abbr: "BASE",
      tone: "slate",
      roles: BASE_ROLES.map((role) => ({ ...role, rankFull: role.detail })),
    },
    { id: "civilian", label: "Civilian", abbr: "CIV", tone: "green", roles: civilian },
    { id: "staff", label: "Staff", abbr: "STAFF", tone: "primary", roles: staff },
    ...byDepartment,
  ];
}

/**
 * The community's access control, in one place. Every gated page, button and API
 * endpoint asks for a permission; this decides which Discord roles satisfy it.
 *
 * Nothing here checks a rank directly, which is what lets access change without
 * a deploy — and why the page refuses to save a state where nobody can open it
 * again.
 */
export default function HubPermissions() {
  const { user, refresh } = useAuth();
  const [catalogue, setCatalogue] = useState({
    groups: PERMISSION_GROUPS,
    baseRoles: BASE_ROLES,
    roles: ROLE_MAP,
    departments: DEPARTMENTS,
  });
  const [grants, setGrants] = useState(DEFAULT_GRANTS);
  const [saved, setSaved] = useState(DEFAULT_GRANTS);
  const [roleGroup, setRoleGroup] = useState("staff");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api.permissionCatalogue(), api.permissionGrants()]).then(
      ([nextCatalogue, nextGrants]) => {
        if (!active) return;
        if (nextCatalogue?.groups) setCatalogue(nextCatalogue);
        if (nextGrants && Object.keys(nextGrants).length) {
          setGrants(nextGrants);
          setSaved(nextGrants);
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const roleGroups = useMemo(
    () => buildRoleGroups(catalogue.roles ?? ROLE_MAP, catalogue.departments ?? DEPARTMENTS),
    [catalogue],
  );

  const activeRoles = useMemo(
    () => roleGroups.find((group) => group.id === roleGroup)?.roles ?? [],
    [roleGroups, roleGroup],
  );

  const visibleGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return catalogue.groups ?? PERMISSION_GROUPS;
    return (catalogue.groups ?? PERMISSION_GROUPS)
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter(
          (permission) =>
            permission.key.toLowerCase().includes(needle) ||
            permission.label.toLowerCase().includes(needle) ||
            permission.detail.toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [catalogue, query]);

  const dirty = useMemo(
    () => JSON.stringify(normalise(grants)) !== JSON.stringify(normalise(saved)),
    [grants, saved],
  );

  // Saving a state nobody can undo is refused server-side too; catching it here
  // means the button explains itself rather than failing on submit.
  const lockout = (grants["permissions.manage"] ?? []).length === 0;

  const toggle = (permission, roleKey) =>
    setGrants((prev) => {
      const current = new Set(prev[permission] ?? []);
      if (current.has(roleKey)) current.delete(roleKey);
      else current.add(roleKey);
      return { ...prev, [permission]: [...current] };
    });

  const toggleRow = (permission, allow) =>
    setGrants((prev) => {
      const current = new Set(prev[permission] ?? []);
      activeRoles.forEach((role) =>
        allow ? current.add(role.key) : current.delete(role.key),
      );
      return { ...prev, [permission]: [...current] };
    });

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.savePermissionGrants(grants);
      setSaved(grants);
      setStatus({
        tone: result?.message ? "amber" : "green",
        text: result?.message ?? "Permissions saved.",
      });
      // The signed-in user's own access may have just changed.
      refresh();
    } catch (err) {
      setStatus({ tone: "rose", text: (err.errors ?? [err.message]).join(" ") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <HubPageHeader
        icon="KeyRound"
        eyebrow="Staff Hub"
        title="Permissions"
        subtitle="Every gated page, button and endpoint in the community, and the Discord roles that satisfy it. Changes take effect immediately — no deploy."
        actions={
          <>
            <Badge tone="rose">Head Admin only</Badge>
            {dirty && <Badge tone="amber" dot>Unsaved</Badge>}
          </>
        }
      />

      {status && (
        <Card className="mb-6 p-4">
          <p
            className={cn(
              "text-sm font-semibold",
              status.tone === "green"
                ? "text-emerald-300"
                : status.tone === "amber"
                  ? "text-amber-300"
                  : "text-rose-300",
            )}
          >
            {status.text}
          </p>
        </Card>
      )}

      {lockout && (
        <Card className="mb-6 flex items-start gap-3 p-4 ring-1 ring-inset ring-rose-400/30">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-400" />
          <p className="text-sm text-rose-200">
            <strong className="font-bold">Manage permissions</strong> is granted to
            nobody. Saving in this state would leave no way back into this page, so
            it is refused — grant it to at least one role.
          </p>
        </Card>
      )}

      <div className="mb-6 flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search permissions"
            aria-label="Search permissions"
            className="pl-11"
          />
        </div>
        <Select
          value={roleGroup}
          onChange={setRoleGroup}
          options={roleGroups.map((group) => ({
            value: group.id,
            label: `${group.label} (${group.roles.length})`,
          }))}
          className="lg:w-64"
        />
      </div>

      <div className="space-y-6">
        {visibleGroups.map((group) => (
          <Card key={group.id} className="overflow-hidden">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <h2 className="text-sm font-bold text-white">{group.label}</h2>
              <p className="mt-1 text-xs text-slate-500">{group.description}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    <th className="sticky left-0 z-10 min-w-[18rem] bg-surface-1 px-5 py-3 font-bold">
                      Permission
                    </th>
                    {activeRoles.map((role) => (
                      <th
                        key={role.key}
                        className="whitespace-nowrap px-3 py-3 text-center font-bold"
                        title={role.rankFull ?? role.rank ?? role.label}
                      >
                        {role.rank ?? role.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right font-bold">All</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {group.permissions.map((permission) => {
                    const held = new Set(grants[permission.key] ?? []);
                    const allOn = activeRoles.every((role) => held.has(role.key));
                    return (
                      <tr key={permission.key} className="transition hover:bg-white/[0.02]">
                        <td className="sticky left-0 z-10 bg-surface-1 px-5 py-3.5">
                          <p className="flex items-center gap-2 font-semibold text-white">
                            {permission.label}
                            {permission.sensitive && <Badge tone="rose">Sensitive</Badge>}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {permission.detail}
                          </p>
                          <code className="mt-1.5 inline-block text-[10px] text-slate-600">
                            {permission.key}
                          </code>
                        </td>

                        {activeRoles.map((role) => {
                          const on = held.has(role.key);
                          return (
                            <td key={role.key} className="px-3 py-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => toggle(permission.key, role.key)}
                                aria-pressed={on}
                                aria-label={`${on ? "Revoke" : "Grant"} ${permission.label} for ${role.rank ?? role.label}`}
                                className={cn(
                                  "grid size-6 place-items-center rounded-md ring-1 ring-inset transition",
                                  on
                                    ? "bg-primary-500 text-white ring-primary-400/50"
                                    : "bg-white/[0.03] text-transparent ring-white/15 hover:bg-white/[0.08]",
                                )}
                              >
                                <Check className="size-3.5" />
                              </button>
                            </td>
                          );
                        })}

                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => toggleRow(permission.key, !allOn)}
                            className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 transition hover:text-primary-400"
                          >
                            {allOn ? "None" : "All"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-slate-500">
          Signed in as {user?.displayName ?? "unknown"}. Revoking your own access
          takes effect immediately.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setGrants(DEFAULT_GRANTS);
              setStatus({
                tone: "amber",
                text: "Defaults loaded — review them, then save to apply.",
              });
            }}
          >
            <RotateCcw className="size-4" />
            Load defaults
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setGrants(saved)}
            disabled={!dirty}
          >
            Discard changes
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !dirty || lockout}>
            <Save className="size-4" />
            {saving ? "Saving…" : "Save permissions"}
          </Button>
        </div>
      </div>
    </>
  );
}

/** Sorted copy, so a reordered array does not read as an edit. */
function normalise(grants) {
  return Object.fromEntries(
    Object.entries(grants)
      .map(([key, roles]) => [key, [...roles].sort()])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}
