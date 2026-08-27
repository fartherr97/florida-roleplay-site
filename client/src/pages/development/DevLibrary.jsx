import { useEffect, useMemo, useState } from "react";
import { Car, Check, Copy, ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Modal from "../../components/ui/Modal";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import AccessDenied from "../../components/auth/AccessDenied";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { cn } from "../../lib/cn";

/**
 * The vehicle library: what's available to request, with a spawn code to copy.
 * Managers (development.manage) maintain it in place.
 */
export default function DevLibrary() {
  const { user, loading } = useAuth();
  const [data, setData] = useState(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // vehicle | "new" | null

  const reload = () => api.devVehicles().then(setData).catch(() => setData({ vehicles: [], canManage: false }));
  useEffect(() => {
    let active = true;
    api.devVehicles().then((r) => active && setData(r)).catch(() => active && setData({ vehicles: [], canManage: false }));
    return () => {
      active = false;
    };
  }, []);

  const vehicles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = data?.vehicles ?? [];
    if (!needle) return list;
    return list.filter((v) => [v.name, v.developer, v.spawnCode, v.category].join(" ").toLowerCase().includes(needle));
  }, [data, query]);

  if (loading) return null;
  if (!user) return <AccessDenied reason="signed-out" />;

  const canManage = data?.canManage ?? false;

  return (
    <Section className="max-w-6xl">
      <PageHeader
        eyebrow="Development"
        title="Vehicle library"
        subtitle="Vehicles you can request, with the spawn code to copy once you're approved."
        actions={
          canManage && (
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" />
              Add vehicle
            </Button>
          )
        }
      />

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, developer or spawn code…"
          aria-label="Search vehicles"
          style={{ paddingLeft: "2.5rem" }}
        />
      </div>

      {data === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((n) => <div key={n} className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />)}
        </div>
      ) : vehicles.length === 0 ? (
        <Card className="p-12 text-center">
          <Car className="mx-auto size-6 text-slate-500" />
          <p className="mt-2 text-sm text-slate-400">No vehicles match that.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              canManage={canManage}
              onEdit={() => setEditing(vehicle)}
              onDelete={async () => {
                if (!window.confirm(`Remove ${vehicle.name}?`)) return;
                const result = await api.deleteDevVehicle(vehicle.id);
                if (result?.ok) reload();
              }}
            />
          ))}
        </div>
      )}

      {editing && (
        <VehicleEditor
          vehicle={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </Section>
  );
}

function VehicleCard({ vehicle, canManage, onEdit, onDelete }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator?.clipboard?.writeText(vehicle.spawnCode ?? "").then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      },
      () => {},
    );
  };
  return (
    <Card className="flex flex-col overflow-hidden p-0">
      <div className="relative grid h-36 place-items-center bg-gradient-to-br from-violet-500/15 via-white/[0.02] to-black/30">
        {vehicle.image ? (
          <img src={vehicle.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <Car className="size-10 text-white/25" />
        )}
        <span className="absolute right-2 top-2">
          <Badge tone={vehicle.available ? "green" : "slate"}>{vehicle.available ? "Available" : "Retired"}</Badge>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-sm font-bold text-white">{vehicle.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {[vehicle.year, vehicle.developer].filter(Boolean).join(" · ")}
            {vehicle.category ? ` · ${vehicle.category}` : ""}
          </p>
        </div>
        {vehicle.spawnCode && (
          <button
            type="button"
            onClick={copy}
            className="flex items-center justify-between gap-2 rounded-xl bg-black/30 px-3 py-2 text-left ring-1 ring-inset ring-white/[0.06] transition hover:ring-white/15"
          >
            <code className="truncate text-xs text-slate-200">{vehicle.spawnCode}</code>
            {copied ? <Check className="size-4 shrink-0 text-emerald-400" /> : <Copy className="size-4 shrink-0 text-slate-400" />}
          </button>
        )}
        <div className="mt-auto flex items-center gap-2">
          {vehicle.source && (
            <Button as="a" href={vehicle.source} target="_blank" rel="noreferrer" variant="ghost" size="sm">
              <ExternalLink className="size-4" />
              Source
            </Button>
          )}
          {canManage && (
            <div className="ml-auto flex gap-1">
              <button type="button" onClick={onEdit} aria-label="Edit" className="grid size-8 place-items-center rounded-lg text-slate-400 ring-1 ring-inset ring-white/10 transition hover:text-white hover:bg-white/[0.06]">
                <Pencil className="size-4" />
              </button>
              <button type="button" onClick={onDelete} aria-label="Delete" className="grid size-8 place-items-center rounded-lg text-slate-400 ring-1 ring-inset ring-white/10 transition hover:text-rose-300 hover:bg-rose-500/10">
                <Trash2 className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function VehicleEditor({ vehicle, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    id: vehicle?.id ?? `veh-${Math.random().toString(36).slice(2, 8)}`,
    name: vehicle?.name ?? "",
    year: vehicle?.year ?? "",
    developer: vehicle?.developer ?? "",
    spawnCode: vehicle?.spawnCode ?? "",
    category: vehicle?.category ?? "",
    available: vehicle?.available ?? true,
    image: vehicle?.image ?? "",
    source: vehicle?.source ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  async function save() {
    if (!form.name.trim()) {
      setError("A vehicle needs a name.");
      return;
    }
    setSaving(true);
    const result = await api.saveDevVehicle(form.id, form);
    setSaving(false);
    if (result?.ok) onSaved();
    else setError(result?.message ?? "That did not save.");
  }

  return (
    <Modal open onClose={onClose} title={vehicle ? "Edit vehicle" : "Add vehicle"}>
      <div className="space-y-4">
        <Field label="Name" required>
          <TextInput value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Year">
            <TextInput value={form.year} onChange={(e) => set({ year: e.target.value })} />
          </Field>
          <Field label="Developer">
            <TextInput value={form.developer} onChange={(e) => set({ developer: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Spawn code">
            <TextInput value={form.spawnCode} onChange={(e) => set({ spawnCode: e.target.value })} className="font-mono text-sm" />
          </Field>
          <Field label="Category">
            <TextInput value={form.category} onChange={(e) => set({ category: e.target.value })} placeholder="Law enforcement, Civilian…" />
          </Field>
        </div>
        <Field label="Image URL">
          <TextInput value={form.image} onChange={(e) => set({ image: e.target.value })} placeholder="https://www.flrp.us/images/…" />
        </Field>
        <Field label="Source URL">
          <TextInput value={form.source} onChange={(e) => set({ source: e.target.value })} />
        </Field>
        <Field label="Availability">
          <Select
            value={form.available ? "yes" : "no"}
            options={[{ value: "yes", label: "Available" }, { value: "no", label: "Retired" }]}
            onChange={(v) => set({ available: v === "yes" })}
          />
        </Field>
        {error && <p className={cn("text-sm text-rose-300")}>{error}</p>}
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={saving} onClick={save}>
          {vehicle ? "Save changes" : "Add vehicle"}
        </Button>
      </div>
    </Modal>
  );
}
