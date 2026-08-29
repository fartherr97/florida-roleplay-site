import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, Search, UserRound, X } from "lucide-react";
import DeptPageHeader from "../../components/dept/DeptPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import DaActionForm from "../../components/hub/DaActionForm";
import { BackgroundPanel, EditModal, VoidModal } from "../hub/HubDaHub";
import { useAuth } from "../../context/useAuth";
import { api } from "../../lib/api";
import { formatDateTime, plural } from "../../lib/format";
import { cn } from "../../lib/cn";
import {
  ACTION_TYPES,
  DEFAULT_WINDOW_DAYS,
  actionLabel,
  actionTone,
  backgroundFor,
  bodyLabel,
  canEditAction,
  canFileFor,
  isVerbal,
} from "../../lib/discipline";

const TYPE_OPTIONS = [
  { value: "all", label: "Every action" },
  { value: "verbal", label: "Verbal only" },
  { value: "nonverbal", label: "Non-verbal only" },
  ...ACTION_TYPES.map((t) => ({ value: t.id, label: t.label })),
];

const WINDOWS = [
  { value: "180", label: "Last 6 months" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last year" },
  { value: "all", label: "Everything" },
];

/**
 * The DA Database, inside a department hub.
 *
 * The same disciplinary record as the Staff Hub's DA Hub — one store, so a DA a
 * department files here still lands on the member's `/bgcheck` and in the staff
 * record — but scoped to this department, so command file and review their own
 * department's actions without leaving the dept hub. Everything is filed under this
 * department, and the record shown is this department's; reading the whole
 * cross-department record still lives in the Staff Hub behind `discipline.view`.
 */
export default function DeptDaHub({ config }) {
  const deptId = config.id;
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState(null);
  const [editing, setEditing] = useState(null);
  const [asOf] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [windowDaysStr, setWindowDaysStr] = useState(String(DEFAULT_WINDOW_DAYS));
  const [tab, setTab] = useState("all");
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(() => {
    let active = true;
    api
      .deptDiscipline(deptId)
      .then((result) => active && setData(result))
      .catch(
        () =>
          active &&
          setData({ actions: [], mine: [], canViewAll: false, totals: { mine: 0, all: 0 } }),
      );
    return () => {
      active = false;
    };
  }, [deptId]);

  useEffect(load, [load]);

  const ctx = useMemo(() => {
    const held = ["discipline.file", "discipline.view", "discipline.manage"].filter((key) =>
      hasPermission(key),
    );
    return { user, roleKeys: user?.roles ?? [], permissions: new Set(held) };
  }, [user, hasPermission]);

  // Only command of this department (or a site DA filer) may file here; the body is
  // always this department, so an empty list means "no filing".
  const canFile = canFileFor(deptId, ctx);
  const allActions = useMemo(() => data?.actions ?? [], [data]);
  const mine = useMemo(() => data?.mine ?? [], [data]);
  const totals = data?.totals ?? { mine: 0, all: 0 };

  const windowDays = windowDaysStr === "all" ? 3650 : Number(windowDaysStr);
  const source = tab === "all" ? allActions : mine;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const since = asOf - windowDays * 86_400_000;
    return source.filter((action) => {
      if (new Date(action.createdAt).getTime() < since) return false;
      if (type === "verbal" && !isVerbal(action.type)) return false;
      if (type === "nonverbal" && isVerbal(action.type)) return false;
      if (!["all", "verbal", "nonverbal"].includes(type) && action.type !== type) return false;
      if (!needle) return true;
      return [action.targetName, action.targetDiscordId, action.issuedByName, action.reason]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [source, query, type, windowDays, asOf]);

  const idQuery = /^\d{17,20}$/.test(query.trim()) ? query.trim() : null;
  const subjectId = selectedId ?? idQuery;

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

  const subjectName = subjectId ? nameForId(subjectId) || "Unknown member" : "";

  const people = useMemo(() => {
    if (subjectId || !query.trim()) return [];
    const map = new Map();
    for (const action of filtered) {
      const id = action.targetDiscordId;
      if (!id) continue;
      const at = new Date(action.createdAt).getTime();
      const seen = map.get(id);
      if (!seen) map.set(id, { id, name: action.targetName, total: 1, latest: at });
      else {
        seen.total += 1;
        if (at > seen.latest) {
          seen.latest = at;
          seen.name = action.targetName;
        }
      }
    }
    return [...map.values()].sort((a, b) => b.latest - a.latest);
  }, [filtered, query, subjectId]);

  const prefill = useMemo(
    () => (subjectId ? { targetDiscordId: subjectId, targetName: nameForId(subjectId) } : undefined),
    [subjectId, nameForId],
  );

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
      <DeptPageHeader
        icon="Gavel"
        eyebrow={config.branding.shortName}
        title="DA Database"
        subtitle="File and review this department's disciplinary actions. Every entry lands on the same record /bgcheck reads in Discord."
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

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="sm:col-span-2 lg:col-span-3">
          <div className="flex flex-wrap items-center gap-2">
            {WINDOWS.map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => setWindowDaysStr(entry.value)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition",
                  windowDaysStr === entry.value
                    ? "bg-primary-500/15 text-white ring-primary-400/40"
                    : "bg-black/20 text-slate-400 ring-white/[0.06] hover:text-white",
                )}
              >
                {entry.label}
              </button>
            ))}
            {!subjectId && (
              <div className="ml-auto flex gap-2">
                <TabButton active={tab === "all"} onClick={() => setTab("all")} label="All" count={totals.all} />
                <TabButton active={tab === "mine"} onClick={() => setTab("mine")} label="Mine" count={totals.mine} />
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
            <p className="truncate text-sm font-semibold text-white">{subjectName}</p>
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
                : tab === "all"
                  ? "Nothing on this department's record yet."
                  : "You have not filed any."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((action) => (
            <Card key={action.id} className={cn("p-5", action.voided && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge tone={actionTone(action.type)}>{actionLabel(action.type)}</Badge>
                <Badge tone="brand">{bodyLabel(action.bodyId)}</Badge>
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
        title={`Add disciplinary action · ${config.branding.shortName}`}
        subtitle="It lands on the same record /bgcheck reads in Discord."
        className="max-w-2xl"
      >
        <DaActionForm
          key={`${adding}:${prefill?.targetDiscordId ?? ""}`}
          ctx={ctx}
          prefill={prefill}
          lockBodyId={deptId}
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
      {label}
      <span className="ml-1.5 text-slate-500">{count}</span>
    </button>
  );
}
