// ─────────────────────────────────────────────────────────────────────────────
// Transfer Portal — the tab panels
//
// A port of the Tab Views block of app/page.jsx from
// github.com/fartherr97/es-transfer-portal: DeptSelector, StatCard,
// TransferRow, OverviewTab, RequestTab, QueueTab, the webhook settings cards
// with their live Discord embed preview, and AnalyticsTab.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock,
  ListChecks,
  MessagesSquare,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  ANALYTICS_RANGES,
  BLANK,
  DEPTS,
  MIN_REASON,
  RANKS,
  STATUS_FILTERS,
  buildMonthOptions,
  ds,
} from "./portalConfig";
import {
  Avatar,
  Btn,
  DeptBadge,
  DeptLogo,
  Input,
  PreviewImg,
  StatusBadge,
  Textarea,
} from "./portalPrimitives";
import { api, fmtDate } from "./portalUtils";
import { useToast } from "./usePortalToast";

const DEPT_KEYS = Object.keys(DEPTS);

/**
 * The department selector's column count at `lg`, chosen by how many there are.
 *
 * Written as whole class names rather than composed at runtime: Tailwind scans
 * source text, so `lg:grid-cols-${n}` would compile to nothing and the grid
 * would silently fall back to three columns.
 */
const DEPT_GRID =
  {
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
  }[DEPT_KEYS.length] ?? "lg:grid-cols-4";

/* ─── Dept Selector ────────────────────────────────────────────────────────── */

export function DeptSelector({ label, value, onChange, exclude, locked }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-display text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      {/* Sized off the department count rather than fixed at four, so adding or
          retiring one does not leave a tile stranded on its own row — or, worse,
          leave the rest squeezed into a width their names do not fit. The class
          names are literals in DEPT_GRID below so Tailwind can see them. */}
      <div className={`grid w-full grid-cols-2 gap-2 sm:grid-cols-3 ${DEPT_GRID}`}>
        {Object.entries(DEPTS).map(([key, d]) => {
          const selected = value === key;
          const excluded = exclude === key;
          return (
            <button
              key={key}
              type="button"
              disabled={excluded || (locked && !selected)}
              aria-pressed={selected}
              onClick={onChange ? () => onChange(key) : undefined}
              className="group relative flex items-center gap-2.5 rounded-xl border px-3 py-3 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-25"
              style={
                selected
                  ? {
                      ...ds(d.color).selected,
                      boxShadow: `0 0 24px ${d.color}55, 0 4px 16px ${d.color}33`,
                    }
                  : { backgroundColor: "var(--color-bg)", borderColor: "var(--color-border)" }
              }
              onMouseEnter={(e) => {
                if (!selected && !excluded) {
                  e.currentTarget.style.borderColor = d.color + "66";
                  e.currentTarget.style.boxShadow = `0 0 16px ${d.color}33`;
                }
              }}
              onMouseLeave={(e) => {
                if (!selected) {
                  e.currentTarget.style.borderColor = "var(--color-border)";
                  e.currentTarget.style.boxShadow = "none";
                }
              }}
            >
              {selected && (
                <div
                  className="absolute inset-0 rounded-xl opacity-10 blur-xl"
                  style={{ backgroundColor: d.color }}
                />
              )}
              <DeptLogo dept={key} size={32} className="relative drop-shadow-lg" />
              <div className="relative min-w-0 text-left">
                <p
                  className="font-display text-sm font-bold leading-tight tracking-wide"
                  style={{ color: selected ? d.color : "white" }}
                >
                  {key}
                </p>
                <p className="mt-0.5 truncate text-[10px] leading-tight text-slate-500">
                  {d.short}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}



/* ─── Stat Card ────────────────────────────────────────────────────────────── */

function StatCard({ label, value, Icon: LucideIcon, topCls, iconCls, valueCls, className = "" }) {
  return (
    <div className={`card card-hover relative overflow-hidden p-5 pt-6 ${className}`}>
      <div className={`absolute inset-x-0 top-0 h-[3px] ${topCls}`} />
      <div className="flex items-center justify-between">
        <p className="font-display text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          {label}
        </p>
        <div className={`rounded-2xl p-2.5 ${iconCls}`}>
          <LucideIcon className="size-5" strokeWidth={2} />
        </div>
      </div>
      <p className={`mt-5 text-5xl font-bold tabular-nums ${valueCls}`}>{value}</p>
    </div>
  );
}

/* ─── Transfer Row ─────────────────────────────────────────────────────────── */

function TransferRow({ transfer, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(transfer.id)}
      className="card card-hover flex w-full items-center gap-3 px-4 py-3.5 text-left"
    >
      <Avatar name={transfer.member} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display font-bold leading-none text-white">{transfer.member}</p>
          <StatusBadge status={transfer.status} />
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">
          {transfer.discord} · {transfer.rank}
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        <DeptBadge dept={transfer.fromDept} />
        <ArrowRight className="size-3.5 text-slate-600" strokeWidth={1.5} />
        <DeptBadge dept={transfer.toDept} />
      </div>
      <p className="hidden w-16 shrink-0 text-right text-xs text-slate-600 lg:block">
        {fmtDate(transfer.createdAt)}
      </p>
      <span
        className="hidden shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white sm:inline-flex"
        style={{ backgroundColor: "var(--color-surface-2)" }}
      >
        Open <ArrowRight className="size-3.5" strokeWidth={2} />
      </span>
      <ArrowRight className="size-4 shrink-0 text-slate-600 sm:hidden" strokeWidth={1.75} />
    </button>
  );
}

/* ─── My Transfers View ────────────────────────────────────────────────────── */

export function MyTransfersView({ user, onSubmit, onOpenTicket }) {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api("/")
      // The list the API returns is already scoped to this session, and it is
      // scoped by user id. Upstream re-filters it here by display name, which
      // hides your own ticket the moment you rename yourself in Discord.
      .then((all) => active && setTransfers(all))
      .catch(() => active && setTransfers([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <p className="text-sm text-slate-600">Loading your transfers…</p>
      </div>
    );
  }

  return (
    <div className="w-full px-0 py-10">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-white sm:text-2xl">
            My Transfer Requests
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {transfers.length} request{transfers.length !== 1 ? "s" : ""} submitted
          </p>
        </div>
        <Btn variant="primary" size="sm" onClick={onSubmit} className="self-start sm:self-auto">
          <Plus className="size-3.5" strokeWidth={2} /> New Request
        </Btn>
      </div>

      {transfers.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border py-20 text-center"
          style={{ backgroundColor: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
        >
          <ListChecks className="mx-auto mb-4 size-10 text-slate-700" strokeWidth={1} />
          <p className="font-display font-semibold text-slate-400">No transfers yet</p>
          <p className="mt-1 text-sm text-slate-600">
            Submit your first transfer request to get started.
          </p>
          <div className="mt-6">
            <Btn variant="primary" size="sm" onClick={onSubmit}>
              <Plus className="size-3.5" strokeWidth={2} /> Submit Transfer Request
            </Btn>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {transfers.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpenTicket(t.id)}
              className="card card-hover flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-center"
            >
              <div className="flex flex-1 items-center gap-3">
                <Avatar name={t.member} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display font-bold text-white">{t.member}</p>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="text-xs text-slate-500">
                    {t.rank} · {fmtDate(t.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-12 sm:pl-0">
                <DeptBadge dept={t.fromDept} />
                <ArrowRight className="size-3.5 text-slate-600" strokeWidth={1.5} />
                <DeptBadge dept={t.toDept} />
                <ArrowRight className="ml-1 size-4 text-slate-600" strokeWidth={1.5} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Overview Tab ─────────────────────────────────────────────────────────── */

export function OverviewTab({ onNavigate, onOpenTicket, user }) {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api("/")
      .then((data) => active && setTransfers(data))
      .catch(() => active && setTransfers([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const counts = {
    total: transfers.length,
    pending: transfers.filter((t) => t.status === "pending").length,
    approved: transfers.filter((t) => t.status === "approved").length,
    rejected: transfers.filter((t) => t.status === "rejected").length,
    completed: transfers.filter((t) => t.status === "completed").length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Pending" value={counts.pending} Icon={Clock} topCls="bg-gradient-to-r from-amber-400 to-transparent" iconCls="bg-amber-950/70 text-amber-400" valueCls="text-amber-300" />
        <StatCard label="Approved" value={counts.approved} Icon={CheckCircle2} topCls="bg-gradient-to-r from-emerald-400 to-transparent" iconCls="bg-emerald-950/80 text-emerald-400" valueCls="text-emerald-300" />
        <StatCard label="Rejected" value={counts.rejected} Icon={XCircle} topCls="bg-gradient-to-r from-rose-500 to-transparent" iconCls="bg-rose-950/70 text-rose-400" valueCls="text-rose-400" />
        <StatCard label="Completed" value={counts.completed} Icon={Activity} topCls="bg-gradient-to-r from-blue-500 to-transparent" iconCls="bg-blue-950/70 text-blue-400" valueCls="text-blue-300" />
        <StatCard label="Total" value={counts.total} Icon={TrendingUp} topCls="bg-gradient-to-r from-teal-500 to-transparent" iconCls="bg-slate-800 text-slate-300" valueCls="text-white" className="col-span-2 lg:col-span-1" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="card overflow-hidden lg:order-1 lg:col-span-2">
          <div
            className="flex items-center justify-between border-b px-5 py-4"
            style={{ borderColor: "var(--color-border)" }}
          >
            <h3 className="font-display font-bold text-white">Recent transfers</h3>
            <Btn size="sm" variant="secondary" onClick={() => onNavigate("queue")}>
              View all
            </Btn>
          </div>
          {loading ? (
            <p className="py-12 text-center text-sm text-slate-600">Loading…</p>
          ) : transfers.length === 0 ? (
            <div className="space-y-4 py-14 text-center">
              <p className="text-sm text-slate-500">No transfers yet.</p>
              <Btn size="sm" variant="primary" onClick={() => onNavigate("request")}>
                <Plus className="size-3.5" strokeWidth={2} /> Stage first request
              </Btn>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {transfers.slice(0, 6).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenTicket(t.id)}
                  className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-white/[0.02]"
                >
                  <Avatar name={t.member} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-display truncate text-sm font-semibold text-white">
                      {t.member}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {t.rank} · {fmtDate(t.createdAt)}
                    </p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                    <DeptBadge dept={t.fromDept} />
                    <ArrowRight className="size-3 text-slate-600" strokeWidth={1.5} />
                    <DeptBadge dept={t.toDept} />
                  </div>
                  <StatusBadge status={t.status} />
                  <ArrowRight className="size-4 shrink-0 text-slate-600" strokeWidth={1.5} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-display mb-4 font-bold text-white">Departments</h3>
            <div className="space-y-3">
              {Object.entries(DEPTS)
                .filter(([key]) => !user?.isDeptHead || user?.isManagement || key === user?.dept)
                .map(([key, d]) => {
                  const out = transfers.filter((t) => t.fromDept === key).length;
                  const inn = transfers.filter((t) => t.toDept === key).length;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div
                        className="flex w-20 shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1"
                        style={ds(d.color).chip}
                      >
                        <DeptLogo dept={key} size={14} />
                        <span className="text-xs font-bold" style={{ color: d.color }}>
                          {key}
                        </span>
                      </div>
                      <p className="min-w-0 flex-1 truncate text-xs text-slate-400">
                        {d.short}
                      </p>
                      <div className="flex shrink-0 items-center gap-3 text-xs tabular-nums">
                        <span className="flex items-center gap-1" title="Incoming">
                          <ArrowDownLeft className="size-3 text-emerald-400/80" strokeWidth={2.25} />
                          <span className="font-bold text-white">{inn}</span>
                        </span>
                        <span className="flex items-center gap-1" title="Outgoing">
                          <ArrowUpRight className="size-3 text-rose-400/80" strokeWidth={2.25} />
                          <span className="font-bold text-white">{out}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-display mb-3 font-bold text-white">Quick actions</h3>
            <div className="space-y-2">
              <Btn
                variant="primary"
                size="md"
                className="w-full justify-center"
                onClick={() => onNavigate("request")}
              >
                <Plus className="size-4" strokeWidth={2} /> New transfer request
              </Btn>
              <Btn
                variant="secondary"
                size="md"
                className="w-full justify-center"
                onClick={() => onNavigate("queue")}
              >
                Review pending queue
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Request Tab ──────────────────────────────────────────────────────────── */

export function RequestTab({ onOpenTicket, isStaff, session }) {
  const [form, setForm] = useState(BLANK);
  const [locked, setLocked] = useState({});
  const [submitting, setSub] = useState(false);
  const [submitted, setDone] = useState(false);
  const [newId, setNewId] = useState(null);
  const [openTicket, setOpen] = useState(null); // existing active ticket for this user
  const [checkingOpen, setCheck] = useState(!isStaff);
  const toast = useToast();

  // For non-staff: check if they already have a pending/approved ticket.
  useEffect(() => {
    if (isStaff) return undefined;
    let active = true;
    api("/")
      .then((all) => {
        const openOne = all.find((t) => t.status === "pending" || t.status === "approved");
        if (active && openOne) setOpen(openOne);
      })
      .catch(() => {})
      .finally(() => active && setCheck(false));
    return () => {
      active = false;
    };
  }, [isStaff]);

  // Pre-fill and lock the fields that come from the Discord session.
  //
  // Adjusted during render rather than in an effect: an effect would paint one
  // frame of an empty form before filling it in, and the fields it fills are
  // read-only, so there is nothing for the user to have typed over.
  const sessionKey = session?.id ?? null;
  const [seededFor, setSeededFor] = useState(undefined);
  if (session && sessionKey !== seededFor) {
    setSeededFor(sessionKey);
    const patch = {};
    const lock = {};
    if (session.displayName) {
      patch.member = session.displayName;
      lock.member = true;
    }
    if (session.username) {
      patch.discord = session.username;
      lock.discord = true;
    }
    if (session.rank) {
      patch.rank = session.rank;
      lock.rank = true;
    }
    if (session.dept) {
      patch.fromDept = session.dept;
      lock.fromDept = true;
    }
    setForm((prev) => ({ ...prev, ...patch }));
    setLocked(lock);
  }

  function set(field, val) {
    setForm((prev) => ({ ...prev, [field]: val }));
  }
  function handle(field) {
    return (e) => set(field, e.target.type === "checkbox" ? e.target.checked : e.target.value);
  }

  const sameDept = form.fromDept && form.toDept && form.fromDept === form.toDept;
  const reasonTooShort = form.reason.trim().length > 0 && form.reason.trim().length < MIN_REASON;
  const canSubmit =
    form.member &&
    form.discord &&
    form.rank &&
    form.fromDept &&
    form.toDept &&
    !sameDept &&
    form.reason.trim().length >= MIN_REASON;
  const rankList = form.fromDept
    ? RANKS[form.fromDept]
    : Object.values(RANKS)
        .flat()
        .filter((v, i, a) => a.indexOf(v) === i);

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSub(true);
    try {
      const created = await api("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setNewId(created?.id ?? null);
      setDone(true);
      toast("Transfer request submitted successfully.", "success");
    } catch (err) {
      // 409 has a specific meaning and its own screen — telling somebody to
      // "try again" when the answer is "you already have one open" is how they
      // end up trying again.
      if (err?.status === 409) {
        toast("You already have an open transfer request.", "warning");
        api("/")
          .then((all) => {
            const openOne = all.find((t) => t.status === "pending" || t.status === "approved");
            if (openOne) setOpen(openOne);
          })
          .catch(() => {});
      } else {
        toast("Failed to submit. Please try again.", "error");
      }
    } finally {
      setSub(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center py-12 text-center sm:py-24">
        <div className="flex size-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
          <CheckCircle2 className="size-8 text-emerald-400" strokeWidth={1.5} />
        </div>
        <h2 className="font-display mt-6 text-2xl font-bold text-white">Request submitted</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Your transfer request is now an open ticket. Continue to the ticket to track its status
          and message your department heads.
        </p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Btn
            variant="primary"
            size="lg"
            onClick={() => onOpenTicket(newId)}
            disabled={!newId}
            className="justify-center"
          >
            <MessagesSquare className="size-4" strokeWidth={1.75} /> Continue to your transfer
            ticket
          </Btn>
          {isStaff && (
            <Btn
              variant="secondary"
              size="lg"
              onClick={() => {
                setForm(BLANK);
                setNewId(null);
                setDone(false);
              }}
              className="justify-center"
            >
              Submit another
            </Btn>
          )}
        </div>
      </div>
    );
  }

  if (!isStaff && checkingOpen) {
    return <div className="py-24 text-center text-sm text-slate-600">Loading…</div>;
  }

  if (!isStaff && openTicket) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center py-12 text-center sm:py-24">
        <div className="flex size-16 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
          <AlertCircle className="size-8 text-amber-400" strokeWidth={1.5} />
        </div>
        <h2 className="font-display mt-6 text-2xl font-bold text-white">Transfer already open</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          You already have an active transfer request. Only one transfer can be open at a time. View
          your existing ticket to check its status or chat with your department heads.
        </p>
        <Btn
          variant="primary"
          size="lg"
          className="mt-8 justify-center"
          onClick={() => onOpenTicket(openTicket.id)}
        >
          <MessagesSquare className="size-4" strokeWidth={1.75} /> View your open ticket
        </Btn>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <h2 className="font-display text-xl font-bold text-white">Transfer request</h2>
        <p className="mt-1 text-sm text-slate-400">
          Fill out the form below. Your outgoing department head will review and act on it.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="card space-y-4 p-5">
          <p className="font-display text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Your information
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full RP name" placeholder="First Last" value={form.member} onChange={handle("member")} required readOnly={locked.member} />
            <Input label="Discord username" placeholder="username" value={form.discord} onChange={handle("discord")} required readOnly={locked.discord} />
          </div>
          <div>
            <Input label="Current rank" placeholder="Type or select" list="rank-list" value={form.rank} onChange={handle("rank")} required readOnly={locked.rank} />
            <datalist id="rank-list">
              {rankList.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="card space-y-5 p-5">
          <p className="font-display text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Transfer route
          </p>
          <DeptSelector
            label="Leaving department"
            value={form.fromDept}
            onChange={locked.fromDept ? undefined : (v) => set("fromDept", v)}
            exclude={form.toDept}
            locked={locked.fromDept}
          />
          <div
            className="flex flex-wrap items-center justify-center gap-3 rounded-xl border px-4 py-3"
            style={{ backgroundColor: "var(--color-bg)", borderColor: "var(--color-border)" }}
          >
            {form.fromDept ? (
              <DeptBadge dept={form.fromDept} fullName />
            ) : (
              <span className="text-sm text-slate-600">Leaving dept</span>
            )}
            <ArrowRight className="size-4 shrink-0 text-slate-600" strokeWidth={1.5} />
            {form.toDept ? (
              <DeptBadge dept={form.toDept} fullName />
            ) : (
              <span className="text-sm text-slate-600">Destination dept</span>
            )}
          </div>
          {sameDept && (
            <p className="text-xs text-rose-400">
              Leaving and destination cannot be the same department.
            </p>
          )}
          <DeptSelector
            label="Destination department"
            value={form.toDept}
            onChange={(v) => set("toDept", v)}
            exclude={form.fromDept}
          />
        </div>

        <div className="card p-5">
          <Textarea
            label="Reason for transfer"
            placeholder={`Explain your reason. Be specific · department heads use this for review. (minimum ${MIN_REASON} characters)`}
            value={form.reason}
            onChange={handle("reason")}
          />
          <div className="mt-2 flex items-center justify-between px-1">
            <p className={`text-xs ${reasonTooShort ? "text-rose-400" : "text-slate-600"}`}>
              {reasonTooShort ? `${MIN_REASON - form.reason.trim().length} more characters required` : ""}
            </p>
            <p
              className={`text-xs tabular-nums ${form.reason.trim().length >= MIN_REASON ? "text-emerald-400" : "text-slate-600"}`}
            >
              {form.reason.trim().length} / {MIN_REASON}
            </p>
          </div>
        </div>

        <Btn
          type="submit"
          size="lg"
          variant="primary"
          disabled={submitting || !canSubmit}
          className="w-full justify-center"
        >
          {submitting ? "Submitting…" : "Submit transfer request"}
        </Btn>
      </form>
    </div>
  );
}

/* ─── Queue Tab ────────────────────────────────────────────────────────────── */

export function QueueTab({ onOpenTicket, user }) {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusF, setStatusF] = useState("all");
  const [deptF, setDeptF] = useState(() =>
    user?.isDeptHead && !user?.isManagement ? (user.dept ?? "all") : "all",
  );
  const toast = useToast();

  // `loading` starts true and is only ever cleared from the promise, so the
  // mount effect never sets state on its synchronous path. The Refresh button
  // raises it again — that is an event, which is where a spinner belongs.
  const load = useCallback(() => {
    let active = true;
    api("/")
      .then((data) => active && setTransfers(data))
      .catch(() => active && toast("Failed to load transfers.", "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [toast]);

  useEffect(load, [load]);

  function refresh() {
    setLoading(true);
    load();
  }

  const visible = transfers.filter(
    (t) =>
      (statusF === "all" || t.status === statusF) &&
      (deptF === "all" || t.fromDept === deptF || t.toDept === deptF),
  );
  const countFor = (s) => transfers.filter((t) => t.status === s).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="card flex gap-1 overflow-x-auto p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusF(f)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${statusF === f ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
              style={statusF === f ? { backgroundColor: "var(--color-surface-2)" } : {}}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== "all" && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${statusF === f ? "bg-white/10 text-slate-200" : "text-slate-700"}`}
                >
                  {countFor(f)}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!(user?.isDeptHead && !user?.isManagement) && (
            <select
              value={deptF}
              onChange={(e) => setDeptF(e.target.value)}
              aria-label="Filter by department"
              className="flex-1 rounded-xl border px-3 py-2 text-xs font-semibold text-slate-300 outline-none transition focus:border-[#f2800d] sm:flex-none"
              style={{ backgroundColor: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
            >
              <option value="all">All depts</option>
              {DEPT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          )}
          <Btn size="sm" variant="secondary" onClick={refresh}>
            <RefreshCw className="size-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Refresh</span>
          </Btn>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-sm text-slate-600">Loading transfers…</div>
      ) : visible.length === 0 ? (
        <div className="card py-20 text-center">
          <p className="text-sm text-slate-500">No transfers match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((t) => (
            <TransferRow key={t.id} transfer={t} onOpen={onOpenTicket} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Webhook settings ─────────────────────────────────────────────────────── */

const WEBHOOK_SAMPLE_VARS = {
  member: "JohnDoe",
  discord: "johndoe",
  rank: "Sergeant",
  fromDept: "BSO",
  toDept: "MPD",
  ticketId: "TR-001",
};

const TEMPLATE_VARS = ["{member}", "{discord}", "{rank}", "{fromDept}", "{toDept}", "{ticketId}"];

const DEFAULT_WEBHOOK_CFG = {
  url: "",
  username: "",
  avatarUrl: "",
  color: "#5865F2",
  thumbnailUrl: "",
  embedTitle: "New Transfer Request · {toDept}",
  embedDescription:
    "**{member}** ({discord}) has submitted a transfer request.\n\n**Outgoing:** {fromDept}\n**Incoming:** {toDept}\n**Rank:** {rank}\n\nTicket: {ticketId}",
  footer: "Florida Roleplay Transfer Portal",
  footerIconUrl: "",
};

function previewInterpolate(template, vars) {
  return (template ?? "").replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

function renderDiscordBold(text) {
  return text
    .split("**")
    .map((part, i) =>
      i % 2 === 0 ? (
        part
      ) : (
        <strong key={`${i}-${part.slice(0, 8)}`} className="font-semibold text-white">
          {part}
        </strong>
      ),
    );
}

function EmbedPreview({ cfg }) {
  const color = cfg.color || "#5865F2";
  const title = previewInterpolate(cfg.embedTitle, WEBHOOK_SAMPLE_VARS);
  const desc = previewInterpolate(cfg.embedDescription, WEBHOOK_SAMPLE_VARS);
  const initial = (cfg.username || "B")[0].toUpperCase();

  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: "#313338" }}>
      {/* Bot header */}
      <div className="mb-2 flex items-center gap-2">
        <PreviewImg
          src={cfg.avatarUrl}
          className="size-8 rounded-full object-cover"
          width={32}
          height={32}
          fallback={
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-600">
              <span className="text-xs font-bold text-white">{initial}</span>
            </div>
          }
        />
        <span className="text-sm font-semibold text-white">{cfg.username || "Transfer Bot"}</span>
        <span
          className="rounded px-1 py-0.5 text-[10px] font-bold"
          style={{ backgroundColor: "#5865F2", color: "#fff" }}
        >
          APP
        </span>
      </div>

      {/* Embed card */}
      <div
        className="ml-10 overflow-hidden rounded-r-md"
        style={{ backgroundColor: "#2b2d31", borderLeft: `4px solid ${color}` }}
      >
        <div className="flex gap-3 p-3">
          <div className="min-w-0 flex-1">
            {title && <p className="mb-1 text-sm font-semibold text-white">{title}</p>}
            {desc && (
              <p className="whitespace-pre-wrap break-words text-xs leading-5 text-slate-300">
                {renderDiscordBold(desc)}
              </p>
            )}
            {!title && !desc && (
              <p className="text-xs text-slate-500">Fill in the fields to preview the embed.</p>
            )}
            {cfg.footer && (
              <div
                className="mt-3 flex items-center gap-1.5 border-t pt-2"
                style={{ borderColor: "#3f4147" }}
              >
                <PreviewImg
                  src={cfg.footerIconUrl}
                  className="size-3.5 rounded-full object-cover"
                  width={14}
                  height={14}
                />
                <p className="text-[11px] text-slate-400">{cfg.footer}</p>
              </div>
            )}
          </div>
          <PreviewImg
            src={cfg.thumbnailUrl}
            className="size-16 shrink-0 rounded-md object-cover"
            width={64}
            height={64}
          />
        </div>
      </div>
    </div>
  );
}

function WebhookDeptCard({ deptKey, config, onChange, onTest, testing }) {
  const [open, setOpen] = useState(false);
  const cfg = { ...DEFAULT_WEBHOOK_CFG, ...config };

  function field(key, value) {
    onChange({ ...cfg, [key]: value });
  }

  const inputCls =
    "w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500";
  const inputStyle = { borderColor: "var(--color-border)" };
  const labelCls = "mb-1.5 block text-xs font-semibold text-slate-400";

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/5"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <DeptLogo dept={deptKey} size={28} />
          <div>
            <p className="font-display font-bold text-white">{deptKey}</p>
            <p className="text-xs text-slate-500">
              {cfg.hasUrl || cfg.url ? "Webhook configured" : "No webhook URL set"}
            </p>
          </div>
        </div>
        <ChevronDown className={`size-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t px-5 pb-6 pt-5" style={{ borderColor: "var(--color-border)" }}>
          {/* Variable hint */}
          <div
            className="mb-5 rounded-lg border px-3 py-2.5"
            style={{ backgroundColor: "rgba(88,101,242,0.08)", borderColor: "rgba(88,101,242,0.3)" }}
          >
            <p className="text-[11px] font-medium text-indigo-300">
              Variables:{" "}
              {TEMPLATE_VARS.map((v) => (
                <code key={v} className="mx-0.5 rounded bg-indigo-950/60 px-1 py-0.5 text-indigo-200">
                  {v}
                </code>
              ))}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Form */}
            <div className="space-y-4">
              <label className="block">
                <span className={labelCls}>Webhook URL</span>
                <input
                  type="url"
                  value={cfg.url}
                  onChange={(e) => field("url", e.target.value)}
                  placeholder={
                    cfg.hasUrl
                      ? "Set — type a new URL to replace it"
                      : "https://discord.com/api/webhooks/..."
                  }
                  className={inputCls}
                  style={inputStyle}
                />
                {/* A webhook URL is a credential: anyone holding it can post to
                    that channel as the bot. The server never sends it back, so
                    leaving this blank keeps whatever is stored. */}
                <span className="mt-1 block text-[11px] text-slate-600">
                  {cfg.hasUrl
                    ? "A URL is saved. It is never shown again — leave this blank to keep it."
                    : "Discord webhook URLs only."}
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelCls}>Bot Name</span>
                  <input type="text" value={cfg.username} onChange={(e) => field("username", e.target.value)} placeholder="Transfer Bot" className={inputCls} style={inputStyle} />
                </label>
                <label className="block">
                  <span className={labelCls}>Avatar URL</span>
                  <input type="url" value={cfg.avatarUrl} onChange={(e) => field("avatarUrl", e.target.value)} placeholder="https://..." className={inputCls} style={inputStyle} />
                </label>
              </div>

              <label className="block">
                <span className={labelCls}>Embed Color</span>
                <div className="flex gap-2">
                  <input type="color" value={cfg.color || "#5865F2"} onChange={(e) => field("color", e.target.value)} aria-label="Embed colour" className="size-9 shrink-0 cursor-pointer rounded-lg border p-0.5" style={inputStyle} />
                  <input
                    type="text"
                    value={cfg.color || "#5865F2"}
                    onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && field("color", e.target.value)}
                    maxLength={7}
                    aria-label="Embed colour hex"
                    className={`${inputCls} font-mono`}
                    style={inputStyle}
                  />
                </div>
              </label>

              <label className="block">
                <span className={labelCls}>Embed Title</span>
                <input type="text" value={cfg.embedTitle} onChange={(e) => field("embedTitle", e.target.value)} placeholder="New Transfer Request · {toDept}" className={inputCls} style={inputStyle} />
              </label>

              <label className="block">
                <span className={labelCls}>Embed Description</span>
                <textarea value={cfg.embedDescription} onChange={(e) => field("embedDescription", e.target.value)} rows={5} placeholder="Transfer details..." className={`${inputCls} resize-y`} style={inputStyle} />
              </label>

              <label className="block">
                <span className={labelCls}>Thumbnail URL</span>
                <input type="url" value={cfg.thumbnailUrl} onChange={(e) => field("thumbnailUrl", e.target.value)} placeholder="https://..." className={inputCls} style={inputStyle} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelCls}>Footer Text</span>
                  <input type="text" value={cfg.footer} onChange={(e) => field("footer", e.target.value)} placeholder="Florida Roleplay Transfer Portal" className={inputCls} style={inputStyle} />
                </label>
                <label className="block">
                  <span className={labelCls}>Footer Icon URL</span>
                  <input type="url" value={cfg.footerIconUrl} onChange={(e) => field("footerIconUrl", e.target.value)} placeholder="https://..." className={inputCls} style={inputStyle} />
                </label>
              </div>

              <Btn variant="ghost" size="sm" disabled={!(cfg.url || cfg.hasUrl) || testing} onClick={() => onTest(deptKey)}>
                {testing ? "Sending…" : "Send Test"}
              </Btn>
            </div>

            {/* Live preview */}
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-400">
                Live Preview <span className="font-normal text-slate-600">(sample values)</span>
              </p>
              <EmbedPreview cfg={cfg} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsTab() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localWebhooks, setLocalWebhooks] = useState({});
  const [testingWebhook, setTestingWebhook] = useState(null);
  const toast = useToast();

  useEffect(() => {
    let active = true;
    api("/settings")
      .then((s) => {
        if (!active) return;
        setSettings(s);
        setLocalWebhooks(s.webhooks ?? {});
      })
      .catch(() => active && toast("Failed to load settings.", "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [toast]);

  async function save() {
    setSaving(true);
    try {
      const updated = await api("/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhooks: localWebhooks }),
      });
      setSettings(updated);
      setLocalWebhooks(updated.webhooks ?? {});
      toast("Settings saved.", "success");
    } catch {
      toast("Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function testWebhook(dept) {
    setTestingWebhook(dept);
    try {
      await api("/settings/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dept }),
      });
      toast(`Test webhook sent to ${dept}.`, "success");
    } catch {
      toast(`Failed to send test webhook to ${dept}.`, "error");
    } finally {
      setTestingWebhook(null);
    }
  }

  const isDirty =
    settings && JSON.stringify(localWebhooks) !== JSON.stringify(settings.webhooks ?? {});

  if (loading) return <p className="py-20 text-center text-sm text-slate-600">Loading settings...</p>;

  return (
    <div className="space-y-10">
      <div className="w-full space-y-6">
        <div>
          <h2 className="font-display text-xl font-bold text-white">Portal Settings</h2>
          <p className="mt-1 text-sm text-slate-400">
            Configure per-department Discord webhooks. When a ticket is opened, both departments
            receive a notification.
          </p>
        </div>
        {DEPT_KEYS.map((deptKey) => (
          <WebhookDeptCard
            key={deptKey}
            deptKey={deptKey}
            config={localWebhooks[deptKey] ?? {}}
            onChange={(cfg) => setLocalWebhooks((prev) => ({ ...prev, [deptKey]: cfg }))}
            onTest={testWebhook}
            testing={testingWebhook === deptKey}
          />
        ))}
      </div>

      <div className="flex justify-end pb-4">
        <Btn variant="primary" size="md" disabled={!isDirty || saving} onClick={save}>
          {saving ? "Saving…" : "Save Settings"}
        </Btn>
      </div>
    </div>
  );
}

/* ─── Analytics Tab (Management only) ──────────────────────────────────────── */
// Computes stats from the full transfer list client-side (no separate analytics
// API). Supports rolling windows (7/14/30 days) and a monthly calendar view.
// Scoped by department or across all departments.

function pct(n, d) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

/** Small delta pill comparing a value to the previous equal-length window. */
function Delta({ now, prev }) {
  if (prev === 0 && now === 0) return <span className="text-xs text-slate-600">·</span>;
  const diff = now - prev;
  const up = diff > 0;
  const flat = diff === 0;
  const change = prev === 0 ? 100 : Math.round((diff / prev) * 100);
  const Icon = flat ? Activity : up ? TrendingUp : TrendingDown;
  const cls = flat ? "text-slate-500" : up ? "text-emerald-400" : "text-rose-400";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${cls}`}>
      <Icon className="size-3.5" strokeWidth={2} />
      {flat ? "no change" : `${up ? "+" : ""}${change}%`}
    </span>
  );
}

function AnalyticsStat({ label, value, sub, Icon: LucideIcon, iconCls, topCls }) {
  return (
    <div className="card card-hover relative overflow-hidden p-5">
      {topCls && <div className={`absolute inset-x-0 top-0 h-[3px] ${topCls}`} />}
      <div className="flex items-center justify-between">
        <p className="font-display text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          {label}
        </p>
        <div className={`rounded-xl p-2 ${iconCls}`}>
          <LucideIcon className="size-4" strokeWidth={1.5} />
        </div>
      </div>
      <p className="mt-4 text-4xl font-bold tabular-nums text-white">{value}</p>
      {sub && <div className="mt-1.5">{sub}</div>}
    </div>
  );
}

/** Horizontal labeled progress bar. */
function MeterRow({ label, value, total, color }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="tabular-nums text-slate-500">
          <span className="font-bold text-white">{value}</span> · {pct(value, total)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--color-bg)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct(value, total)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/** Per-department card used in the monthly report. */
function DeptMonthCard({ deptKey, data }) {
  const d = DEPTS[deptKey];
  const mine = data.filter((t) => t.fromDept === deptKey || t.toDept === deptKey);
  const inn = mine.filter((t) => t.toDept === deptKey).length;
  const out = mine.filter((t) => t.fromDept === deptKey).length;
  const net = inn - out;
  const cnt = (s) => mine.filter((t) => t.status === s).length;
  const total = mine.length;
  const approved = cnt("approved") + cnt("completed");
  const rejected = cnt("rejected");
  const pending = cnt("pending");
  const rate = pct(approved, approved + rejected);

  const pairs = {};
  mine.forEach((t) => {
    const other = t.fromDept === deptKey ? t.toDept : t.fromDept;
    pairs[other] = (pairs[other] || 0) + 1;
  });
  const topPair = Object.entries(pairs).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center gap-3 border-b px-5 py-4"
        style={{ borderColor: "var(--color-border)", backgroundColor: d.color + "0d" }}
      >
        <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1" style={ds(d.color).chip}>
          <DeptLogo dept={deptKey} size={16} />
          <span className="text-sm font-bold" style={{ color: d.color }}>
            {deptKey}
          </span>
        </div>
        <p className="min-w-0 flex-1 truncate text-xs text-slate-400">{d.name}</p>
        <span className="shrink-0 text-xs font-bold tabular-nums text-white">{total} transfers</span>
      </div>

      <div className="grid grid-cols-2">
        <div className="border-b border-r px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
          <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-slate-500">Incoming</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">{inn}</p>
        </div>
        <div className="border-b px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
          <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-slate-500">Outgoing</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">{out}</p>
        </div>
        <div className="border-r px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
          <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-slate-500">Net change</p>
          <p
            className={`mt-1 text-2xl font-bold tabular-nums ${net > 0 ? "text-emerald-400" : net < 0 ? "text-rose-400" : "text-slate-500"}`}
          >
            {net > 0 ? `+${net}` : net}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="font-display text-[10px] font-semibold uppercase tracking-widest text-slate-500">Approval rate</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">{rate}%</p>
        </div>
      </div>

      <div className="space-y-2.5 border-t px-5 py-4" style={{ borderColor: "var(--color-border)" }}>
        <MeterRow label="Pending" value={pending} total={total} color="#f59e0b" />
        <MeterRow label="Approved / Completed" value={approved} total={total} color="#34d399" />
        <MeterRow label="Rejected" value={rejected} total={total} color="#fb7185" />
      </div>

      {topPair && (
        <div className="flex items-center gap-2 border-t px-5 py-3" style={{ borderColor: "var(--color-border)" }}>
          <span className="text-xs text-slate-500">Most active route:</span>
          <DeptBadge dept={deptKey} />
          <ArrowRight className="size-3 shrink-0 text-slate-600" strokeWidth={1.5} />
          <DeptBadge dept={topPair[0]} />
          <span className="ml-auto shrink-0 text-xs font-bold tabular-nums text-white">{topPair[1]}</span>
        </div>
      )}
    </div>
  );
}

export function AnalyticsTab() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangeKey, setRangeKey] = useState("30");
  const [scope, setScope] = useState("all");
  const [monthIdx, setMonthIdx] = useState(0);
  // Stamped once, so a window boundary does not slide while somebody reads and
  // the month list does not depend on when the bundle first evaluated.
  const [now] = useState(() => Date.now());
  const monthOptions = useMemo(() => buildMonthOptions(now), [now]);

  useEffect(() => {
    let active = true;
    api("/")
      .then((data) => active && setTransfers(data))
      .catch(() => active && setTransfers([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const isMonthly = rangeKey === "monthly";
  const days = isMonthly ? 0 : Number(rangeKey);

  const selMonth = monthOptions[monthIdx];
  const mStart = isMonthly ? new Date(selMonth.year, selMonth.month, 1).getTime() : 0;
  const mEnd = isMonthly
    ? new Date(selMonth.year, selMonth.month + 1, 0, 23, 59, 59, 999).getTime()
    : 0;

  const day = 86400000;
  const cutoff = now - days * day;
  const prevCutoff = cutoff - days * day;

  const ts = (t) => new Date(t.createdAt).getTime();

  const inRange = isMonthly
    ? transfers.filter((t) => ts(t) >= mStart && ts(t) <= mEnd)
    : transfers.filter((t) => ts(t) >= cutoff);
  const prev = isMonthly ? [] : transfers.filter((t) => ts(t) >= prevCutoff && ts(t) < cutoff);

  const isDept = scope !== "all";
  const involves = (t) => !isDept || t.fromDept === scope || t.toDept === scope;
  const data = inRange.filter(involves);
  const prevData = prev.filter(involves);

  const count = (list, status) => list.filter((t) => t.status === status).length;
  const total = data.length;
  const pending = count(data, "pending");
  const approved = count(data, "approved");
  const completed = count(data, "completed");
  const rejected = count(data, "rejected");
  const decided = approved + completed + rejected;
  const approvalRate = pct(approved + completed, decided);
  const perDay = days > 0 ? (total / days).toFixed(1) : "·";
  const incoming = isDept ? data.filter((t) => t.toDept === scope).length : 0;
  const outgoing = isDept ? data.filter((t) => t.fromDept === scope).length : 0;

  const flowRows = isDept
    ? Object.entries(DEPTS)
        .filter(([key]) => key !== scope)
        .map(([key, d]) => {
          const inn = data.filter((t) => t.fromDept === key && t.toDept === scope).length;
          const out = data.filter((t) => t.fromDept === scope && t.toDept === key).length;
          return { key, d, inn, out, net: inn - out };
        })
    : Object.entries(DEPTS).map(([key, d]) => {
        const out = data.filter((t) => t.fromDept === key).length;
        const inn = data.filter((t) => t.toDept === key).length;
        return { key, d, inn, out, net: inn - out };
      });

  const routeMap = {};
  data.forEach((t) => {
    const k = `${t.fromDept}→${t.toDept}`;
    routeMap[k] = (routeMap[k] || 0) + 1;
  });
  const topRoutes = Object.entries(routeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const daysInMonth = isMonthly ? new Date(selMonth.year, selMonth.month + 1, 0).getDate() : days;
  const chartSource = isMonthly ? inRange : data;
  const series = Array.from({ length: daysInMonth }, (_, i) => {
    const start = isMonthly
      ? new Date(selMonth.year, selMonth.month, i + 1).getTime()
      : now - (days - i) * day;
    const end = isMonthly
      ? new Date(selMonth.year, selMonth.month, i + 2).getTime() - 1
      : start + day;
    return { count: chartSource.filter((t) => ts(t) >= start && ts(t) <= end).length };
  });
  const peak = Math.max(1, ...series.map((s) => s.count));

  const SCOPES = [{ key: "all", label: "Total" }, ...DEPT_KEYS.map((k) => ({ key: k, label: k }))];

  if (loading) return <p className="py-20 text-center text-sm text-slate-600">Loading analytics…</p>;

  return (
    <div className="space-y-6">
      {/* Header + range selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-white">Transfer Analytics</h2>
        <div
          className="flex rounded-xl border p-1"
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg)" }}
        >
          {ANALYTICS_RANGES.map((r) => {
            const active = rangeKey === r.key;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setRangeKey(r.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${active ? "text-white" : "text-slate-400 hover:text-slate-200"}`}
                style={active ? { backgroundColor: "var(--color-primary)" } : {}}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {isMonthly ? (
        <>
          {/* Month picker */}
          <div className="flex items-center gap-3">
            <label
              htmlFor="portal-month"
              className="font-display text-[11px] font-semibold uppercase tracking-widest text-slate-500"
            >
              Month
            </label>
            <select
              id="portal-month"
              value={monthIdx}
              onChange={(e) => setMonthIdx(Number(e.target.value))}
              className="rounded-xl border px-3 py-2 text-sm font-semibold text-white outline-none transition-colors focus:border-[#f2800d]"
              style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg)" }}
            >
              {monthOptions.map((m, i) => (
                <option key={m.label} value={i}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <AnalyticsStat label="Total requests" value={inRange.length} sub={<span className="text-xs text-slate-500">across all depts</span>} Icon={Users} iconCls="bg-slate-800 text-slate-400" />
            <AnalyticsStat label="Completed" value={count(inRange, "completed")} sub={<span className="text-xs text-slate-500">fully processed</span>} Icon={CheckCircle2} iconCls="bg-emerald-500/10 text-emerald-400" />
            <AnalyticsStat label="Pending" value={count(inRange, "pending")} sub={<span className="text-xs text-slate-500">still open</span>} Icon={Clock} iconCls="bg-amber-500/10 text-amber-400" />
            <AnalyticsStat label="Rejected" value={count(inRange, "rejected")} sub={<span className="text-xs text-slate-500">declined</span>} Icon={X} iconCls="bg-rose-500/10 text-rose-400" />
          </div>

          <div className="card p-5">
            <div className="mb-5 flex items-center gap-2">
              <BarChart3 className="size-4 text-slate-400" strokeWidth={1.75} />
              <h3 className="font-display font-bold text-white">Daily volume · {selMonth.label}</h3>
            </div>
            {inRange.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-600">No transfers this month.</p>
            ) : (
              <div className="flex h-40 gap-0.5">
                {series.map((s, i) => (
                  <div key={`d${i}`} className="group relative flex flex-1 flex-col justify-end">
                    <div
                      className="relative w-full rounded-t transition-all duration-300 hover:opacity-80"
                      style={{
                        height: `${(s.count / peak) * 100}%`,
                        minHeight: s.count > 0 ? 4 : 0,
                        backgroundColor: "var(--color-primary)",
                      }}
                    >
                      <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                        {s.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 flex justify-between text-[10px] text-slate-600">
              <span>Day 1</span>
              <span>Day {daysInMonth}</span>
            </div>
          </div>

          <div>
            <h3 className="font-display mb-4 font-bold text-white">Department breakdown</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {DEPT_KEYS.map((key) => (
                <DeptMonthCard key={key} deptKey={key} data={inRange} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Scope tabs */}
          <div className="flex flex-wrap gap-2">
            {SCOPES.map((s) => {
              const active = scope === s.key;
              const d = DEPTS[s.key];
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setScope(s.key)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${active ? "" : "text-slate-400 hover:text-slate-100"}`}
                  style={
                    active
                      ? d
                        ? ds(d.color).selected
                        : {
                            color: "var(--color-primary)",
                            backgroundColor: "rgba(242,128,13,0.12)",
                            borderColor: "rgba(242,128,13,0.5)",
                          }
                      : { borderColor: "var(--color-border)", backgroundColor: "var(--color-bg)" }
                  }
                >
                  {d && <DeptLogo dept={s.key} size={14} />}
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <AnalyticsStat label="Requests" value={total} sub={<Delta now={total} prev={prevData.length} />} Icon={Users} iconCls="bg-slate-800 text-slate-400" topCls="bg-gradient-to-r from-slate-400 to-transparent" />
            <AnalyticsStat label="Approval rate" value={`${approvalRate}%`} Icon={CheckCircle2} iconCls="bg-emerald-500/10 text-emerald-400" topCls="bg-gradient-to-r from-emerald-400 to-transparent" />
            {isDept ? (
              <>
                <AnalyticsStat label="Incoming" value={incoming} Icon={TrendingUp} iconCls="bg-emerald-500/10 text-emerald-400" topCls="bg-gradient-to-r from-emerald-400 to-transparent" />
                <AnalyticsStat label="Outgoing" value={outgoing} Icon={TrendingDown} iconCls="bg-rose-500/10 text-rose-400" topCls="bg-gradient-to-r from-rose-500 to-transparent" />
              </>
            ) : (
              <>
                <AnalyticsStat label="Avg / day" value={perDay} Icon={Activity} iconCls="bg-sky-500/10 text-sky-400" topCls="bg-gradient-to-r from-sky-500 to-transparent" />
                <AnalyticsStat label="Open pending" value={pending} Icon={Clock} iconCls="bg-amber-500/10 text-amber-400" topCls="bg-gradient-to-r from-amber-400 to-transparent" />
              </>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <div className="mb-5 flex items-center gap-2">
                <BarChart3 className="size-4 text-slate-400" strokeWidth={1.75} />
                <h3 className="font-display font-bold text-white">Daily volume</h3>
              </div>
              {total === 0 ? (
                <p className="py-12 text-center text-sm text-slate-600">No transfers in this period.</p>
              ) : (
                <div className="flex h-40 gap-1">
                  {series.map((s, i) => (
                    <div key={`r${i}`} className="group relative flex flex-1 flex-col justify-end">
                      <div
                        className="relative w-full rounded-t transition-all duration-500 hover:opacity-80"
                        style={{
                          height: `${(s.count / peak) * 100}%`,
                          minHeight: s.count > 0 ? 4 : 0,
                          backgroundColor: isDept ? DEPTS[scope].color : "var(--color-primary)",
                        }}
                      >
                        <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                          {s.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex justify-between text-[10px] text-slate-600">
                <span>{days} days ago</span>
                <span>Today</span>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-display mb-5 font-bold text-white">Status breakdown</h3>
              <div className="space-y-4">
                <MeterRow label="Pending" value={pending} total={total} color="#f59e0b" />
                <MeterRow label="Approved" value={approved} total={total} color="#38bdf8" />
                <MeterRow label="Completed" value={completed} total={total} color="#34d399" />
                <MeterRow label="Rejected" value={rejected} total={total} color="#fb7185" />
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <h3 className="font-display mb-5 font-bold text-white">Transfer Flow by Department</h3>
              {flowRows.every((r) => r.inn === 0 && r.out === 0) ? (
                <p className="py-8 text-center text-sm text-slate-600">No transfers in this period.</p>
              ) : (
                <div className="space-y-3">
                  {flowRows.map(({ key, d, out, inn, net }) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className="flex w-28 shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1" style={ds(d.color).chip}>
                        <DeptLogo dept={key} size={14} />
                        <span className="text-xs font-bold" style={{ color: d.color }}>
                          {key}
                        </span>
                      </div>
                      <div className="flex flex-1 gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5" title="Incoming">
                          <ArrowDownLeft className="size-3.5 text-emerald-400/80" strokeWidth={2.25} />
                          <span className="font-bold tabular-nums text-white">{inn}</span>
                        </span>
                        <span className="flex items-center gap-1.5" title="Outgoing">
                          <ArrowUpRight className="size-3.5 text-rose-400/80" strokeWidth={2.25} />
                          <span className="font-bold tabular-nums text-white">{out}</span>
                        </span>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-bold tabular-nums ${net > 0 ? "text-emerald-400" : net < 0 ? "text-rose-400" : "text-slate-500"}`}
                      >
                        {net > 0 ? `+${net}` : net} net
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-5">
              <h3 className="font-display mb-5 font-bold text-white">Busiest routes</h3>
              {topRoutes.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-600">No data yet.</p>
              ) : (
                <div className="space-y-3">
                  {topRoutes.map(([route, n]) => {
                    const [from, to] = route.split("→");
                    return (
                      <div key={route} className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <DeptBadge dept={from} />
                          <ArrowRight className="size-3 shrink-0 text-slate-600" strokeWidth={1.5} />
                          <DeptBadge dept={to} />
                        </div>
                        <span className="shrink-0 text-xs font-bold tabular-nums text-white">{n}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
