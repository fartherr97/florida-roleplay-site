import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Car,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import CopyField from "../../components/ui/CopyField";
import Field from "../../components/ui/Field";
import Modal from "../../components/ui/Modal";
import Select from "../../components/ui/Select";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import AccessDenied from "../../components/auth/AccessDenied";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { cn } from "../../lib/cn";
import { relativeTime } from "../../lib/format";
import { VEHICLE_LIBRARIES, claimStatusLabel, claimStatusTone } from "../../lib/devhub";

/**
 * The vehicle library.
 *
 * Two tabs of personal vehicles — Law Enforcement and Civilian — that a member
 * can claim for themselves. A claim waits on a Director or Owner; activating it
 * is what reveals the spawn code, and the API withholds the code until then, so
 * nothing here is merely hidden. Managers (development.manage) maintain the
 * entries in place; activators (development.claims.manage) work the claims.
 */
const OTHER_TAB = { id: "other", label: "Other", tone: "violet" };
const FILTERS = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "claimed", label: "Claimed" },
];

const EMPTY = { vehicles: [], myClaims: [], claims: [], canManage: false, canActivate: false };

function tabOf(vehicle) {
  return vehicle.library ?? OTHER_TAB.id;
}

/** Sort so the cars you can still claim come first, then by name. */
function sortVehicles(list) {
  const rank = (v) => (!v.available ? 3 : !v.claim ? 0 : v.claim.mine ? 1 : 2);
  return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export default function DevLibrary() {
  const { user, loading } = useAuth();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(VEHICLE_LIBRARIES[0].id);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // vehicle | "new" | null
  const [deleting, setDeleting] = useState(null); // vehicle | null
  const [claiming, setClaiming] = useState(null); // vehicle | null
  const [deciding, setDeciding] = useState(null); // { claim, action } | null
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const reload = useCallback(() => api.devVehicles().then((r) => setData(r ?? EMPTY)).catch(() => setData(EMPTY)), []);
  useEffect(() => {
    let active = true;
    api.devVehicles()
      .then((r) => active && setData(r ?? EMPTY))
      .catch(() => active && setData(EMPTY));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const vehicles = useMemo(() => data?.vehicles ?? [], [data]);
  const tabs = useMemo(() => {
    const list = [...VEHICLE_LIBRARIES];
    if (vehicles.some((v) => !v.library)) list.push(OTHER_TAB);
    return list.map((t) => ({ ...t, count: vehicles.filter((v) => tabOf(v) === t.id).length }));
  }, [vehicles]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sortVehicles(
      vehicles.filter((v) => {
        if (tabOf(v) !== tab) return false;
        if (filter === "available" && (v.claim || !v.available)) return false;
        if (filter === "claimed" && !v.claim) return false;
        if (!needle) return true;
        return [v.name, v.year, v.make, v.model, v.liveries, v.developer, v.spawnCode, v.category, v.claim?.memberName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle);
      }),
    );
  }, [vehicles, tab, filter, query]);

  if (loading) return null;
  if (!user) return <AccessDenied reason="signed-out" />;

  const canManage = data?.canManage ?? false;
  const canActivate = data?.canActivate ?? false;
  const myOpen = (data?.myClaims ?? []).filter((c) => c.status === "pending" || c.status === "active");
  const pending = (data?.claims ?? []).filter((c) => c.status === "pending");

  async function run(action, success) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result?.ok) {
      setNotice({ tone: "green", text: success });
      reload();
      return true;
    }
    setNotice({ tone: "rose", text: result?.message ?? "That did not go through." });
    return false;
  }

  return (
    <Section className="max-w-6xl">
      <PageHeader
        eyebrow="Development"
        title="Vehicle library"
        subtitle="Personal vehicles you can claim as your own. A Director or Owner activates your claim — then your spawn code appears here."
        actions={
          canManage && (
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" />
              Add vehicle
            </Button>
          )
        }
      />

      {notice && (
        <div
          role="status"
          className={cn(
            "mb-6 rounded-xl px-4 py-3 text-sm ring-1 ring-inset",
            notice.tone === "green" ? "bg-green-500/10 text-green-200 ring-green-400/25" : "bg-rose-500/10 text-rose-200 ring-rose-400/25",
          )}
        >
          {notice.text}
        </div>
      )}

      {myOpen.length > 0 && <MyVehicles claims={myOpen} busy={busy} onWithdraw={(c) => run(() => api.withdrawDevVehicleClaim(c.vehicleId), "Claim withdrawn.")} />}

      {canActivate && (
        <PendingClaims
          claims={pending}
          busy={busy}
          onActivate={(c) => run(() => api.decideDevVehicleClaim(c.id, "activate"), `${c.vehicle.name} activated for ${c.memberName}.`)}
          onDeny={(c) => setDeciding({ claim: c, action: "deny" })}
        />
      )}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div role="tablist" aria-label="Vehicle libraries" className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold tracking-tight ring-1 ring-inset transition",
                  active ? "bg-white/[0.08] text-white ring-white/20" : "bg-white/[0.02] text-slate-400 ring-white/10 hover:text-white",
                )}
              >
                {t.label}
                <span className={cn("rounded-full px-2 py-0.5 text-[11px]", active ? "bg-primary-500/20 text-primary-200" : "bg-white/[0.06] text-slate-400")}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-1 rounded-xl bg-white/[0.02] p-1 ring-1 ring-inset ring-white/10">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition",
                filter === f.id ? "bg-white/[0.08] text-white" : "text-slate-500 hover:text-slate-300",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by year, make, model or spawn code…"
          aria-label="Search vehicles"
          style={{ paddingLeft: "2.5rem" }}
        />
      </div>

      {data === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((n) => <div key={n} className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />)}
        </div>
      ) : shown.length === 0 ? (
        <Card className="p-12 text-center">
          <Car className="mx-auto size-6 text-slate-500" />
          <p className="mt-2 text-sm text-slate-400">No vehicles match that.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              canManage={canManage}
              canActivate={canActivate}
              busy={busy}
              onClaim={() => setClaiming(vehicle)}
              onWithdraw={() => run(() => api.withdrawDevVehicleClaim(vehicle.id), "Claim withdrawn.")}
              onRelease={() => setDeciding({ claim: { ...vehicle.claim, vehicle }, action: "release" })}
              onEdit={() => setEditing(vehicle)}
              onDelete={() => setDeleting(vehicle)}
            />
          ))}
        </div>
      )}

      {claiming && (
        <ClaimDialog
          vehicle={claiming}
          busy={busy}
          onClose={() => setClaiming(null)}
          onConfirm={async (note) => {
            const ok = await run(() => api.claimDevVehicle(claiming.id, note), `${claiming.name} claimed — waiting on a Director or Owner.`);
            if (ok) setClaiming(null);
          }}
        />
      )}

      {deciding && (
        <DecisionDialog
          claim={deciding.claim}
          action={deciding.action}
          busy={busy}
          onClose={() => setDeciding(null)}
          onConfirm={async (note) => {
            const label = deciding.action === "deny" ? "Claim denied." : `${deciding.claim.vehicle?.name ?? "Vehicle"} released back to the library.`;
            const ok = await run(() => api.decideDevVehicleClaim(deciding.claim.id, deciding.action, note), label);
            if (ok) setDeciding(null);
          }}
        />
      )}

      {editing && (
        <VehicleEditor
          vehicle={editing === "new" ? null : editing}
          defaultLibrary={tab === OTHER_TAB.id ? "" : tab}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Remove vehicle">
        <p className="text-sm leading-relaxed text-slate-300">
          Remove <span className="font-semibold text-white">{deleting?.name}</span> from the library? Any claim on it goes with it. This can&apos;t be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              const target = deleting;
              setDeleting(null);
              await run(() => api.deleteDevVehicle(target.id), `${target.name} removed.`);
            }}
          >
            <Trash2 className="size-4" />
            Remove
          </Button>
        </div>
      </Modal>
    </Section>
  );
}

/* ------------------------------------------------------------------ *
 * Panels
 * ------------------------------------------------------------------ */

function MyVehicles({ claims, busy, onWithdraw }) {
  return (
    <Card className="mb-6 p-5">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound className="size-4 text-primary-400" />
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">My vehicles</h2>
      </div>
      <ul className="divide-y divide-white/[0.06]">
        {claims.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{c.vehicle.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {c.status === "active"
                  ? `Activated${c.decidedByName ? ` by ${c.decidedByName}` : ""}${c.decidedAt ? ` ${relativeTime(c.decidedAt)}` : ""}`
                  : `Claimed ${relativeTime(c.createdAt)} — waiting on a Director or Owner`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={claimStatusTone(c.status)} dot>
                {claimStatusLabel(c.status)}
              </Badge>
              {c.status === "active" && c.vehicle.spawnCode ? (
                <CopyField value={c.vehicle.spawnCode} label="Spawn" codeClassName="text-primary-200" />
              ) : (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => onWithdraw(c)}>
                  <X className="size-4" />
                  Withdraw
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PendingClaims({ claims, busy, onActivate, onDeny }) {
  return (
    <Card className="mb-6 p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-amber-300" />
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-300">Claims awaiting activation</h2>
        </div>
        <Badge tone={claims.length ? "amber" : "slate"}>{claims.length}</Badge>
      </div>
      {claims.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing waiting. A member&apos;s claim shows up here the moment they make it.</p>
      ) : (
        <ul className="divide-y divide-white/[0.06]">
          {claims.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {c.memberName} <span className="font-normal text-slate-500">wants</span> {c.vehicle.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {relativeTime(c.createdAt)}
                  {c.vehicle.spawnCode ? <> · <code className="text-slate-400">{c.vehicle.spawnCode}</code></> : null}
                  {c.note ? <> · “{c.note}”</> : null}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => onActivate(c)}>
                  <Check className="size-4" />
                  Activate
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => onDeny(c)}>
                  <X className="size-4" />
                  Deny
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Card
 * ------------------------------------------------------------------ */

function statusOf(vehicle) {
  if (!vehicle.available) return { tone: "slate", label: "Retired" };
  const claim = vehicle.claim;
  if (!claim) return { tone: "green", label: vehicle.claimable ? "Available" : "Reference" };
  if (claim.mine) return { tone: claim.status === "active" ? "brand" : "amber", label: claim.status === "active" ? "Yours" : "Your claim is pending" };
  return { tone: claim.status === "active" ? "slate" : "amber", label: claim.status === "active" ? `Claimed by ${claim.memberName}` : "Claim pending" };
}

function VehicleCard({ vehicle, canManage, canActivate, busy, onClaim, onWithdraw, onRelease, onEdit, onDelete }) {
  const [copied, setCopied] = useState(false);
  const status = statusOf(vehicle);
  const claim = vehicle.claim;
  const needsId = canManage && (vehicle.confidence === "low" || !vehicle.make || vehicle.make.toLowerCase() === "unknown");
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
      <div
        className={cn(
          "relative grid h-32 place-items-center bg-gradient-to-br via-white/[0.02] to-black/30",
          vehicle.library === "leo" ? "from-sky-500/15" : vehicle.library === "civ" ? "from-emerald-500/15" : "from-violet-500/15",
        )}
      >
        {vehicle.image ? <img src={vehicle.image} alt="" className="h-full w-full object-cover" /> : <Car className="size-10 text-white/25" />}
        <span className="absolute right-2 top-2 flex gap-1">
          {needsId && <Badge tone="rose">Needs ID</Badge>}
          <Badge tone={status.tone} dot={Boolean(claim)}>
            {status.label}
          </Badge>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-sm font-bold text-white">{vehicle.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {[vehicle.make && vehicle.make.toLowerCase() !== "unknown" ? vehicle.make : null, vehicle.model, vehicle.year]
              .filter(Boolean)
              .join(" · ") || "Details to be confirmed"}
            {vehicle.developer ? ` · ${vehicle.developer}` : ""}
          </p>
          {vehicle.liveries && (
            <p className="mt-1 text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-slate-500">Liveries</span> {vehicle.liveries}
            </p>
          )}
        </div>

        {vehicle.spawnCode ? (
          <button
            type="button"
            onClick={copy}
            className="flex items-center justify-between gap-2 rounded-xl bg-black/30 px-3 py-2 text-left ring-1 ring-inset ring-white/[0.06] transition hover:ring-white/15"
          >
            <code className="truncate text-xs text-slate-200">{vehicle.spawnCode}</code>
            {copied ? <Check className="size-4 shrink-0 text-emerald-400" /> : <Copy className="size-4 shrink-0 text-slate-400" />}
          </button>
        ) : (
          vehicle.claimable && (
            <p className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-xs text-slate-500 ring-1 ring-inset ring-white/[0.04]">
              <Lock className="size-3.5 shrink-0" />
              Spawn code unlocks once a Director or Owner activates a claim.
            </p>
          )
        )}

        {canManage && vehicle.notes && <p className="text-xs leading-relaxed text-slate-500">{vehicle.notes}</p>}

        <div className="mt-auto flex flex-wrap items-center gap-2">
          {vehicle.claimable && vehicle.available && !claim && (
            <Button size="sm" disabled={busy} onClick={onClaim}>
              <KeyRound className="size-4" />
              Claim
            </Button>
          )}
          {claim?.mine && claim.status === "pending" && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onWithdraw}>
              <X className="size-4" />
              Withdraw
            </Button>
          )}
          {canActivate && claim && claim.status === "active" && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onRelease}>
              <Undo2 className="size-4" />
              Release
            </Button>
          )}
          {vehicle.source && (
            <Button as="a" href={vehicle.source} target="_blank" rel="noreferrer" variant="ghost" size="sm">
              <ExternalLink className="size-4" />
              Source
            </Button>
          )}
          {canManage && (
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                onClick={onEdit}
                aria-label="Edit"
                className="grid size-8 place-items-center rounded-lg text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-white"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                aria-label="Delete"
                className="grid size-8 place-items-center rounded-lg text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Dialogs
 * ------------------------------------------------------------------ */

function ClaimDialog({ vehicle, busy, onClose, onConfirm }) {
  const [note, setNote] = useState("");
  return (
    <Modal open onClose={onClose} title="Claim this vehicle" subtitle={vehicle.name}>
      <p className="text-sm leading-relaxed text-slate-300">
        This puts the vehicle on hold for you and sends the claim to a Director or Owner. Once they activate it, the spawn code
        appears under <span className="font-semibold text-white">My vehicles</span> at the top of the library.
      </p>
      <Field label="Note for the activator" hint="Optional — your character, department or why this one." className="mt-4">
        <TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={busy} onClick={() => onConfirm(note)}>
          <KeyRound className="size-4" />
          Claim vehicle
        </Button>
      </div>
    </Modal>
  );
}

function DecisionDialog({ claim, action, busy, onClose, onConfirm }) {
  const [note, setNote] = useState("");
  const deny = action === "deny";
  return (
    <Modal open onClose={onClose} title={deny ? "Deny claim" : "Release vehicle"} subtitle={claim.vehicle?.name}>
      <p className="text-sm leading-relaxed text-slate-300">
        {deny
          ? `Turn down ${claim.memberName}'s claim. The vehicle goes straight back to the library.`
          : `Take ${claim.memberName}'s activated vehicle back. Their spawn code stops showing and the car becomes claimable again.`}
      </p>
      <Field label="Reason" hint="Optional — kept with the claim." className="mt-4">
        <TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => onConfirm(note)}>
          {deny ? <X className="size-4" /> : <Undo2 className="size-4" />}
          {deny ? "Deny" : "Release"}
        </Button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * Editor (development.manage)
 * ------------------------------------------------------------------ */

const LIBRARY_OPTIONS = [
  ...VEHICLE_LIBRARIES.map((l) => ({ value: l.id, label: l.label })),
  { value: "", label: "Other (reference only)" },
];
const CONFIDENCE_OPTIONS = [
  { value: "high", label: "High — named kit or label" },
  { value: "medium", label: "Medium — strong hint" },
  { value: "low", label: "Low — needs confirming" },
  { value: "", label: "Not set" },
];

function VehicleEditor({ vehicle, defaultLibrary = "", onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    id: vehicle?.id ?? `veh-${Math.random().toString(36).slice(2, 8)}`,
    name: vehicle?.name ?? "",
    year: vehicle?.year ?? "",
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    developer: vehicle?.developer ?? "",
    spawnCode: vehicle?.spawnCode ?? "",
    category: vehicle?.category ?? "",
    library: vehicle ? vehicle.library ?? "" : defaultLibrary,
    claimable: vehicle ? Boolean(vehicle.claimable) : Boolean(defaultLibrary),
    available: vehicle?.available ?? true,
    confidence: vehicle?.confidence ?? "",
    notes: vehicle?.notes ?? "",
    liveries: vehicle?.liveries ?? "",
    resource: vehicle?.resource ?? "",
    image: vehicle?.image ?? "",
    source: vehicle?.source ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const preview = [form.year, form.make, form.model].map((p) => p.trim()).filter(Boolean).join(" ");

  async function save() {
    if (!form.name.trim() && !preview) {
      setError("Give the vehicle a make and model, or a name.");
      return;
    }
    setSaving(true);
    // Year/make/model are the name for a personal — a hand-typed name only wins
    // when nothing else identifies the car.
    const result = await api.saveDevVehicle(form.id, { ...form, name: preview || form.name.trim() });
    setSaving(false);
    if (result?.ok) onSaved();
    else setError(result?.message ?? "That did not save.");
  }

  return (
    <Modal open onClose={onClose} title={vehicle ? "Edit vehicle" : "Add vehicle"} subtitle={preview || undefined}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Year">
            <TextInput value={form.year} onChange={(e) => set({ year: e.target.value })} placeholder="2023" inputMode="numeric" />
          </Field>
          <Field label="Make" required>
            <TextInput value={form.make} onChange={(e) => set({ make: e.target.value })} placeholder="Chevrolet" />
          </Field>
          <Field label="Model" required>
            <TextInput value={form.model} onChange={(e) => set({ model: e.target.value })} placeholder="Tahoe PPV" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Spawn code" hint="Withheld from members until their claim is activated.">
            <TextInput value={form.spawnCode} onChange={(e) => set({ spawnCode: e.target.value })} className="font-mono text-sm" />
          </Field>
          <Field label="Library tab">
            <Select value={form.library} options={LIBRARY_OPTIONS} onChange={(v) => set({ library: v })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Claimable">
            <Select
              value={form.claimable ? "yes" : "no"}
              options={[{ value: "yes", label: "Members can claim it" }, { value: "no", label: "Reference only" }]}
              onChange={(v) => set({ claimable: v === "yes" })}
            />
          </Field>
          <Field label="Availability">
            <Select
              value={form.available ? "yes" : "no"}
              options={[{ value: "yes", label: "Available" }, { value: "no", label: "Retired" }]}
              onChange={(v) => set({ available: v === "yes" })}
            />
          </Field>
          <Field label="Identification">
            <Select value={form.confidence} options={CONFIDENCE_OPTIONS} onChange={(v) => set({ confidence: v })} />
          </Field>
        </div>
        <Field label="Department liveries" hint="What is painted on it, e.g. FHP · HCSO. Shown to members.">
          <TextInput value={form.liveries} onChange={(e) => set({ liveries: e.target.value })} placeholder="FHP" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Developer">
            <TextInput value={form.developer} onChange={(e) => set({ developer: e.target.value })} />
          </Field>
          <Field label="Resource" hint="The FiveM resource that streams it.">
            <TextInput value={form.resource} onChange={(e) => set({ resource: e.target.value })} className="font-mono text-sm" />
          </Field>
        </div>
        <Field label="Internal notes" hint="Only managers and activators see these.">
          <TextArea rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={2000} />
        </Field>
        <Field label="Image URL">
          <TextInput value={form.image} onChange={(e) => set({ image: e.target.value })} placeholder="https://www.flrp.us/images/…" />
        </Field>
        <Field label="Source URL">
          <TextInput value={form.source} onChange={(e) => set({ source: e.target.value })} />
        </Field>
        {!preview && (
          <Field label="Display name" hint="Used only when there is no make and model.">
            <TextInput value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
        )}
        {error && <p className="text-sm text-rose-300">{error}</p>}
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
