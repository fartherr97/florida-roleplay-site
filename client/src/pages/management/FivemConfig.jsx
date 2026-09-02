import { useEffect, useMemo, useState } from "react";
import {
  Car,
  Check,
  Crosshair,
  DollarSign,
  Minus,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";
import { TextInput, TextArea } from "../../components/ui/TextInput";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { cn } from "../../lib/cn";

/**
 * The FiveM in-game config, edited from the website. This is the source of
 * truth the live server runs on: every save here writes to the site database
 * AND pushes the change to the FiveM server (flrp_api /sync), which re-applies
 * to online players immediately — no restart. See the flrp-server repo,
 * docs/LIVE_CONFIG_SYNC.md.
 *
 * Read is gated to `fivem.view`; every edit control is additionally gated to
 * `fivem.manage` (Head Admin / Directorship / Ownership).
 */

const TABS = [
  { id: "permissions", label: "Permissions", icon: ShieldCheck },
  { id: "pay", label: "Pay rates", icon: DollarSign },
  { id: "weapons", label: "Weapons", icon: Crosshair },
  { id: "vehicles", label: "Vehicles", icon: Car },
];

// Tri-state cell cycles allow -> deny -> inherit -> allow.
const NEXT_EFFECT = { allow: "deny", deny: "inherit", inherit: "allow" };

const dollars = (cents) =>
  ((Number(cents) || 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

export default function FivemConfig() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("fivem.manage");

  const [tab, setTab] = useState("permissions");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [resyncing, setResyncing] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .fivemCatalogue()
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setStatus({ tone: "rose", text: err.message ?? "Failed to load config." });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const flash = (tone, text) => setStatus({ tone, text });

  const resync = async () => {
    setResyncing(true);
    try {
      const r = await api.resyncFivem();
      flash(r?.ok === false ? "amber" : "green", r?.message ?? "Re-pushed the full config to the server.");
    } catch (err) {
      flash("rose", err.message ?? "Resync failed.");
    } finally {
      setResyncing(false);
    }
  };

  return (
    <Section>
      <PageHeader
        eyebrow="Management"
        title="FiveM Config"
        subtitle="In-game permissions, pay, weapons and vehicles for the live server. Every save pushes to the server instantly — no restart."
        backTo="/"
        backLabel="Home"
        actions={
          <>
            <Badge tone="rose">{canManage ? "Ownership / Command" : "Read-only"}</Badge>
            {canManage && (
              <Button variant="ghost" size="sm" onClick={resync} disabled={resyncing}>
                <RefreshCw className={cn("size-4", resyncing && "animate-spin")} />
                {resyncing ? "Re-pushing…" : "Re-push all"}
              </Button>
            )}
          </>
        }
      />

      {!canManage && (
        <Card className="mb-6 flex items-start gap-3 p-4 ring-1 ring-inset ring-amber-400/20">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <p className="text-sm text-slate-300">
            You can view the live config but not change it. Editing needs the{" "}
            <code className="text-xs text-slate-400">fivem.manage</code> permission
            (Head Admin, Directorship or Ownership).
          </p>
        </Card>
      )}

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

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-inset transition",
                on
                  ? "bg-primary-500 text-white ring-primary-400/50"
                  : "bg-white/[0.03] text-slate-400 ring-white/10 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-slate-500">Loading live config…</Card>
      ) : !data ? (
        <Card className="p-8 text-center text-sm text-rose-300">
          Could not load the FiveM config.
        </Card>
      ) : (
        <>
          {tab === "permissions" && (
            <PermissionsTab data={data} setData={setData} canManage={canManage} flash={flash} />
          )}
          {tab === "pay" && (
            <PayTab data={data} setData={setData} canManage={canManage} flash={flash} />
          )}
          {tab === "weapons" && (
            <WeaponsTab data={data} setData={setData} canManage={canManage} flash={flash} />
          )}
          {tab === "vehicles" && (
            <VehiclesTab data={data} setData={setData} canManage={canManage} flash={flash} />
          )}
        </>
      )}
    </Section>
  );
}

/* ====================================================================== *
 * Permissions matrix — roles × permissions, tri-state per cell.
 * ====================================================================== */
function PermissionsTab({ data, setData, canManage, flash }) {
  const roleGroups = useMemo(() => buildRoleColumns(data.roles ?? []), [data.roles]);
  const [group, setGroup] = useState(roleGroups[0]?.id ?? "all");

  const activeRoles = useMemo(
    () => roleGroups.find((g) => g.id === group)?.roles ?? [],
    [roleGroups, group],
  );

  // Quick lookup: `${role}|${perm}` -> effect
  const effectMap = useMemo(() => {
    const m = new Map();
    (data.role_permissions ?? []).forEach((rp) =>
      m.set(`${rp.role_key}|${rp.permission_key}`, rp.effect),
    );
    return m;
  }, [data.role_permissions]);

  const categories = useMemo(() => {
    const byCat = new Map();
    (data.permissions ?? []).forEach((p) => {
      const cat = p.category || "General";
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(p);
    });
    return [...byCat.entries()].map(([label, permissions]) => ({ label, permissions }));
  }, [data.permissions]);

  const cycle = async (roleKey, permissionKey, current) => {
    if (!canManage) return;
    const effect = NEXT_EFFECT[current] ?? "allow";
    // optimistic
    setData((prev) => {
      const rows = (prev.role_permissions ?? []).filter(
        (rp) => !(rp.role_key === roleKey && rp.permission_key === permissionKey),
      );
      if (effect !== "inherit") rows.push({ role_key: roleKey, permission_key: permissionKey, effect });
      return { ...prev, role_permissions: rows };
    });
    try {
      const r = await api.saveFivemGroupPermission({ roleKey, permissionKey, effect });
      if (r?.ok === false) flash("amber", r.message);
    } catch (err) {
      flash("rose", err.message ?? "Save failed.");
    }
  };

  if (!activeRoles.length) {
    return <Card className="p-8 text-center text-sm text-slate-500">No roles defined yet.</Card>;
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Click a cell to cycle{" "}
          <span className="text-emerald-300">allow</span> →{" "}
          <span className="text-rose-300">deny</span> →{" "}
          <span className="text-slate-400">inherit</span>. Deny always wins; inherit
          falls back to the permission's default. Staff tiers inherit upward.
        </p>
        <Select
          value={group}
          onChange={setGroup}
          options={roleGroups.map((g) => ({ value: g.id, label: `${g.label} (${g.roles.length})` }))}
          className="sm:w-56"
        />
      </div>

      <div className="space-y-6">
        {categories.map((cat) => (
          <Card key={cat.label} className="overflow-hidden">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <h2 className="text-sm font-bold text-white">{cat.label}</h2>
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
                        title={role.name}
                      >
                        {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {cat.permissions.map((perm) => (
                    <tr key={perm.key} className="transition hover:bg-white/[0.02]">
                      <td className="sticky left-0 z-10 bg-surface-1 px-5 py-3.5">
                        <p className="font-semibold text-white">{perm.key}</p>
                        {perm.description && (
                          <p className="mt-0.5 text-xs text-slate-500">{perm.description}</p>
                        )}
                        <code className="mt-1.5 inline-block text-[10px] text-slate-600">
                          default: {perm.default_effect}
                        </code>
                      </td>
                      {activeRoles.map((role) => {
                        const effect = effectMap.get(`${role.key}|${perm.key}`) ?? "inherit";
                        return (
                          <td key={role.key} className="px-3 py-3.5 text-center">
                            <button
                              type="button"
                              disabled={!canManage}
                              onClick={() => cycle(role.key, perm.key, effect)}
                              aria-label={`${perm.key} for ${role.name}: ${effect}`}
                              className={cn(
                                "grid size-6 place-items-center rounded-md ring-1 ring-inset transition",
                                !canManage && "cursor-not-allowed opacity-70",
                                effect === "allow"
                                  ? "bg-emerald-500/90 text-white ring-emerald-400/50"
                                  : effect === "deny"
                                    ? "bg-rose-500/90 text-white ring-rose-400/50"
                                    : "bg-white/[0.03] text-slate-600 ring-white/15 hover:bg-white/[0.08]",
                              )}
                            >
                              {effect === "allow" ? (
                                <Check className="size-3.5" />
                              ) : effect === "deny" ? (
                                <X className="size-3.5" />
                              ) : (
                                <Minus className="size-3.5" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function buildRoleColumns(roles) {
  const sorted = [...roles].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  const of = (kind) => sorted.filter((r) => r.kind === kind || (kind === "department" && r.is_department));
  const groups = [
    { id: "departments", label: "Departments", roles: sorted.filter((r) => r.is_department) },
    { id: "staff", label: "Staff", roles: of("staff").filter((r) => !r.is_department) },
    { id: "certification", label: "Certifications", roles: of("certification") },
    { id: "base", label: "Base", roles: of("base") },
  ].filter((g) => g.roles.length > 0);
  return groups.length ? groups : [{ id: "all", label: "All roles", roles: sorted }];
}

/* ====================================================================== *
 * Pay rates — role -> hourly, editable.
 * ====================================================================== */
function PayTab({ data, setData, canManage, flash }) {
  const rates = data.pay_rates ?? [];
  const roleName = useMemo(() => {
    const m = new Map();
    (data.roles ?? []).forEach((r) => m.set(r.key, r.name));
    return m;
  }, [data.roles]);

  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(rates.map((r) => [r.role_key, String((r.hourly_cents ?? 0) / 100)])),
  );

  const save = async (roleKey, enabled) => {
    if (!canManage) return;
    const cents = Math.round((parseFloat(drafts[roleKey]) || 0) * 100);
    setData((prev) => {
      const rows = (prev.pay_rates ?? []).filter((r) => r.role_key !== roleKey);
      rows.push({ role_key: roleKey, hourly_cents: cents, enabled });
      return { ...prev, pay_rates: rows };
    });
    try {
      const r = await api.saveFivemPayRate({ roleKey, hourlyCents: cents, enabled });
      flash(r?.ok === false ? "amber" : "green", r?.message ?? `Saved pay for ${roleName.get(roleKey) ?? roleKey}.`);
    } catch (err) {
      flash("rose", err.message ?? "Save failed.");
    }
  };

  if (!rates.length) {
    return <Card className="p-8 text-center text-sm text-slate-500">No pay rates configured yet.</Card>;
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.16em] text-slate-500">
              <th className="px-5 py-3 font-bold">Role</th>
              <th className="px-5 py-3 font-bold">Hourly (USD)</th>
              <th className="px-5 py-3 text-center font-bold">Enabled</th>
              <th className="px-5 py-3 text-right font-bold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rates.map((rate) => (
              <tr key={rate.role_key} className="transition hover:bg-white/[0.02]">
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-white">{roleName.get(rate.role_key) ?? rate.role_key}</p>
                  <code className="text-[10px] text-slate-600">{rate.role_key}</code>
                </td>
                <td className="px-5 py-3.5">
                  <TextInput
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!canManage}
                    value={drafts[rate.role_key] ?? ""}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [rate.role_key]: e.target.value }))
                    }
                    className="w-32"
                  />
                </td>
                <td className="px-5 py-3.5 text-center">
                  <Badge tone={rate.enabled ? "green" : "slate"}>
                    {rate.enabled ? "On" : "Off"}
                  </Badge>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" disabled={!canManage} onClick={() => save(rate.role_key, rate.enabled)}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!canManage}
                      onClick={() => save(rate.role_key, !rate.enabled)}
                    >
                      {rate.enabled ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ====================================================================== *
 * Weapons registry.
 * ====================================================================== */
function WeaponsTab({ data, setData, canManage, flash }) {
  const weapons = data.weapons ?? [];
  const [editing, setEditing] = useState(null);

  const persist = async (form) => {
    const payload = {
      weaponName: form.weapon_name,
      displayName: form.display_name,
      enabled: form.enabled,
      gunstoreAvailable: form.gunstore_available,
      priceCents: Math.round((parseFloat(form.price_dollars) || 0) * 100),
      certRequired: form.cert_required || null,
      requiredPermission: form.required_permission || null,
      vmenuSpawnable: form.vmenu_spawnable,
      notes: form.notes || null,
    };
    setData((prev) => {
      const rows = (prev.weapons ?? []).filter((w) => w.weapon_name !== payload.weaponName);
      rows.push({
        weapon_name: payload.weaponName,
        display_name: payload.displayName,
        enabled: payload.enabled,
        gunstore_available: payload.gunstoreAvailable,
        price_cents: payload.priceCents,
        cert_required: payload.certRequired,
        required_permission: payload.requiredPermission,
        vmenu_spawnable: payload.vmenuSpawnable,
        notes: payload.notes,
      });
      return { ...prev, weapons: rows };
    });
    setEditing(null);
    try {
      const r = await api.saveFivemWeapon(payload);
      flash(r?.ok === false ? "amber" : "green", r?.message ?? `Saved ${payload.displayName}.`);
    } catch (err) {
      flash("rose", err.message ?? "Save failed.");
    }
  };

  if (!weapons.length) {
    return <Card className="p-8 text-center text-sm text-slate-500">No weapons configured yet.</Card>;
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.16em] text-slate-500">
                <th className="px-5 py-3 font-bold">Weapon</th>
                <th className="px-5 py-3 font-bold">Gun store</th>
                <th className="px-5 py-3 font-bold">Price</th>
                <th className="px-5 py-3 font-bold">Cert</th>
                <th className="px-5 py-3 text-center font-bold">vMenu</th>
                <th className="px-5 py-3 text-center font-bold">Status</th>
                <th className="px-5 py-3 text-right font-bold">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {weapons.map((w) => (
                <tr key={w.weapon_name} className="transition hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-white">{w.display_name}</p>
                    <code className="text-[10px] text-slate-600">{w.weapon_name}</code>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge tone={w.gunstore_available ? "green" : "slate"}>
                      {w.gunstore_available ? "Available" : "No"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-slate-300">{dollars(w.price_cents)}</td>
                  <td className="px-5 py-3.5 text-slate-400">{w.cert_required || "—"}</td>
                  <td className="px-5 py-3.5 text-center">
                    <Badge tone={w.vmenu_spawnable ? "primary" : "slate"}>
                      {w.vmenu_spawnable ? "Yes" : "No"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <Badge tone={w.enabled ? "green" : "rose"}>{w.enabled ? "Enabled" : "Off"}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!canManage}
                      onClick={() => setEditing(w)}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <WeaponModal weapon={editing} onClose={() => setEditing(null)} onSave={persist} />
      )}
    </>
  );
}

function WeaponModal({ weapon, onClose, onSave }) {
  const [form, setForm] = useState({
    weapon_name: weapon.weapon_name,
    display_name: weapon.display_name ?? "",
    enabled: weapon.enabled !== false,
    gunstore_available: !!weapon.gunstore_available,
    price_dollars: String((weapon.price_cents ?? 0) / 100),
    cert_required: weapon.cert_required ?? "",
    required_permission: weapon.required_permission ?? "",
    vmenu_spawnable: !!weapon.vmenu_spawnable,
    notes: weapon.notes ?? "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open onClose={onClose} title={weapon.display_name} subtitle={weapon.weapon_name} className="max-w-lg">
      <div className="space-y-4">
        <Field label="Display name">
          <TextInput value={form.display_name} onChange={(e) => set("display_name", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Gun-store price (USD)">
            <TextInput
              type="number"
              min="0"
              step="0.01"
              value={form.price_dollars}
              onChange={(e) => set("price_dollars", e.target.value)}
            />
          </Field>
          <Field label="Certification required" hint="e.g. cert_civ_3, blank for none">
            <TextInput value={form.cert_required} onChange={(e) => set("cert_required", e.target.value)} />
          </Field>
        </div>
        <Field label="Required permission" hint="e.g. weapon.gunstore.purchase (optional)">
          <TextInput value={form.required_permission} onChange={(e) => set("required_permission", e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Toggle label="Enabled" on={form.enabled} onClick={() => set("enabled", !form.enabled)} />
          <Toggle
            label="Sold in gun store"
            on={form.gunstore_available}
            onClick={() => set("gunstore_available", !form.gunstore_available)}
          />
          <Toggle
            label="vMenu spawnable"
            on={form.vmenu_spawnable}
            onClick={() => set("vmenu_spawnable", !form.vmenu_spawnable)}
          />
        </div>
        <Field label="Notes">
          <TextArea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(form)}>
            Save &amp; push live
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ====================================================================== *
 * Vehicles registry.
 * ====================================================================== */
function VehiclesTab({ data, setData, canManage, flash }) {
  const vehicles = data.vehicles ?? [];
  const [editing, setEditing] = useState(null);

  const persist = async (form) => {
    const payload = {
      spawnName: form.spawn_name,
      displayName: form.display_name,
      resource: form.resource || null,
      department: form.department || null,
      category: form.category || null,
      minRank: form.min_rank || null,
      certification: form.certification || null,
      requiredPermission: form.required_permission || null,
      enabled: form.enabled,
      notes: form.notes || null,
    };
    setData((prev) => {
      const rows = (prev.vehicles ?? []).filter((v) => v.spawn_name !== payload.spawnName);
      rows.push({
        spawn_name: payload.spawnName,
        display_name: payload.displayName,
        resource: payload.resource,
        department: payload.department,
        category: payload.category,
        min_rank: payload.minRank,
        certification: payload.certification,
        required_permission: payload.requiredPermission,
        enabled: payload.enabled,
        notes: payload.notes,
      });
      return { ...prev, vehicles: rows };
    });
    setEditing(null);
    try {
      const r = await api.saveFivemVehicle(payload);
      flash(r?.ok === false ? "amber" : "green", r?.message ?? `Saved ${payload.displayName}.`);
    } catch (err) {
      flash("rose", err.message ?? "Save failed.");
    }
  };

  if (!vehicles.length) {
    return <Card className="p-8 text-center text-sm text-slate-500">No vehicles configured yet.</Card>;
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.16em] text-slate-500">
                <th className="px-5 py-3 font-bold">Vehicle</th>
                <th className="px-5 py-3 font-bold">Department</th>
                <th className="px-5 py-3 font-bold">Min rank</th>
                <th className="px-5 py-3 font-bold">Cert</th>
                <th className="px-5 py-3 text-center font-bold">Status</th>
                <th className="px-5 py-3 text-right font-bold">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {vehicles.map((v) => (
                <tr key={v.spawn_name} className="transition hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-white">{v.display_name}</p>
                    <code className="text-[10px] text-slate-600">{v.spawn_name}</code>
                  </td>
                  <td className="px-5 py-3.5 uppercase text-slate-300">{v.department || "—"}</td>
                  <td className="px-5 py-3.5 text-slate-400">{v.min_rank || "—"}</td>
                  <td className="px-5 py-3.5 text-slate-400">{v.certification || "—"}</td>
                  <td className="px-5 py-3.5 text-center">
                    <Badge tone={v.enabled ? "green" : "rose"}>{v.enabled ? "Enabled" : "Off"}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button size="sm" variant="secondary" disabled={!canManage} onClick={() => setEditing(v)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <VehicleModal vehicle={editing} onClose={() => setEditing(null)} onSave={persist} />
      )}
    </>
  );
}

function VehicleModal({ vehicle, onClose, onSave }) {
  const [form, setForm] = useState({
    spawn_name: vehicle.spawn_name,
    display_name: vehicle.display_name ?? "",
    resource: vehicle.resource ?? "",
    department: vehicle.department ?? "",
    category: vehicle.category ?? "",
    min_rank: vehicle.min_rank ?? "",
    certification: vehicle.certification ?? "",
    required_permission: vehicle.required_permission ?? "",
    enabled: vehicle.enabled !== false,
    notes: vehicle.notes ?? "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open onClose={onClose} title={vehicle.display_name} subtitle={vehicle.spawn_name} className="max-w-lg">
      <div className="space-y-4">
        <Field label="Display name">
          <TextInput value={form.display_name} onChange={(e) => set("display_name", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Department" hint="bso / fhp / mpd, blank for civilian">
            <TextInput value={form.department} onChange={(e) => set("department", e.target.value)} />
          </Field>
          <Field label="Category">
            <TextInput value={form.category} onChange={(e) => set("category", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Minimum rank" hint="patrol / supervisor / command">
            <TextInput value={form.min_rank} onChange={(e) => set("min_rank", e.target.value)} />
          </Field>
          <Field label="Certification">
            <TextInput value={form.certification} onChange={(e) => set("certification", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Resource" hint="the streamed vehicle resource">
            <TextInput value={form.resource} onChange={(e) => set("resource", e.target.value)} />
          </Field>
          <Field label="Required permission">
            <TextInput value={form.required_permission} onChange={(e) => set("required_permission", e.target.value)} />
          </Field>
        </div>
        <Toggle label="Enabled" on={form.enabled} onClick={() => set("enabled", !form.enabled)} />
        <Field label="Notes">
          <TextArea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(form)}>
            Save &amp; push live
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* A small pill toggle reused by the modals. */
function Toggle({ label, on, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ring-1 ring-inset transition",
        on
          ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/40"
          : "bg-white/[0.03] text-slate-400 ring-white/10 hover:bg-white/[0.06]",
      )}
    >
      {on ? <Check className="size-3.5" /> : <Minus className="size-3.5" />}
      {label}
    </button>
  );
}
