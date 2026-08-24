import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import DaActionForm from "../../components/hub/DaActionForm";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { cn } from "../../lib/cn";
import { formatDateTime } from "../../lib/format";
import {
  ACTION_BODIES,
  ACTION_TYPES,
  actionLabel,
  actionTone,
  bodyLabel,
  canEditAction,
  canFileFor,
  filingBodiesFor,
} from "../../lib/discipline";

/**
 * The DA Hub — where an action is filed, and the list of what has been.
 *
 * The filing form sits collapsed at the top rather than on a page of its own,
 * because filing and checking what was already filed are the same visit: you
 * look up whether somebody has a history, then you add to it.
 *
 * Deleting voids rather than removes. The row stays, struck through with the
 * reason it was withdrawn — an action that quietly vanished is indistinguishable
 * from one that never happened, and the difference matters to whoever it was
 * filed against.
 */
export default function HubDaHub() {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("mine");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [voiding, setVoiding] = useState(null);
  const [editing, setEditing] = useState(null);

  const ctx = useMemo(() => {
    const held = ["discipline.file", "discipline.view", "discipline.manage"].filter((key) =>
      hasPermission(key),
    );
    return { user, roleKeys: user?.roles ?? [], permissions: new Set(held) };
  }, [user, hasPermission]);

  const load = useCallback(() => {
    let active = true;
    api
      .disciplinaryActions()
      .then((result) => active && setData(result))
      .catch(() => active && setData({ actions: [], mine: [], canViewAll: false, totals: { mine: 0, all: 0 } }));
    return () => {
      active = false;
    };
  }, []);

  useEffect(load, [load]);

  const rows = useMemo(() => {
    const list = tab === "mine" ? (data?.mine ?? []) : (data?.actions ?? []);
    const needle = query.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((action) =>
      [action.targetName, action.targetDiscordId, action.issuedByName, action.reason, actionLabel(action.type), bodyLabel(action.bodyId)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [data, tab, query]);

  const canFileAnywhere = filingBodiesFor(ctx).length > 0;
  const totals = data?.totals ?? { mine: 0, all: 0 };

  return (
    <>
      <HubPageHeader
        icon="Gavel"
        eyebrow="Staff Hub"
        title="Disciplinary Action Hub"
        subtitle="Every action taken against a member, by the staff team or by a department. This is the record /bgcheck reads in Discord."
      />

      {canFileAnywhere && (
        <Card className="mb-6 overflow-hidden">
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            aria-expanded={formOpen}
            className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/[0.02]"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-primary-500" aria-hidden />
            <span className="flex-1 text-sm font-bold text-white">Add disciplinary action</span>
            <ChevronDown className={cn("size-4 text-slate-500 transition-transform", formOpen && "rotate-180")} />
          </button>
          {formOpen && (
            <div className="border-t border-white/[0.06] px-5 py-5">
              <DaActionForm
                ctx={ctx}
                onFiled={() => {
                  setFormOpen(false);
                  load();
                }}
              />
            </div>
          )}
        </Card>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          <TabButton active={tab === "mine"} onClick={() => setTab("mine")} label="My actions" count={totals.mine} />
          {data?.canViewAll && (
            <TabButton active={tab === "all"} onClick={() => setTab("all")} label="All actions" count={totals.all} />
          )}
        </div>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, ID or reason"
            aria-label="Search actions"
            className="pl-10"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-bold text-white">
            <span className="size-1.5 rounded-full bg-primary-500" aria-hidden />
            {tab === "mine" ? "My recent actions" : "Every action"}
          </p>
        </div>

        {data === null ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((n) => (
              <div key={n} className="h-12 animate-pulse rounded-xl bg-white/[0.03]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">
            {query ? "Nothing matches that." : tab === "mine" ? "You have not filed any." : "Nothing on record."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="text-[0.68rem] uppercase tracking-[0.14em] text-slate-500">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-5 py-3 font-bold">ID</th>
                  <th className="px-3 py-3 font-bold">Type</th>
                  <th className="px-3 py-3 font-bold">Target</th>
                  <th className="px-3 py-3 font-bold">By</th>
                  <th className="px-3 py-3 font-bold">Body</th>
                  <th className="px-3 py-3 font-bold">Reason</th>
                  <th className="px-3 py-3 font-bold">Date</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {rows.map((action) => (
                  <tr key={action.id} className={cn("transition hover:bg-white/[0.02]", action.voided && "opacity-55")}>
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs tabular-nums text-slate-500">#{action.id}</td>
                    <td className="px-3 py-3.5">
                      <Badge tone={actionTone(action.type)}>{actionLabel(action.type)}</Badge>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className={cn("font-semibold text-white", action.voided && "line-through")}>
                        {action.targetName}
                      </p>
                      <code className="text-[0.68rem] text-slate-600">{action.targetDiscordId}</code>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="text-slate-300">{action.issuedByName}</p>
                      <code className="text-[0.68rem] text-slate-600">{action.issuedByDiscordId}</code>
                    </td>
                    <td className="px-3 py-3.5 text-xs text-slate-400">{bodyLabel(action.bodyId)}</td>
                    <td className="max-w-md px-3 py-3.5">
                      <p className="text-slate-300">{action.reason}</p>
                      {action.voided && (
                        <p className="mt-1 text-xs text-rose-300">Voided — {action.voidReason}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-xs text-slate-500">
                      {formatDateTime(action.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      {canEditAction(action, ctx) && !action.voided && (
                        <span className="flex justify-end gap-1.5">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(action)}>Edit</Button>
                          <Button variant="ghost" size="sm" onClick={() => setVoiding(action)}>Void</Button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <VoidModal
        action={voiding}
        onClose={() => setVoiding(null)}
        onDone={() => {
          setVoiding(null);
          load();
        }}
      />
      <EditModal
        action={editing}
        ctx={ctx}
        onClose={() => setEditing(null)}
        onDone={() => {
          setEditing(null);
          load();
        }}
      />
    </>
  );
}

function TabButton({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-inset transition",
        active
          ? "bg-primary-500/15 text-white ring-primary-400/40"
          : "bg-black/20 text-slate-400 ring-white/[0.06] hover:text-white",
      )}
    >
      {label} <span className="tabular-nums text-slate-500">({count})</span>
    </button>
  );
}

function VoidModal({ action, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const result = await api.voidDisciplinaryAction(action.id, reason);
    setBusy(false);
    if (result?.ok) {
      setReason("");
      onDone();
    } else {
      setError(result?.message ?? result?.errors?.reason ?? "That was not voided.");
    }
  }

  return (
    <Modal open={Boolean(action)} onClose={onClose} title="Void this action?">
      <p className="text-sm leading-relaxed text-slate-300">
        It stays on the record, struck through with your reason. Nothing is
        deleted — an action that quietly vanished looks exactly like one that
        never happened, and the member deserves the difference.
      </p>
      <Field label="Why it is being withdrawn" className="mt-4">
        <TextArea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={confirm} disabled={busy || reason.trim().length < 5}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Void it
        </Button>
      </div>
    </Modal>
  );
}

function EditModal({ action, ctx, onClose, onDone }) {
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Seed the form the first time this action opens, and reset when it changes.
  const key = action?.id ?? null;
  const [lastKey, setLastKey] = useState(null);
  if (key !== lastKey) {
    setLastKey(key);
    setDraft(action ? { ...action, expiresAt: action.expiresAt ? String(action.expiresAt).slice(0, 10) : "" } : null);
    setError(null);
  }

  const bodies = useMemo(() => ACTION_BODIES.filter((body) => canFileFor(body.id, ctx)), [ctx]);
  if (!action || !draft) return null;

  async function save() {
    setBusy(true);
    setError(null);
    const result = await api.updateDisciplinaryAction(action.id, {
      type: draft.type,
      bodyId: draft.bodyId,
      targetName: draft.targetName,
      reason: draft.reason,
      expiresAt: draft.expiresAt || null,
    });
    setBusy(false);
    if (result?.ok) onDone();
    else setError(result?.message ?? "That was not saved.");
  }

  return (
    <Modal open onClose={onClose} title={`Edit action #${action.id}`}>
      <div className="space-y-4">
        <Field label="Action">
          <Select
            value={draft.type}
            options={ACTION_TYPES.map((t) => ({ value: t.id, label: t.label }))}
            onChange={(type) => setDraft((d) => ({ ...d, type }))}
          />
        </Field>
        <Field label="Filed on behalf of">
          <Select
            value={draft.bodyId}
            options={bodies.map((b) => ({ value: b.id, label: b.label }))}
            onChange={(bodyId) => setDraft((d) => ({ ...d, bodyId }))}
          />
        </Field>
        <Field label="Member">
          <TextInput value={draft.targetName} onChange={(e) => setDraft((d) => ({ ...d, targetName: e.target.value }))} />
        </Field>
        <Field label="Reason">
          <TextArea rows={3} value={draft.reason} onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))} />
        </Field>
      </div>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </Modal>
  );
}
