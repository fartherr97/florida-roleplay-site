import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldX,
  Trash2,
} from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import { TextInput, TextArea } from "../../components/ui/TextInput";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "packages", label: "Packages" },
  { id: "purchases", label: "Purchases" },
  { id: "audit", label: "Audit Log" },
];

const ENTITLEMENT_TYPES = [
  { value: "discord_role", label: "Discord role" },
  { value: "fivem_permission", label: "FiveM permission" },
  { value: "queue_priority", label: "Queue priority" },
  { value: "website_badge", label: "Website badge" },
  { value: "cosmetic", label: "Cosmetic" },
  { value: "other", label: "Other" },
];
const ENTITLEMENT_LABEL = Object.fromEntries(ENTITLEMENT_TYPES.map((t) => [t.value, t.label]));

function money(amount, currency) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(Number(amount));
  } catch {
    return `${currency || "USD"} ${Number(amount).toFixed(2)}`;
  }
}

function when(value) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}

/**
 * Ownership-only Store Management. The link and this page are hidden from anyone
 * without `store.manage`, but the boundary is the server: every endpoint these
 * tabs call is gated by the same permission, so entering the URL by hand yields
 * the site's standard access-denied page and no data.
 */
export default function StoreManagement() {
  const [tab, setTab] = useState("overview");

  return (
    <Section>
      <PageHeader
        eyebrow="Management"
        title="Store Management"
        subtitle="Sync packages from Tebex, decide how each appears on the store, map the FLRP entitlements a purchase grants, and track purchases and fulfillment. Tebex stays the payment platform — nothing here charges a card."
      />

      <div className="mb-8 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-semibold transition",
              tab === t.id ? "bg-primary-500/15 text-primary-200 ring-1 ring-inset ring-primary-400/30" : "text-slate-400 hover:bg-white/[0.06] hover:text-white",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "packages" && <PackagesTab />}
      {tab === "purchases" && <PurchasesTab />}
      {tab === "audit" && <AuditTab />}
    </Section>
  );
}

/* --------------------------------------------------------------- Overview */

function StatCard({ label, value, tone }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("mt-2 text-3xl font-extrabold tracking-tight", tone ?? "text-white")}>{value}</p>
    </Card>
  );
}

function OverviewTab() {
  const [data, setData] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(() => {
    api.storeOverview().then(setData).catch(() => setData(null));
  }, []);
  useEffect(load, [load]);

  async function sync() {
    setSyncing(true);
    setMsg(null);
    try {
      const res = await api.storeSync();
      if (res?.ok) {
        setMsg({ tone: "green", text: `Synced ${res.total} package${res.total === 1 ? "" : "s"} (${res.created} new, ${res.updated} updated).` });
        load();
      } else {
        setMsg({ tone: "rose", text: res?.message || "Sync failed." });
      }
    } catch (err) {
      setMsg({ tone: "rose", text: err?.message || "Sync failed." });
    } finally {
      setSyncing(false);
    }
  }

  if (!data) {
    return <Loading />;
  }

  const p = data.packages ?? {};
  const pur = data.purchases ?? {};

  return (
    <div className="space-y-6">
      {!data.configured && (
        <Notice tone="amber" icon={AlertTriangle}>
          The store isn't connected to Tebex yet. Set <code className="text-amber-200">TEBEX_STORE_TOKEN</code> (and{" "}
          <code className="text-amber-200">TEBEX_WEBHOOK_SECRET</code>) in the server environment, then sync.
        </Notice>
      )}
      {msg && (
        <Notice tone={msg.tone} icon={msg.tone === "green" ? CheckCircle2 : AlertTriangle}>
          {msg.text}
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Active packages" value={p.active ?? 0} />
        <StatCard label="Visible on store" value={p.visible ?? 0} />
        <StatCard label="Purchases" value={pur.total ?? 0} />
        <StatCard label="Pending fulfillment" value={pur.pendingFulfillment ?? 0} tone={pur.pendingFulfillment ? "text-amber-300" : "text-white"} />
        <StatCard label="Failed fulfillment" value={pur.failedFulfillment ?? 0} tone={pur.failedFulfillment ? "text-rose-300" : "text-white"} />
        <StatCard label="Revenue (settled)" value={money(pur.revenue, pur.currency)} tone="text-green-300" />
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="font-semibold text-white">Sync Tebex packages</p>
          <p className="mt-1 text-sm text-slate-400">
            Pulls package data from Tebex, preserving your display settings and entitlement mappings. Last sync:{" "}
            {when(data.lastSyncAt)}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.storeUrl && (
            <Button as="a" href={data.storeUrl} target="_blank" rel="noreferrer noopener" variant="ghost">
              Open in Tebex <ExternalLink className="size-4" />
            </Button>
          )}
          <Button onClick={sync} disabled={syncing || !data.configured}>
            {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- Packages */

function PackagesTab() {
  const [packages, setPackages] = useState(null);
  const [storeUrl, setStoreUrl] = useState("");
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    api
      .storeManagePackages()
      .then((d) => {
        setPackages(d?.packages ?? []);
        setStoreUrl(d?.storeUrl ?? "");
      })
      .catch(() => setPackages([]));
  }, []);
  useEffect(load, [load]);

  if (!packages) return <Loading />;
  if (packages.length === 0) {
    return (
      <Notice tone="slate" icon={AlertTriangle}>
        No packages yet. Run a sync from the Overview tab to pull them in from Tebex.
      </Notice>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-3 pr-4 font-semibold">Package</th>
              <th className="px-4 py-3 font-semibold">Price</th>
              <th className="px-4 py-3 font-semibold">Tebex</th>
              <th className="px-4 py-3 font-semibold">Visible</th>
              <th className="px-4 py-3 font-semibold">Entitlements</th>
              <th className="py-3 pl-4" />
            </tr>
          </thead>
          <tbody>
            {packages.map((pkg) => (
              <tr key={pkg.tebexPackageId} className="border-b border-white/[0.04]">
                <td className="py-3 pr-4">
                  <p className="font-semibold text-white">{pkg.name || pkg.tebexName}</p>
                  <p className="text-xs text-slate-500">
                    #{pkg.tebexPackageId}
                    {pkg.featured && " · Featured"}
                    {pkg.category && ` · ${pkg.category}`}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-300">{money(pkg.price, pkg.currency)}</td>
                <td className="px-4 py-3">
                  <Badge tone={pkg.tebexStatus === "active" ? "green" : "rose"} className="capitalize">
                    {pkg.tebexStatus}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={pkg.displayEnabled && pkg.active ? "green" : "slate"}>
                    {pkg.displayEnabled && pkg.active ? "Shown" : "Hidden"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-300">{pkg.entitlementCount ?? 0}</td>
                <td className="py-3 pl-4 text-right">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(pkg.tebexPackageId)}>
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <PackageEditor
          packageId={editing}
          storeUrl={storeUrl}
          onClose={() => setEditing(null)}
          onSaved={() => {
            load();
          }}
        />
      )}
    </>
  );
}

function PackageEditor({ packageId, storeUrl, onClose, onSaved }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState([]);

  const load = useCallback(() => {
    api.storePackage(packageId).then((d) => {
      setData(d);
      if (d?.package) {
        setForm({
          name: d.package.name ?? "",
          shortDescription: d.package.shortDescription ?? "",
          description: d.package.description ?? "",
          imageUrl: d.package.imageUrl ?? "",
          category: d.package.category ?? "",
          featured: Boolean(d.package.featured),
          displayEnabled: Boolean(d.package.displayEnabled),
          sortOrder: d.package.sortOrder ?? 0,
        });
      }
    });
  }, [packageId]);
  useEffect(load, [load]);
  useEffect(() => {
    api.storeDiscordRoles().then((d) => setRoles(d?.roles ?? [])).catch(() => setRoles([]));
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await api.storeUpdatePackage(packageId, {
        ...form,
        sortOrder: Number(form.sortOrder) || 0,
      });
      if (res?.ok) {
        onSaved();
        load();
      } else {
        setError(res?.message || "Couldn't save.");
      }
    } catch (err) {
      setError(err?.message || "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  const pkg = data?.package;

  return (
    <Modal open onClose={onClose} title={pkg ? pkg.name || pkg.tebexName : "Package"} subtitle={pkg ? `Tebex #${pkg.tebexPackageId}` : ""} className="max-w-2xl">
      {!data || !form ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          {/* Read-only Tebex facts */}
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-black/20 p-4 text-sm sm:grid-cols-4">
            <Fact label="Tebex name" value={pkg.tebexName} />
            <Fact label="Price" value={money(pkg.price, pkg.currency)} />
            <Fact label="Currency" value={pkg.currency} />
            <Fact label="Status" value={pkg.tebexStatus} />
          </div>
          {storeUrl && (
            <a href={storeUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-xs text-primary-300 hover:text-primary-200">
              Manage pricing &amp; deliverables in Tebex <ExternalLink className="size-3.5" />
            </a>
          )}

          <div className="space-y-4">
            <Field label="Display name">
              <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Short description" hint="One line, shown on the store card.">
              <TextInput value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} />
            </Field>
            <Field label="Full description">
              <TextArea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Image URL">
                <TextInput value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" />
              </Field>
              <Field label="Category">
                <TextInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Supporter" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Sort order">
                <TextInput type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
              </Field>
              <Field label="Featured">
                <Select value={form.featured ? "yes" : "no"} onChange={(v) => setForm({ ...form, featured: v === "yes" })} options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]} />
              </Field>
              <Field label="Shown on store">
                <Select value={form.displayEnabled ? "yes" : "no"} onChange={(v) => setForm({ ...form, displayEnabled: v === "yes" })} options={[{ value: "no", label: "Hidden" }, { value: "yes", label: "Shown" }]} />
              </Field>
            </div>
          </div>

          {error && <p className="text-sm text-rose-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save display settings
            </Button>
          </div>

          <EntitlementManager packageId={packageId} entitlements={data.entitlements ?? []} roles={roles} onChanged={load} />
        </div>
      )}
    </Modal>
  );
}

function EntitlementManager({ packageId, entitlements, roles, onChanged }) {
  const [type, setType] = useState("discord_role");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [duration, setDuration] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: String(r.id), label: r.name })),
    [roles],
  );
  const roleName = useCallback((id) => roles.find((r) => String(r.id) === String(id))?.name ?? id, [roles]);

  async function add() {
    setError("");
    if (!value.trim()) {
      setError("A value is required.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.storeAddEntitlement(packageId, {
        type,
        value: value.trim(),
        label: label.trim() || null,
        durationDays: duration ? Number(duration) : null,
        enabled: true,
      });
      if (res?.ok) {
        setValue("");
        setLabel("");
        setDuration("");
        onChanged();
      } else {
        setError(res?.message || "Couldn't add.");
      }
    } catch (err) {
      setError(err?.message || "Couldn't add.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    await api.storeDeleteEntitlement(id).catch(() => {});
    onChanged();
  }

  async function toggle(ent) {
    await api.storeUpdateEntitlement(ent.id, { enabled: !ent.enabled }).catch(() => {});
    onChanged();
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] p-4">
      <h3 className="text-sm font-bold text-white">Entitlements granted by this package</h3>
      <p className="mt-1 text-xs text-slate-500">
        What buying this package grants once Tebex confirms payment. Discord roles are applied by the bot; the rest are
        stored for the FiveM server to read.
      </p>

      <div className="mt-4 space-y-2">
        {entitlements.length === 0 && <p className="text-sm text-slate-500">No entitlements mapped yet.</p>}
        {entitlements.map((ent) => (
          <div key={ent.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-black/20 px-3 py-2 text-sm">
            <Badge tone={ent.enabled ? "primary" : "slate"}>{ENTITLEMENT_LABEL[ent.type] ?? ent.type}</Badge>
            <span className="font-medium text-white">
              {ent.type === "discord_role" ? roleName(ent.value) : ent.value}
            </span>
            {ent.label && <span className="text-xs text-slate-500">{ent.label}</span>}
            <span className="text-xs text-slate-500">{ent.durationDays ? `${ent.durationDays} days` : "Permanent"}</span>
            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => toggle(ent)}>{ent.enabled ? "Disable" : "Enable"}</Button>
              <button type="button" onClick={() => remove(ent.id)} aria-label="Remove" className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 rounded-xl bg-black/20 p-3 sm:grid-cols-2">
        <Field label="Type">
          <Select value={type} onChange={(v) => { setType(v); setValue(""); }} options={ENTITLEMENT_TYPES} />
        </Field>
        <Field label={type === "discord_role" ? "Role" : "Value"} hint={type === "discord_role" ? undefined : "e.g. queue.priority.2"}>
          {type === "discord_role" ? (
            <Select value={value} onChange={setValue} options={roleOptions} placeholder={roleOptions.length ? "Choose a role" : "No roles loaded"} />
          ) : (
            <TextInput value={value} onChange={(e) => setValue(e.target.value)} placeholder="entitlement value" />
          )}
        </Field>
        <Field label="Label" hint="Optional, for your reference.">
          <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Gold Supporter" />
        </Field>
        <Field label="Duration (days)" hint="Blank for permanent.">
          <TextInput type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Permanent" />
        </Field>
        <div className="sm:col-span-2 flex items-center justify-between">
          {error ? <p className="text-sm text-rose-300">{error}</p> : <span />}
          <Button onClick={add} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add entitlement
          </Button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Purchases */

const PAYMENT_TONE = { completed: "green", pending: "amber", refunded: "slate", chargeback: "rose", revoked: "rose" };
const FULFILL_TONE = { fulfilled: "green", pending: "amber", partial: "amber", failed: "rose", revoked: "rose", none: "slate" };

function PurchasesTab() {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    const qs = params.toString();
    api
      .storePurchases(qs ? `?${qs}` : "")
      .then((d) => {
        setRows(d?.purchases ?? []);
        setTotal(d?.total ?? 0);
      })
      .catch(() => setRows([]));
  }, [q, status]);
  useEffect(load, [load]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search buyer, package or transaction…"
          className="max-w-xs"
        />
        <div className="w-44">
          <Select
            value={status}
            onChange={setStatus}
            options={[
              { value: "", label: "All statuses" },
              { value: "completed", label: "Completed" },
              { value: "pending", label: "Pending" },
              { value: "refunded", label: "Refunded" },
              { value: "chargeback", label: "Chargeback" },
              { value: "revoked", label: "Revoked" },
            ]}
          />
        </div>
        <span className="text-xs text-slate-500">{total} total</span>
      </div>

      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Notice tone="slate" icon={AlertTriangle}>No purchases match.</Notice>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-3 pr-4 font-semibold">Buyer</th>
                <th className="px-4 py-3 font-semibold">Package</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Fulfillment</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="py-3 pl-4" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-white/[0.04]">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-white">{p.username || "—"}</p>
                    <p className="text-xs text-slate-500">{p.userId || "unlinked"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{p.packageName}</td>
                  <td className="px-4 py-3 text-slate-300">{money(p.amount, p.currency)}</td>
                  <td className="px-4 py-3"><Badge tone={PAYMENT_TONE[p.paymentStatus] ?? "slate"} className="capitalize">{p.paymentStatus}</Badge></td>
                  <td className="px-4 py-3"><Badge tone={FULFILL_TONE[p.fulfillmentStatus] ?? "slate"} className="capitalize">{p.fulfillmentStatus}</Badge></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{when(p.createdAt)}</td>
                  <td className="py-3 pl-4 text-right">
                    <Button size="sm" variant="secondary" onClick={() => setOpen(p.id)}>View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <PurchaseDetail id={open} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  );
}

function PurchaseDetail({ id, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    api.storePurchase(id).then(setData).catch(() => setData(null));
  }, [id]);
  useEffect(load, [load]);

  async function retry() {
    setBusy("retry");
    await api.storeRetryFulfillment(id).catch(() => {});
    setBusy("");
    load();
    onChanged();
  }
  async function revoke() {
    setBusy("revoke");
    await api.storeRevokePurchase(id).catch(() => {});
    setBusy("");
    load();
    onChanged();
  }

  const p = data?.purchase;
  const fulfillments = data?.fulfillments ?? [];
  const canRetry = fulfillments.some((f) => f.action === "grant" && f.status !== "granted") || p?.fulfillmentStatus !== "fulfilled";

  return (
    <Modal open onClose={onClose} title="Purchase" subtitle={p ? p.packageName : ""} className="max-w-2xl">
      {!data || !p ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-black/20 p-4 text-sm sm:grid-cols-3">
            <Fact label="Buyer" value={p.username || "—"} />
            <Fact label="Discord ID" value={p.userId || "unlinked"} />
            <Fact label="Amount" value={money(p.amount, p.currency)} />
            <Fact label="Payment" value={p.paymentStatus} />
            <Fact label="Fulfillment" value={p.fulfillmentStatus} />
            <Fact label="Transaction" value={p.transactionId || "—"} />
            <Fact label="Date" value={when(p.createdAt)} />
            <Fact label="Subscription" value={p.isSubscription ? "Yes" : "No"} />
          </div>

          <div>
            <h3 className="text-sm font-bold text-white">Fulfillment ledger</h3>
            <div className="mt-3 space-y-2">
              {fulfillments.length === 0 && <p className="text-sm text-slate-500">Nothing recorded yet.</p>}
              {fulfillments.map((f) => (
                <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-black/20 px-3 py-2 text-sm">
                  <Badge tone={f.action === "revoke" ? "slate" : "primary"} className="capitalize">{f.action}</Badge>
                  <span className="text-slate-300">{ENTITLEMENT_LABEL[f.type] ?? f.type}</span>
                  <span className="font-mono text-xs text-slate-400">{f.value}</span>
                  <Badge tone={f.status === "granted" || f.status === "revoked" ? "green" : f.status === "failed" ? "rose" : "amber"} className="ml-auto capitalize">
                    {f.status}
                  </Badge>
                  {f.attempts > 1 && <span className="text-xs text-slate-500">×{f.attempts}</span>}
                  {f.lastError && <p className="w-full text-xs text-rose-300/80">{f.lastError}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {canRetry && (
              <Button variant="secondary" onClick={retry} disabled={Boolean(busy)}>
                {busy === "retry" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                Retry fulfillment
              </Button>
            )}
            <Button variant="danger" onClick={revoke} disabled={Boolean(busy)}>
              {busy === "revoke" ? <Loader2 className="size-4 animate-spin" /> : <ShieldX className="size-4" />}
              Revoke entitlements
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* --------------------------------------------------------------- Audit */

function AuditTab() {
  const [entries, setEntries] = useState(null);
  useEffect(() => {
    api.storeAudit().then((d) => setEntries(d?.entries ?? [])).catch(() => setEntries([]));
  }, []);

  if (!entries) return <Loading />;
  if (entries.length === 0) return <Notice tone="slate" icon={AlertTriangle}>No store activity recorded yet.</Notice>;

  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <Card key={e.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <Badge tone="slate" className="font-mono">{e.action}</Badge>
          <span className="text-slate-300">{e.actorName || "system"}</span>
          {e.target && <span className="text-xs text-slate-500">→ {e.target}</span>}
          <span className="ml-auto text-xs text-slate-500">{when(e.createdAt)}</span>
        </Card>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- shared */

function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
      <Loader2 className="size-5 animate-spin" /> Loading…
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 truncate font-medium capitalize text-white" title={String(value)}>{value || "—"}</p>
    </div>
  );
}

const NOTICE_TONES = {
  amber: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  rose: "border-rose-400/30 bg-rose-500/10 text-rose-200",
  green: "border-green-400/30 bg-green-500/10 text-green-200",
  slate: "border-white/10 bg-white/[0.04] text-slate-300",
};

function Notice({ tone, icon: Icon, children }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border px-5 py-4 text-sm", NOTICE_TONES[tone] ?? NOTICE_TONES.slate)}>
      {Icon && <Icon className="mt-0.5 size-5 shrink-0" />}
      <div className="flex-1">{children}</div>
    </div>
  );
}
