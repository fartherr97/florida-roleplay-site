import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, ShieldAlert, TriangleAlert } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import DaActionForm from "../../components/hub/DaActionForm";
import { useAuth } from "../../context/useAuth";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { cn } from "../../lib/cn";
import {
  ACTION_BODIES,
  ACTION_TYPES,
  DEFAULT_WINDOW_DAYS,
  actionLabel,
  actionTone,
  backgroundFor,
  bodyLabel,
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
 * The read side of the record: search across every action, and the same
 * background summary `/bgcheck` renders in Discord.
 *
 * Searching a member's Discord ID switches the page into that summary, because
 * "what does this person's record look like" is the question this page is
 * actually opened for — a flat list of matching rows makes a reviewer do the
 * folding in their head, which is where a suspension gets missed.
 */
export default function HubDaDatabase() {
  const { user, hasPermission } = useAuth();
  const [actions, setActions] = useState(null);
  const [adding, setAdding] = useState(false);
  // Stamped once. A window boundary that slides while somebody is reading would
  // drop a row out from under them mid-scroll.
  const [asOf] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [body, setBody] = useState("all");
  const [window, setWindow] = useState(String(DEFAULT_WINDOW_DAYS));

  const load = useCallback(() => {
    let active = true;
    api
      .disciplinaryActions()
      .then((result) => active && setActions(result.actions ?? []))
      .catch(() => active && setActions([]));
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

  const windowDays = window === "all" ? 3650 : Number(window);

  const filtered = useMemo(() => {
    const list = actions ?? [];
    const needle = query.trim().toLowerCase();
    const since = asOf - windowDays * 86_400_000;
    return list.filter((action) => {
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
  }, [actions, query, type, body, windowDays, asOf]);

  // Searching an exact Discord ID is a background check, not a search.
  const idQuery = /^\d{17,20}$/.test(query.trim()) ? query.trim() : null;
  const background = useMemo(
    () => (idQuery ? backgroundFor(actions ?? [], { discordId: idQuery, windowDays, now: asOf }) : null),
    [idQuery, actions, windowDays, asOf],
  );

  // Filing against the record you are already reading should not mean copying
  // the ID back out of the search box. The name comes from the newest row on
  // that ID, so a member already on file does not get typed in a second way.
  const prefill = useMemo(() => {
    if (!idQuery) return undefined;
    const seen = (actions ?? [])
      .filter((action) => action.targetDiscordId === idQuery)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    return { targetDiscordId: idQuery, targetName: seen?.targetName ?? "" };
  }, [idQuery, actions]);

  return (
    <>
      <HubPageHeader
        icon="Search"
        eyebrow="Staff Hub"
        title="DA Database"
        subtitle="Every action on record, across the staff team and all five departments. Paste a Discord ID for the same summary /bgcheck gives in Discord."
        actions={
          <div className="flex items-center gap-3">
            <Badge tone="rose">Handle with discretion</Badge>
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
            placeholder="Name, reason, or paste a Discord ID"
            aria-label="Search the record"
            className="pl-11"
          />
        </div>
        <Select value={type} onChange={setType} options={TYPE_OPTIONS} />
        <Select value={body} onChange={setBody} options={BODY_OPTIONS} />
        <div className="sm:col-span-2 lg:col-span-4">
          <div className="flex flex-wrap gap-2">
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
          </div>
        </div>
      </div>

      {background && <BackgroundPanel background={background} />}

      {actions === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-20 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-slate-400">Nothing on record matches that.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((action) => (
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
              <p className="mt-2 text-xs text-slate-500">Filed by {action.issuedByName}</p>
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
          // Remounted per opening so a cancelled draft is not still sitting
          // there next time, and so a new search seeds a new prefill.
          key={`${adding}:${prefill?.targetDiscordId ?? ""}`}
          ctx={ctx}
          prefill={prefill}
          onFiled={() => {
            setAdding(false);
            load();
          }}
        />
      </Modal>
    </>
  );
}

/** The folded summary, laid out the way the Discord embed lays it out. */
function BackgroundPanel({ background }) {
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
