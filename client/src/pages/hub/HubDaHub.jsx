import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, Plus, Search, ShieldAlert, TriangleAlert, UserRound, X } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";
import Select from "../../components/ui/Select";
import { TextArea, TextInput } from "../../components/ui/TextInput";
import DaActionForm from "../../components/hub/DaActionForm";
import { useAuth } from "../../context/useAuth";
import { api } from "../../lib/api";
import { formatDateTime, plural } from "../../lib/format";
import { cn } from "../../lib/cn";
import {
  ACTION_BODIES,
  ACTION_TYPES,
  DEFAULT_WINDOW_DAYS,
  actionLabel,
  actionTone,
  backgroundFor,
  bodyLabel,
  canEditAction,
  canFileFor,
  filingBodiesFor,
  isVerbal,
  sourceOf,
} from "../../lib/discipline";

const TYPE_OPTIONS = [
  { value: "all", label: "Every action" },
  { value: "verbal", label: "Verbal only" },
  { value: "nonverbal", label: "Non-verbal only" },
  ...ACTION_TYPES.map((t) => ({ value: t.id, label: t.label })),
];

const BODY_OPTIONS = [
  { value: "all", label: "Every body" },
  { value: "staff", label: "Staff — any" },
  { value: "department", label: "Departments — any" },
  ...ACTION_BODIES.map((b) => ({ value: b.id, label: b.label })),
];

const WINDOWS = [
  { value: "180", label: "Last 6 months" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last year" },
  { value: "all", label: "Everything" },
];

/**
 * The Disciplinary Action Hub — one page for the whole record.
 *
 * File an action, look somebody up by name or Discord ID, read the folded
 * background summary `/bgcheck` gives in Discord, and edit or void what has been
 * filed. It used to be two pages — a filing hub and a lookup database — which
 * only made a reviewer hop between them, since filing and checking a history are
 * the same visit.
 *
 * The access boundary is unchanged: everyone who can open the page sees what
 * they filed and can file where they are allowed, while searching the whole
 * record and reading anybody's background stay behind `discipline.view`. The
 * server decides that — a caller without it is simply never sent other people's
 * rows — and the lookup surface here hides itself to match.
 */
export default function HubDaHub() {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState(null);
  const [editing, setEditing] = useState(null);
  // Stamped once. A window boundary that slides while somebody is reading would
  // drop a row out from under them mid-scroll.
  const [asOf] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [body, setBody] = useState("all");
  const [window, setWindow] = useState(String(DEFAULT_WINDOW_DAYS));
  const [tab, setTab] = useState("mine");
  // A person picked from search (or "My records"). Drives the profile view.
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(() => {
    let active = true;
    api
      .disciplinaryActions()
      .then((result) => active && setData(result))
      .catch(
        () =>
          active &&
          setData({ actions: [], mine: [], canViewAll: false, totals: { mine: 0, all: 0 } }),
      );
    return () => {
      active = false;
    };
  }, []);

  useEffect(load, [load]);

  const ctx = useMemo(() => {
    const held = ["discipline.file", "discipline.view", "discipline.manage"].filter((key) =>
      hasPermission(key),
    );
    return { user, roleKeys: user?.roles ?? [], permissions: new Set(held) };
  }, [user, hasPermission]);

  const canFile = filingBodiesFor(ctx).length > 0;
  const canViewAll = data?.canViewAll === true;
  // Memoised to stable references so the lookup/filter memos below do not re-run
  // on every render.
  const allActions = useMemo(() => data?.actions ?? [], [data]);
  const mine = useMemo(() => data?.mine ?? [], [data]);
  const totals = data?.totals ?? { mine: 0, all: 0 };

  const windowDays = window === "all" ? 3650 : Number(window);

  // The rows the list draws from before search/type/body narrow them. Only a
  // viewer ever has "all"; everyone else only ever has their own.
  const source = canViewAll && tab === "all" ? allActions : mine;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const since = asOf - windowDays * 86_400_000;
    return source.filter((action) => {
      if (new Date(action.createdAt).getTime() < since) return false;
      if (type === "verbal" && !isVerbal(action.type)) return false;
      if (type === "nonverbal" && isVerbal(action.type)) return false;
      if (!["all", "verbal", "nonverbal"].includes(type) && action.type !== type) return false;
      if (body === "staff" && sourceOf(action.bodyId) !== "staff") return false;
      if (body === "department" && sourceOf(action.bodyId) !== "department") return false;
      if (!["all", "staff", "department"].includes(body) && action.bodyId !== body) return false;
      if (!needle) return true;
      return [action.targetName, action.targetDiscordId, action.issuedByName, action.reason]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [source, query, type, body, windowDays, asOf]);

  // Searching an exact Discord ID is a background check, not a search. A person
  // picked from the results (or "My records") takes precedence over the box.
  // Lookups of anyone's record need discipline.view, so a non-viewer never gets one.
  const idQuery = /^\d{17,20}$/.test(query.trim()) ? query.trim() : null;
  const subjectId = canViewAll ? (selectedId ?? idQuery) : null;

  const background = useMemo(
    () => (subjectId ? backgroundFor(allActions, { discordId: subjectId, windowDays, now: asOf }) : null),
    [subjectId, allActions, windowDays, asOf],
  );

  const nameForId = useCallback(
    (id) =>
      allActions
        .filter((action) => action.targetDiscordId === id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]?.targetName ?? "",
    [allActions],
  );

  const subjectName = subjectId
    ? subjectId === user?.id
      ? nameForId(subjectId) || user?.displayName || "You"
      : nameForId(subjectId) || "Unknown member"
    : "";

  // The distinct people a name/reason search turned up, so one click opens a
  // profile. Only for a viewer, when the box holds a name rather than an ID.
  const people = useMemo(() => {
    if (!canViewAll || subjectId || !query.trim()) return [];
    const map = new Map();
    for (const action of filtered) {
      const id = action.targetDiscordId;
      if (!id) continue;
      const at = new Date(action.createdAt).getTime();
      const seen = map.get(id);
      if (!seen) {
        map.set(id, { id, name: action.targetName, total: 1, latest: at });
      } else {
        seen.total += 1;
        if (at > seen.latest) {
          seen.latest = at;
          seen.name = action.targetName;
        }
      }
    }
    return [...map.values()].sort((a, b) => b.latest - a.latest);
  }, [filtered, query, subjectId, canViewAll]);

  // Filing against the record you are reading should not mean copying the ID
  // back out of the search box.
  const prefill = useMemo(() => {
    if (!subjectId) return undefined;
    return { targetDiscordId: subjectId, targetName: nameForId(subjectId) };
  }, [subjectId, nameForId]);

  // While a profile is open the row list is that person's own record.
  const subjectActions = useMemo(() => {
    if (!subjectId) return [];
    const since = asOf - windowDays * 86_400_000;
    return allActions
      .filter((action) => action.targetDiscordId === subjectId)
      .filter((action) => new Date(action.createdAt).getTime() >= since)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [subjectId, allActions, windowDays, asOf]);

  const clearSubject = () => {
    setSelectedId(null);
    if (idQuery) setQuery("");
  };

  const rows = subjectId ? subjectActions : filtered;

  return (
    <>
      <HubPageHeader
        icon="Gavel"
        eyebrow="Staff Hub"
        title="Disciplinary Action Hub"
        subtitle={
          canViewAll
            ? "Every action on record, across the staff team and every department. Paste a Discord ID for the same summary /bgcheck gives in Discord."
            : "File an action and see what you have filed. This is the record /bgcheck reads in Discord."
        }
        actions={
          <div className="flex items-center gap-3">
            <Badge tone="rose">Handle with discretion</Badge>
            {canViewAll && /^\d{17,20}$/.test(String(user?.id ?? "")) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedId(user.id);
                  setQuery("");
                }}
              >
                <UserRound className="size-4" />
                My records
              </Button>
            )}
            {canFile && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="size-4" />
                Add DA
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={canViewAll ? "Name, reason, or paste a Discord ID" : "Search what you have filed"}
            aria-label="Search the record"
            className="pl-11"
          />
        </div>
        <Select value={type} onChange={setType} options={TYPE_OPTIONS} />
        <Select value={body} onChange={setBody} options={BODY_OPTIONS} />
        <div className="sm:col-span-2 lg:col-span-4">
          <div className="flex flex-wrap items-center gap-2">
            {WINDOWS.map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => setWindow(entry.value)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition",
                  window === entry.value
                    ? "bg-primary-500/15 text-white ring-primary-400/40"
                    : "bg-black/20 text-slate-400 ring-white/[0.06] hover:text-white",
                )}
              >
                {entry.label}
              </button>
            ))}
            {/* Whose actions the list draws from, when you may see more than your own. */}
            {canViewAll && !subjectId && (
              <div className="ml-auto flex gap-2">
                <TabButton active={tab === "mine"} onClick={() => setTab("mine")} label="Mine" count={totals.mine} />
                <TabButton active={tab === "all"} onClick={() => setTab("all")} label="All" count={totals.all} />
              </div>
            )}
          </div>
        </div>
      </div>

      {people.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-500">
            {plural(people.length, "member")} found
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {people.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => setSelectedId(person.id)}
                className="flex items-center gap-3 rounded-xl bg-black/20 px-4 py-3 text-left ring-1 ring-inset ring-white/[0.06] transition hover:bg-white/[0.04] hover:ring-primary-400/30"
              >
                <UserRound className="size-4 shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{person.name}</span>
                  <code className="text-[0.68rem] text-slate-600">{person.id}</code>
                </span>
                <Badge tone="slate">{plural(person.total, "action")}</Badge>
                <ChevronRight className="size-4 shrink-0 text-slate-600" />
              </button>
            ))}
          </div>
        </div>
      )}

      {subjectId && (
        <div className="mb-3 flex items-center gap-3">
          <UserRound className="size-4 text-slate-400" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {subjectName}
              {subjectId === user?.id && <span className="ml-2 text-xs font-normal text-slate-500">— you</span>}
            </p>
            <code className="text-[0.68rem] text-slate-600">{subjectId}</code>
          </div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={clearSubject}>
            <X className="size-4" />
            Back to search
          </Button>
        </div>
      )}

      {background && <BackgroundPanel background={background} />}

      {data === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-20 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-slate-400">
            {subjectId
              ? "Nothing on record for this member in this window."
              : query
                ? "Nothing on record matches that."
                : canViewAll && tab === "all"
                  ? "Nothing on record."
                  : "You have not filed any."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((action) => (
            <Card key={action.id} className={cn("p-5", action.voided && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge tone={actionTone(action.type)}>{actionLabel(action.type)}</Badge>
                <Badge tone={sourceOf(action.bodyId) === "staff" ? "primary" : "brand"}>
                  {bodyLabel(action.bodyId)}
                </Badge>
                {action.voided && <Badge tone="slate">Voided</Badge>}
                <span className="ml-auto text-xs text-slate-500">{formatDateTime(action.createdAt)}</span>
              </div>
              <p className={cn("mt-3 text-sm font-semibold text-white", action.voided && "line-through")}>
                {action.targetName}{" "}
                <code className="ml-1 text-[0.68rem] font-normal text-slate-600">{action.targetDiscordId}</code>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{action.reason}</p>
              {action.voided && <p className="mt-1 text-xs text-rose-300">Withdrawn — {action.voidReason}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-xs text-slate-500">Filed by {action.issuedByName}</p>
                {canEditAction(action, ctx) && !action.voided && (
                  <span className="ml-auto flex gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(action)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setVoiding(action)}>
                      Void
                    </Button>
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add disciplinary action"
        subtitle="It lands on the same record /bgcheck reads in Discord."
        className="max-w-2xl"
      >
        <DaActionForm
          key={`${adding}:${prefill?.targetDiscordId ?? ""}`}
          ctx={ctx}
          prefill={prefill}
          onFiled={() => {
            setAdding(false);
            load();
          }}
        />
      </Modal>

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
        "rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition",
        active
          ? "bg-primary-500/15 text-white ring-primary-400/40"
          : "bg-black/20 text-slate-400 ring-white/[0.06] hover:text-white",
      )}
    >
      {label} <span className="tabular-nums text-slate-500">({count})</span>
    </button>
  );
}

/** The folded summary, laid out the way the Discord embed lays it out. Exported so the
 *  department-hub DA page renders the identical panel. */
export function BackgroundPanel({ background }) {
  const buckets = [
    { label: "Verbal · Staff", list: background.verbal.staff },
    { label: "Verbal · Department", list: background.verbal.department },
    { label: "Non-verbal · Staff", list: background.nonVerbal.staff },
    { label: "Non-verbal · Department", list: background.nonVerbal.department },
  ];

  return (
    <Card
      className={cn(
        "mb-6 p-6 ring-1 ring-inset",
        background.total === 0
          ? "ring-emerald-400/25"
          : background.nonVerbal.total > 0
            ? "ring-rose-400/25"
            : "ring-amber-400/25",
      )}
    >
      <p className="flex items-center gap-2 text-sm font-bold text-white">
        <ShieldAlert className="size-4 text-slate-400" />
        Background check
      </p>
      <p className="mt-2 text-sm text-slate-300">{background.headline}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Last {background.windowDays} days · {background.verbal.total} verbal ·{" "}
        {background.nonVerbal.total} non-verbal
        {background.voided.length ? ` · ${background.voided.length} voided` : ""}
      </p>

      {background.active.length > 0 && (
        <div className="mt-4 rounded-xl bg-rose-500/[0.07] p-4 ring-1 ring-inset ring-rose-400/25">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-200">
            <TriangleAlert className="size-4" />
            In effect right now
          </p>
          <ul className="mt-2 space-y-1">
            {background.active.map((action) => (
              <li key={action.id} className="text-sm text-slate-300">
                {actionLabel(action.type)} — {bodyLabel(action.bodyId)}, until{" "}
                {formatDateTime(action.expiresAt)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="rounded-xl bg-black/20 p-4 ring-1 ring-inset ring-white/[0.06]">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400">
              {bucket.label}
            </p>
            {bucket.list.length === 0 ? (
              <p className="mt-1.5 text-sm text-slate-600">None</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {bucket.list.map((action) => (
                  <li key={action.id} className="text-sm text-slate-300">
                    <span className="font-semibold text-white">{actionLabel(action.type)}</span>{" "}
                    <span className="text-slate-500">· {formatDateTime(action.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function VoidModal({ action, onClose, onDone }) {
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

export function EditModal({ action, ctx, onClose, onDone }) {
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
