import { createElement, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, Check, KeyRound, Search, ShieldAlert } from "lucide-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { TextInput } from "../../components/ui/TextInput";
import HubPageHeader from "../../components/hub/HubPageHeader";
import { useAuth } from "../../context/useAuth";
import { iconFor } from "../../lib/icons";
import { api } from "../../lib/api";
import { PERMISSION_GROUPS, BASE_ROLES, DEFAULT_GRANTS } from "../../data/permissions";
import { ROLE_MAP, DEPARTMENTS } from "../../data/rosterData";
import { cn } from "../../lib/cn";

const SNOWFLAKE = /^\d{17,20}$/;

/** Normalises the grant map so a re-order of role keys does not read as a change. */
function normalise(grants) {
  return Object.fromEntries(
    Object.entries(grants).map(([key, roles]) => [key, [...(roles ?? [])].sort()]),
  );
}

/**
 * Access, in one place.
 *
 * Everything that governs the website and its hubs — which Discord role is which rank, and
 * what each rank may do site-wide — read and edited role-by-role rather than spread across
 * the permissions matrix and the role-mapping page. Two things stay one click away, on
 * purpose: fine-grained per-department access (each department signs for its own), and the
 * bot's own command/dashboard access (a different app that governs the bot, not the site).
 */
export default function HubAccessCenter() {
  const { hasPermission, refresh } = useAuth();

  const [catalogue, setCatalogue] = useState({
    groups: PERMISSION_GROUPS,
    baseRoles: BASE_ROLES,
    roles: ROLE_MAP,
    departments: DEPARTMENTS,
  });
  const [grants, setGrants] = useState(DEFAULT_GRANTS);
  const [savedGrants, setSavedGrants] = useState(DEFAULT_GRANTS);
  const [roleMap, setRoleMap] = useState({ roles: ROLE_MAP, special: [] });
  const [savedRoleMap, setSavedRoleMap] = useState({ roles: ROLE_MAP, special: [] });
  const [depts, setDepts] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const editable = hasPermission("permissions.manage");

  useEffect(() => {
    let active = true;
    Promise.all([
      api.permissionCatalogue(),
      api.permissionGrants(),
      api.discordRoleMap(),
      api.deptList(),
    ]).then(([cat, g, map, list]) => {
      if (!active) return;
      if (cat?.groups) setCatalogue(cat);
      if (g && Object.keys(g).length) {
        setGrants(g);
        setSavedGrants(g);
      }
      if (map?.roles) {
        const next = { roles: map.roles, special: map.special ?? [] };
        setRoleMap(next);
        setSavedRoleMap(next);
      }
      setDepts(Array.isArray(list) ? list : (list?.items ?? []));
    });
    return () => {
      active = false;
    };
  }, []);

  /** Every role that can hold access, grouped for the picker. Base tiers have no Discord id. */
  const roleGroups = useMemo(() => {
    const roles = roleMap.roles ?? [];
    const byDivision = (deptIds) => roles.filter((r) => deptIds.includes(r.department));
    const staffIds = (catalogue.departments ?? DEPARTMENTS)
      .filter((d) => d.division === "staff")
      .map((d) => d.id);
    const civilianIds = (catalogue.departments ?? DEPARTMENTS)
      .filter((d) => d.division === "civilian")
      .map((d) => d.id);
    const lawIds = (catalogue.departments ?? DEPARTMENTS)
      .filter((d) => d.division === "law")
      .map((d) => d.id);

    return [
      { id: "staff", label: "Staff & command", roles: byDivision(staffIds) },
      { id: "law", label: "Law enforcement", roles: byDivision(lawIds) },
      { id: "civilian", label: "Civilian", roles: byDivision(civilianIds) },
      {
        id: "base",
        label: "Base tiers",
        roles: (catalogue.baseRoles ?? BASE_ROLES).map((r) => ({
          key: r.key,
          rank: r.label,
          rankFull: r.detail ?? r.label,
          department: null,
          roleId: "",
          base: true,
        })),
      },
    ].filter((group) => group.roles.length > 0);
  }, [roleMap, catalogue]);

  const allRoles = useMemo(() => roleGroups.flatMap((g) => g.roles), [roleGroups]);
  const selected = useMemo(
    () => allRoles.find((r) => r.key === selectedKey) ?? null,
    [allRoles, selectedKey],
  );

  const filteredGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return roleGroups;
    return roleGroups
      .map((group) => ({
        ...group,
        roles: group.roles.filter((r) =>
          [r.key, r.rank, r.rankFull, r.roleId].join(" ").toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.roles.length > 0);
  }, [roleGroups, query]);

  const dirty =
    JSON.stringify(normalise(grants)) !== JSON.stringify(normalise(savedGrants)) ||
    JSON.stringify(roleMap.roles) !== JSON.stringify(savedRoleMap.roles);

  // The server refuses a save that leaves nobody able to manage permissions; mirror it here
  // so the button explains itself rather than failing on submit.
  const lockout = (grants["permissions.manage"] ?? []).length === 0;

  const toggleCap = (capKey) => {
    if (!selected) return;
    setGrants((prev) => {
      const current = new Set(prev[capKey] ?? []);
      if (current.has(selected.key)) current.delete(selected.key);
      else current.add(selected.key);
      return { ...prev, [capKey]: [...current] };
    });
  };

  const setRoleId = (value) => {
    if (!selected) return;
    setRoleMap((prev) => ({
      ...prev,
      roles: prev.roles.map((r) => (r.key === selected.key ? { ...r, roleId: value } : r)),
    }));
  };

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const messages = [];
      if (JSON.stringify(normalise(grants)) !== JSON.stringify(normalise(savedGrants))) {
        const res = await api.savePermissionGrants(grants);
        setSavedGrants(grants);
        if (res?.message) messages.push(res.message);
      }
      if (JSON.stringify(roleMap.roles) !== JSON.stringify(savedRoleMap.roles)) {
        const res = await api.saveDiscordRoleMap({ roles: roleMap.roles, special: roleMap.special });
        setSavedRoleMap(roleMap);
        if (res?.message) messages.push(res.message);
      }
      setStatus({ tone: messages.length ? "amber" : "green", text: messages.join(" ") || "Access saved." });
      refresh();
    } catch (err) {
      setStatus({ tone: "rose", text: (err.errors ?? [err.message]).join(" ") });
    } finally {
      setSaving(false);
    }
  };

  const deptList = depts.length ? depts : DEPARTMENTS.filter((d) => d.division === "law");

  return (
    <>
      <HubPageHeader
        icon="KeyRound"
        eyebrow="Staff Hub"
        title="Access"
        subtitle="One place for who can do what on the website and its hubs. Pick a Discord role, set its ID, and tick what it can do. Changes take effect immediately — no deploy."
        actions={
          <>
            <Badge tone="rose">Directorship and Ownership only</Badge>
            {dirty && (
              <Badge tone="amber" dot>
                Unsaved
              </Badge>
            )}
          </>
        }
      />

      {/* The two surfaces that stay separate, so the boundary is never a mystery. */}
      <Card className="mb-6 flex flex-wrap items-center gap-4 p-5">
        <Bot className="size-5 shrink-0 text-primary-300" />
        <p className="min-w-0 flex-1 text-sm text-slate-400">
          This page is <strong className="text-slate-200">website &amp; hub</strong> access. Who can
          run the Discord <strong className="text-slate-200">bot's commands</strong> (`/globalban`,
          `/temprole`…) and its dashboard is set separately, in Bot Management.
        </p>
        <Button as={Link} to="/management/bot/access" variant="secondary" size="sm">
          Bot command access
          <ArrowRight className="size-4" />
        </Button>
      </Card>

      {!editable && (
        <Card className="mb-5 flex items-start gap-3 p-5">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-400" />
          <p className="text-sm text-slate-400">
            You can read this but not change it — editing access needs the “Manage permissions”
            capability (Directorship or Ownership).
          </p>
        </Card>
      )}

      {status && (
        <p
          className={cn(
            "mb-5 rounded-xl px-4 py-3 text-sm ring-1 ring-inset",
            status.tone === "green" && "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25",
            status.tone === "amber" && "bg-amber-500/10 text-amber-200 ring-amber-400/25",
            status.tone === "rose" && "bg-rose-500/10 text-rose-300 ring-rose-400/25",
          )}
        >
          {status.text}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Role picker */}
        <div>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search roles…"
              className="pl-9"
            />
          </div>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            {filteredGroups.map((group) => (
              <div key={group.id}>
                <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.roles.map((role) => {
                    const active = role.key === selectedKey;
                    const capCount = PERMISSION_GROUPS.reduce(
                      (n, g) =>
                        n + g.permissions.filter((p) => (grants[p.key] ?? []).includes(role.key)).length,
                      0,
                    );
                    return (
                      <button
                        key={role.key}
                        type="button"
                        onClick={() => setSelectedKey(role.key)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
                          active
                            ? "bg-primary-500/15 text-primary-200 ring-1 ring-inset ring-primary-400/25"
                            : "text-slate-300 hover:bg-white/[0.04]",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{role.rankFull || role.rank}</span>
                        {capCount > 0 && (
                          <span className="shrink-0 text-[11px] text-slate-500">{capCount}</span>
                        )}
                        {!role.base && role.roleId && !SNOWFLAKE.test(String(role.roleId)) && (
                          <span className="size-1.5 shrink-0 rounded-full bg-amber-400" title="No Discord ID set" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected role */}
        <div>
          {!selected ? (
            <Card className="grid h-full place-items-center p-12 text-center">
              <div>
                <KeyRound className="mx-auto size-8 text-slate-600" />
                <p className="mt-3 text-sm text-slate-400">
                  Pick a role on the left to set its Discord ID and what it can do.
                </p>
              </div>
            </Card>
          ) : (
            <RolePanel
              role={selected}
              grants={grants}
              editable={editable}
              onToggle={toggleCap}
              onRoleId={setRoleId}
            />
          )}

          {selected && (
            <div className="mt-5 flex items-center justify-end gap-3">
              {lockout && (
                <span className="text-xs text-rose-300">
                  Someone must keep “Manage permissions”.
                </span>
              )}
              <Button size="sm" onClick={save} disabled={!editable || !dirty || saving || lockout}>
                {saving ? "Saving…" : "Save access"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Per-department fine-grained access lives with each department. */}
      <section className="mt-10">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
          Department hubs
        </h2>
        <p className="mb-4 max-w-2xl text-sm text-slate-500">
          Everything above is community-wide. Each department also has its own Access &amp; Roles
          table for its internal ranks — open a department to manage it. The community-wide
          “Manage departments” capability opens every one.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(deptList ?? []).map((dept) => (
            <Card key={dept.id} className="flex items-center gap-3 p-4">
              {DEPARTMENTS.find((d) => d.id === dept.id) && (
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-slate-300 ring-1 ring-inset ring-white/10">
                  {createElement(iconFor(DEPARTMENTS.find((d) => d.id === dept.id)?.icon ?? "Shield"), {
                    className: "size-4",
                  })}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {dept.name ?? dept.label ?? dept.id}
                </p>
                <p className="text-xs text-slate-500">Access &amp; Roles</p>
              </div>
              <Button as={Link} to={`/departments/${dept.id}/hub/access`} variant="ghost" size="sm">
                Open
                <ArrowRight className="size-4" />
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* Reference to the underlying matrix for power users. */}
      <p className="mt-8 text-xs text-slate-600">
        Prefer the full capability × role matrix?{" "}
        <Link to="/staff-hub/permissions" className="text-primary-400 hover:underline">
          Open the permissions matrix
        </Link>
        {" · "}
        <Link to="/staff-hub/discord-roles" className="text-primary-400 hover:underline">
          Discord Role Mapping
        </Link>
        .
      </p>
    </>
  );
}

/** The selected role: its Discord ID, and every site capability as a toggle tile. */
function RolePanel({ role, grants, editable, onToggle, onRoleId }) {
  const idOk = SNOWFLAKE.test(String(role.roleId ?? "").trim());

  return (
    <Card className="p-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold text-white">{role.rankFull || role.rank}</div>
          <code className="text-xs text-slate-500">{role.key}</code>
        </div>
      </div>

      {!role.base && (
        <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <label className="mb-1.5 block text-xs font-semibold text-slate-400" htmlFor="ac-roleid">
            Discord role ID
          </label>
          <TextInput
            id="ac-roleid"
            value={role.roleId ?? ""}
            onChange={(e) => onRoleId(e.target.value.trim())}
            placeholder="e.g. 1534911043426451466"
            disabled={!editable}
          />
          <p className="mt-1.5 text-[11px] text-slate-500">
            {idOk ? (
              <span className="text-emerald-400">Mapped — the bot resolves this role by this ID.</span>
            ) : (
              <span className="text-amber-400">
                No valid Discord ID yet. Right-click the role in Discord → Copy Role ID, then paste it here.
              </span>
            )}
          </p>
        </div>
      )}

      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
        Site-wide capabilities
      </p>
      <div className="space-y-5">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.id ?? group.label}>
            <p className="mb-2 text-xs font-semibold text-slate-400">{group.label}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.permissions.map((permission) => {
                const on = (grants[permission.key] ?? []).includes(role.key);
                return (
                  <button
                    key={permission.key}
                    type="button"
                    disabled={!editable}
                    onClick={() => onToggle(permission.key)}
                    title={permission.detail}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl p-3 text-left ring-1 ring-inset transition",
                      on
                        ? "bg-primary-500/12 text-primary-100 ring-primary-400/30"
                        : "bg-white/[0.02] text-slate-400 ring-white/[0.06]",
                      editable ? "hover:bg-white/[0.05]" : "cursor-not-allowed opacity-70",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded ring-1 ring-inset",
                        on ? "bg-primary-500 ring-transparent text-white" : "ring-white/20",
                      )}
                    >
                      {on && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">{permission.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug opacity-80">
                        {permission.detail}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
