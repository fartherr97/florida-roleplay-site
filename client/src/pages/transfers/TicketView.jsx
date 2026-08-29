// ─────────────────────────────────────────────────────────────────────────────
// Transfer Portal — the ticket detail view
//
// A port of the Ticket View block of app/page.jsx from
// github.com/fartherr97/es-transfer-portal: PresenceBar, TicketChat,
// RejectionModal, ProcessTransferModal, ApprovalChips, HistoryTimeline,
// BgCheckModal, ApprovalsModal and TicketView itself.
//
// Two upstream bugs are fixed here. Both are marked at the point they are
// fixed, and both were reported from the live SSRP portal:
//
//   • The internal chat's unread badge did not survive leaving the ticket.
//   • Transferees were sometimes refused their own open ticket.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Info,
  Lock,
  MessagesSquare,
  RefreshCw,
  Send,
  Shield,
  X,
} from "lucide-react";
import { ALL_RANKS, DEPTS, MIN_REJECTION, RANKS } from "./portalConfig";
import {
  Avatar,
  Btn,
  DeptBadge,
  DeptLogo,
  StatusBadge,
  Textarea,
} from "./portalPrimitives";
import { api, fmtMsgTime } from "./portalUtils";
import { useToast } from "./usePortalToast";
import { actionLabel, actionTone, bodyLabel } from "../../lib/discipline";

/* ─── Presence Bar ─────────────────────────────────────────────────────────── */
// "Who's actively viewing" — avatars of everyone with the ticket open.

function PresenceBar({ viewers }) {
  const list = viewers ?? [];
  return (
    <div className="flex items-center gap-2">
      {list.length > 0 && (
        <div className="flex -space-x-2">
          {list.slice(0, 6).map((v) => (
            <span key={v.id} title={v.name} className="rounded-full ring-2 ring-[#0a0e1a]">
              <Avatar name={v.name} src={v.avatar} size="sm" />
            </span>
          ))}
        </div>
      )}
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        <Eye className="size-3.5" strokeWidth={1.5} />
        {list.length} viewing
      </span>
    </div>
  );
}

/* ─── Ticket Chat ──────────────────────────────────────────────────────────── */

function TicketChat({ ticketId, user, canInternal, refreshSignal }) {
  const [messages, setMessages] = useState([]);
  const [viewers, setViewers] = useState([]);
  const [text, setText] = useState("");
  const [chatTab, setChatTab] = useState("public"); // 'public' | 'internal'
  const [sending, setSending] = useState(false);
  // What this viewer had read last time they looked, from the server. See the
  // note on the read-marking effect below for why this is not a ref.
  const [seen, setSeen] = useState({ public: 0, internal: 0 });
  const listRef = useRef(null);
  const toast = useToast();

  const isInternal = canInternal && chatTab === "internal";

  // Promise style rather than async/await so nothing in here runs on an
  // effect's synchronous path — the same shape every other loader in this repo
  // uses, and it returns its own cancel so a late reply cannot land on an
  // unmounted ticket.
  const loadMessages = useCallback(() => {
    let active = true;
    api(`/chat?transfer=${encodeURIComponent(ticketId)}`)
      .then((data) => {
        if (!active) return;
        setMessages(data.messages ?? []);
        // Only ever move the baseline forward. A poll that lands while the read
        // mark for the tab you are on is in flight would otherwise walk it back
        // and flash the badge you just cleared.
        if (data.seen) {
          setSeen((prev) => ({
            public: Math.max(prev.public, data.seen.public ?? 0),
            internal: Math.max(prev.internal, data.seen.internal ?? 0),
          }));
        }
      })
      .catch(() => {
        /* surfaced once via the ticket loader */
      });
    return () => {
      active = false;
    };
  }, [ticketId]);

  // Immediately reload messages when the parent signals an action completed.
  // `refreshSignal` starts at 0, so this does nothing until an action fires.
  const refreshMessages = useCallback(
    () => (refreshSignal ? loadMessages() : undefined),
    [refreshSignal, loadMessages],
  );
  useEffect(refreshMessages, [refreshMessages]);

  // Heartbeat + poll: announce presence and refresh viewers/messages on a timer.
  useEffect(() => {
    let active = true;
    async function tick() {
      try {
        const res = await fetch(`/api/transfers/${encodeURIComponent(ticketId)}/presence`, {
          method: "POST",
          credentials: "include",
        });
        if (active && res.ok) setViewers(await res.json());
      } catch {
        /* presence is best-effort */
      }
      if (active) loadMessages();
    }
    tick();
    const id = setInterval(tick, 8000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [ticketId, loadMessages]);

  const counts = {
    public: messages.filter((m) => !m.internal).length,
    internal: messages.filter((m) => m.internal).length,
  };
  const visible = messages.filter((m) => (isInternal ? m.internal : !m.internal));

  /**
   * Mark the thread you are looking at as read.
   *
   * **Upstream bug, fixed here.** app/page.jsx keeps the read baseline in a
   * `useRef` seeded at `{ public: 0, internal: 0 }` and never writes it
   * anywhere. That ref dies with the component, so leaving the ticket and
   * coming back re-counts every internal note as unread — read five, close the
   * browser, come back, and the badge says five again. It is wrong within a
   * single visit too: the tab you are not on has a baseline of zero, so its
   * entire history reads as new the moment you open the ticket.
   *
   * The baseline is stored per viewer per ticket instead, so the badge means
   * "since you last looked" and follows the person rather than the tab they
   * happened to have open.
   */
  const activeCount = counts[chatTab];
  useEffect(() => {
    if (activeCount <= 0 || activeCount <= seen[chatTab]) return;
    let active = true;
    const thread = chatTab;
    const count = activeCount;
    api("/chat/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transferId: ticketId, thread, count }),
    })
      .then(() => {
        if (active) setSeen((prev) => ({ ...prev, [thread]: Math.max(prev[thread], count) }));
      })
      .catch(() => {
        // The badge is not worth an error message, but it must not lie either:
        // leaving `seen` alone means it still reads as unread next time.
      });
    return () => {
      active = false;
    };
  }, [ticketId, chatTab, activeCount, seen]);

  const unread = {
    public: Math.max(0, counts.public - seen.public),
    internal: Math.max(0, counts.internal - seen.internal),
  };

  // Keep the message list pinned to the latest message as new ones arrive.
  // Scroll only the list container (never the window), and only when a new
  // message appears in the tab you're already viewing — switching between
  // Public and Internal must not scroll, so it never yanks the page down.
  const prev = useRef({ tab: chatTab, count: visible.length });
  useEffect(() => {
    const el = listRef.current;
    if (el && prev.current.tab === chatTab && visible.length > prev.current.count) {
      el.scrollTop = el.scrollHeight;
    }
    prev.current = { tab: chatTab, count: visible.length };
  }, [visible.length, chatTab]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferId: ticketId, internal: isInternal, message: text.trim() }),
      });
      setText("");
      await loadMessages();
    } catch {
      toast("Message failed to send.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card flex h-[34rem] flex-col overflow-hidden">
      {/* Tab header */}
      <div
        className="flex shrink-0 items-center justify-between border-b px-4"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex">
          {["public", ...(canInternal ? ["internal"] : [])].map((tab) => {
            const isActive = chatTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setChatTab(tab);
                  setText("");
                }}
                className={`nav-tab inline-flex shrink-0 items-center gap-2 px-3 py-3 text-xs font-semibold transition-colors ${isActive ? "nav-active" : "text-slate-400 hover:text-slate-100"}`}
                style={isActive ? { color: tab === "internal" ? "#fbbf24" : "#3b82f6" } : {}}
              >
                {tab === "internal" ? (
                  <span className="flex items-center gap-1.5">
                    <Lock className="size-3" strokeWidth={2.5} />
                    Internal Discussion
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <MessagesSquare className="size-3" strokeWidth={2} />
                    Public Chat
                  </span>
                )}
                {!isActive && unread[tab] > 0 && (
                  <span
                    aria-label={`${unread[tab]} unread`}
                    className="inline-flex size-[1.125rem] animate-pulse items-center justify-center rounded-full text-[10px] font-bold leading-none tabular-nums"
                    style={{
                      backgroundColor:
                        tab === "internal" ? "rgba(251,191,36,0.18)" : "rgba(59,130,246,0.18)",
                      color: tab === "internal" ? "#fbbf24" : "#3b82f6",
                    }}
                  >
                    {unread[tab]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <PresenceBar viewers={viewers} />
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4">
        {visible.length === 0 && (
          <p className="pt-6 text-center text-xs text-slate-600">
            {isInternal
              ? "No internal discussion yet."
              : "No messages yet · say hello to get the conversation started."}
          </p>
        )}
        {visible.map((msg) => {
          const mine = user && msg.authorId && msg.authorId === user.id;
          return (
            <div key={msg.id} className="flex gap-3">
              <Avatar name={msg.author} src={msg.authorAvatar} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p
                    className="font-display text-xs font-bold"
                    style={{ color: mine ? "var(--color-primary)" : "#e2e8f0" }}
                  >
                    {msg.author}
                  </p>
                  <p className="text-[11px] text-slate-600">{fmtMsgTime(msg.createdAt)}</p>
                </div>
                <div
                  className={`mt-1 inline-block max-w-full overflow-hidden rounded-xl border px-3 py-2 ${isInternal ? "border-amber-500/25 bg-amber-500/[0.06]" : "border-white/5"}`}
                  style={isInternal ? {} : { backgroundColor: "var(--color-surface-2)" }}
                >
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
                    {msg.message}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t p-3" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#f2800d]"
            style={{
              backgroundColor: "var(--color-bg)",
              borderColor: isInternal ? "rgba(251,191,36,0.4)" : "var(--color-border)",
            }}
            placeholder={isInternal ? "Internal discussion (staff only)..." : "Type a message..."}
            aria-label={isInternal ? "Internal message" : "Message"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Btn size="md" variant="primary" disabled={sending || !text.trim()} onClick={send}>
            <Send className="size-4" strokeWidth={1.75} />
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ─── Rejection Modal ──────────────────────────────────────────────────────── */

function RejectionModal({ onClose, onConfirm, busy }) {
  const [reason, setReason] = useState("");
  const tooShort = reason.trim().length > 0 && reason.trim().length < MIN_REJECTION;
  const canSubmit = reason.trim().length >= MIN_REJECTION;

  return (
    <ModalShell
      title="Reject Transfer"
      subtitle="Provide a reason for the denial (required)"
      onClose={onClose}
      width="max-w-md"
    >
      <div className="space-y-4 px-5 py-5">
        <Textarea
          label="Reason for rejection"
          placeholder={`Explain why this transfer is being denied. (minimum ${MIN_REJECTION} characters)`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex items-center justify-between px-1">
          <p className={`text-xs ${tooShort ? "text-rose-400" : "text-slate-600"}`}>
            {tooShort ? `${MIN_REJECTION - reason.trim().length} more characters required` : ""}
          </p>
          <p
            className={`text-xs tabular-nums ${reason.trim().length >= MIN_REJECTION ? "text-emerald-400" : "text-slate-600"}`}
          >
            {reason.trim().length} / {MIN_REJECTION}
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <Btn variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
          <Btn
            variant="danger"
            size="sm"
            disabled={!canSubmit || busy}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy ? "Rejecting..." : "Confirm Rejection"}
          </Btn>
        </div>
      </div>
    </ModalShell>
  );
}

/* ─── Process Transfer Modal ───────────────────────────────────────────────── */

function ProcessTransferModal({ transfer, onClose, onConfirm, busy }) {
  const eligibleRanks = RANKS[transfer.toDept] ?? ALL_RANKS;

  const [assignedRank, setAssignedRank] = useState("");
  const [employmentType, setEmploymentType] = useState("fulltime");

  const canSubmit = assignedRank.trim().length > 0;

  return (
    <ModalShell
      title="Process Transfer"
      subtitle={`${transfer.member} → ${transfer.toDept}`}
      onClose={onClose}
      width="max-w-md"
    >
      <div className="space-y-4 px-5 py-5">
        {/* Rank */}
        <label className="flex flex-col gap-1.5">
          <span className="font-display text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Assigned Rank in {transfer.toDept}
          </span>
          <select
            value={assignedRank}
            onChange={(e) => setAssignedRank(e.target.value)}
            className="w-full rounded-xl border px-4 py-2.5 text-sm text-white outline-none transition-all duration-200 focus:border-[#f2800d] focus:ring-2 focus:ring-[#f2800d]/20"
            style={{ backgroundColor: "var(--color-bg)", borderColor: "var(--color-border)" }}
          >
            <option value="">Select rank...</option>
            {eligibleRanks.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        {/* Employment type */}
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Employment Type
          </span>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "fulltime", label: "Full Time" },
              { value: "parttime", label: "Part Time" },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setEmploymentType(value)}
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all"
                style={
                  employmentType === value
                    ? {
                        backgroundColor: "rgba(242,128,13,0.15)",
                        borderColor: "rgba(242,128,13,0.6)",
                        color: "var(--color-primary)",
                      }
                    : {
                        backgroundColor: "var(--color-bg)",
                        borderColor: "var(--color-border)",
                        color: "#94a3b8",
                      }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Btn variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
          <Btn
            variant="complete"
            size="sm"
            disabled={!canSubmit || busy}
            onClick={() => onConfirm({ assignedRank, employmentType })}
          >
            {busy ? "Processing..." : "Process Transfer"}
          </Btn>
        </div>
      </div>
    </ModalShell>
  );
}

/* ─── Approval Chips ───────────────────────────────────────────────────────── */

function ApprovalChips({ transfer }) {
  const approvals = transfer.approvals ?? [];
  const fromApproved = approvals.find((a) => a.dept === transfer.fromDept);
  const toApproved = approvals.find((a) => a.dept === transfer.toDept);
  const count = (fromApproved ? 1 : 0) + (toApproved ? 1 : 0);

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-display text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          Department Approvals
        </span>
        <span
          className={`text-xs font-bold tabular-nums ${count === 2 ? "text-emerald-400" : "text-slate-500"}`}
        >
          {count}/2 approved
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <ApprovalChip dept={transfer.fromDept} approval={fromApproved} />
        <ApprovalChip dept={transfer.toDept} approval={toApproved} />
      </div>
    </div>
  );
}

function ApprovalChip({ dept, approval }) {
  if (approval) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold"
        style={{
          color: "#34d399",
          backgroundColor: "rgba(52,211,153,0.1)",
          borderColor: "rgba(52,211,153,0.3)",
        }}
      >
        <Check className="size-3" strokeWidth={2.5} />
        {dept} approved
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold"
      style={{
        color: "#94a3b8",
        backgroundColor: "rgba(148,163,184,0.06)",
        borderColor: "rgba(148,163,184,0.15)",
      }}
    >
      <Clock className="size-3" strokeWidth={2} />
      {dept} pending
    </span>
  );
}

/* ─── History Timeline ─────────────────────────────────────────────────────── */

const HISTORY_ACTION_CFG = {
  approved: { color: "#34d399", Icon: Check },
  rejected: { color: "#fb7185", Icon: X },
  completed: { color: "#38bdf8", Icon: CheckCircle2 },
  reopened: { color: "#f59e0b", Icon: RefreshCw },
  revoked: { color: "#f59e0b", Icon: X },
  closed: { color: "#94a3b8", Icon: Lock },
};

function HistoryTimeline({ history }) {
  if (!history || history.length === 0) return null;

  return (
    <div className="card p-5">
      <h3 className="font-display mb-4 font-bold text-white">Activity History</h3>
      <div className="space-y-3">
        {history.map((entry, i) => {
          const cfg = HISTORY_ACTION_CFG[entry.action] ?? { color: "#94a3b8", Icon: Info };
          const { color, Icon: EntryIcon } = cfg;
          return (
            <div key={`${entry.timestamp}-${i}`} className="flex gap-3">
              <div
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: color + "20", color }}
              >
                <EntryIcon className="size-3.5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-200">
                  <span className="font-semibold">{entry.actor}</span>
                  {" - "}
                  {entry.details}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-600">{fmtMsgTime(entry.timestamp)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Background Check Modal ───────────────────────────────────────────────── */

/** Badge colours for a disciplinary action type, keyed off its tone. */
const BG_TONE = {
  amber: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  primary: "bg-blue-500/15 text-blue-300 ring-blue-400/30",
  brand: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
  violet: "bg-violet-500/15 text-violet-300 ring-violet-400/30",
  rose: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
  slate: "bg-slate-500/15 text-slate-300 ring-slate-400/30",
};

function bgDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** One disciplinary entry as a labelled row. */
function BgEntry({ action }) {
  return (
    <li className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${
            BG_TONE[actionTone(action.type)] ?? BG_TONE.slate
          } ${action.voided ? "line-through opacity-60" : ""}`}
        >
          {actionLabel(action.type)}
        </span>
        <span className="text-xs font-medium text-slate-400">{bodyLabel(action.bodyId)}</span>
        <span className="ml-auto text-[11px] text-slate-500">{bgDate(action.createdAt)}</span>
      </div>
      {action.reason && <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{action.reason}</p>}
      {action.voided && (
        <p className="mt-1 text-[11px] italic text-slate-500">
          Revoked{action.voidReason ? ` — ${action.voidReason}` : ""}
        </p>
      )}
    </li>
  );
}

/** A whole section — non-verbal or verbal — always shown, "None on record" when empty. */
function BgSection({ label, list }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label} <span className="text-slate-600">({list.length})</span>
      </p>
      {list.length ? (
        <ul className="space-y-1.5">
          {list.map((action, i) => (
            <BgEntry key={action.id ?? i} action={action} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-white/[0.08] px-3 py-2 text-xs text-slate-500">
          None on record.
        </p>
      )}
    </div>
  );
}

/**
 * The transferee's disciplinary record, pulled into the ticket for whoever manages it.
 *
 * Fetches the same folded record the DA Hub renders, authorized by the ticket rather than
 * by `discipline.view` (see the /:id/bgcheck endpoint) so a department head can read it in
 * this context. Ephemeral to the modal — nothing is stored or posted.
 */
function BgCheckModal({ transfer, onClose }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let active = true;
    api(`/${encodeURIComponent(transfer.id)}/bgcheck`)
      .then((res) => active && setState({ loading: false, error: null, data: res }))
      .catch(
        (err) =>
          active &&
          setState({
            loading: false,
            error: err?.status === 403 ? "You don't manage this ticket." : "Could not load the record.",
            data: null,
          }),
      );
    return () => {
      active = false;
    };
  }, [transfer.id]);

  const bg = state.data?.background;
  const nonVerbal = bg ? [...bg.nonVerbal.staff, ...bg.nonVerbal.department] : [];
  const verbal = bg ? [...bg.verbal.staff, ...bg.verbal.department] : [];
  const sortByDate = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

  return (
    <ModalShell
      title="Background Check"
      subtitle={`${transfer.member} · ${transfer.rank}`}
      onClose={onClose}
      width="max-w-lg"
    >
      <div className="space-y-4 px-5 py-5">
        {state.loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <RefreshCw className="size-4 animate-spin" /> Pulling the record…
          </div>
        )}

        {state.error && (
          <p className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-300">
            {state.error}
          </p>
        )}

        {!state.loading && !state.error && !bg && (
          <div className="space-y-2 py-4 text-center">
            <Shield className="mx-auto size-9 text-slate-600" strokeWidth={1.25} />
            <p className="text-sm text-slate-400">
              No Discord ID is recorded on this ticket, so a reliable record can't be pulled. Run{" "}
              <code className="rounded bg-black/40 px-1 py-0.5 text-xs text-slate-300">/bgcheck</code> in
              Discord instead.
            </p>
          </div>
        )}

        {bg && (
          <>
            {/* Headline + summary. */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-slate-400" strokeWidth={1.75} />
                <p className="text-sm font-semibold text-white">{bg.headline}</p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="Non-verbal" value={bg.nonVerbal.total} tone={bg.nonVerbal.total ? "rose" : "slate"} />
                <Stat label="Verbal" value={bg.verbal.total} tone={bg.verbal.total ? "amber" : "slate"} />
                <Stat label="Revoked" value={bg.voided.length} tone="slate" />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Last {Math.round(bg.windowDays / 30)} months · read from this ticket, not stored.
              </p>
            </div>

            {bg.active.length > 0 && (
              <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300">
                {bg.active.length} action{bg.active.length === 1 ? "" : "s"} still active right now.
              </p>
            )}

            <BgSection label="Non-verbal" list={[...nonVerbal].sort(sortByDate)} />
            <BgSection label="Verbal" list={[...verbal].sort(sortByDate)} />
          </>
        )}
      </div>
    </ModalShell>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-lg bg-black/20 px-2 py-2">
      <p className={`text-lg font-extrabold ${tone === "rose" ? "text-rose-300" : tone === "amber" ? "text-amber-300" : "text-slate-300"}`}>
        {value}
      </p>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
    </div>
  );
}

/* ─── Management Approvals Modal ───────────────────────────────────────────── */

function ApprovalsModal({ transfer, busy, onApprove, onRevoke, onClose }) {
  const depts = [transfer.fromDept, transfer.toDept];
  const approvedBy = (d) => (transfer.approvals ?? []).find((a) => a.dept === d);

  return (
    <ModalShell
      title="Department Approvals"
      subtitle="Approve or revoke each department individually"
      onClose={onClose}
      width="max-w-sm"
    >
      <div className="divide-y px-5 py-2" style={{ borderColor: "var(--color-border)" }}>
        {depts.map((dept) => {
          const entry = approvedBy(dept);
          return (
            <div key={dept} className="flex items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3">
                <DeptLogo dept={dept} size={28} />
                <div>
                  <p className="text-sm font-semibold text-white">{dept}</p>
                  {entry ? (
                    <p className="text-[11px] text-emerald-400">Approved by {entry.dhName}</p>
                  ) : (
                    <p className="text-[11px] text-slate-500">Pending approval</p>
                  )}
                </div>
              </div>
              {entry ? (
                <Btn size="xs" variant="secondary" disabled={busy} onClick={() => onRevoke(dept)}>
                  <X className="size-3" strokeWidth={2.5} /> Revoke
                </Btn>
              ) : (
                <Btn size="xs" variant="approve" disabled={busy} onClick={() => onApprove(dept)}>
                  <Check className="size-3" strokeWidth={2.5} /> Approve
                </Btn>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-t px-5 py-4" style={{ borderColor: "var(--color-border)" }}>
        <Btn variant="secondary" size="sm" onClick={onClose} className="w-full justify-center">
          Done
        </Btn>
      </div>
    </ModalShell>
  );
}

/**
 * The chrome every modal above shares.
 *
 * The original repeats this markup five times. It is one component here because
 * five copies is five places for the Escape key to be forgotten — which is what
 * happened upstream: none of them close on Escape, and the scrim closes them
 * only because it is the click target.
 */
function ModalShell({ title, subtitle, onClose, width = "max-w-md", children }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`card w-full ${width} max-h-[calc(100vh-2rem)] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="min-w-0">
            <p className="font-bold text-white">{title}</p>
            {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0 text-slate-500 transition-colors hover:text-white"
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── Ticket View ──────────────────────────────────────────────────────────── */
// Full ticket detail page — ticket info, approval status, action buttons, chat
// thread and history timeline. Access is enforced server-side in
// server/src/lib/portal.js; the UI mirrors those rules for visual gating only.

export default function TicketView({ ticketId, user, onBack }) {
  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false); // 403 / 404 from API
  const [busy, setBusy] = useState(false); // action in progress
  const [bgCheck, setBgCheck] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showProcess, setShowProcess] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  const [chatRefresh, setChatRefresh] = useState(0);
  const toast = useToast();
  // Synchronous guard — prevents concurrent handler execution even when React
  // hasn't re-rendered yet to apply disabled={busy} to buttons.
  const actionInFlight = useRef(false);

  // Starts true and is only cleared from the promise, so the mount effect never
  // sets state on its synchronous path.
  const load = useCallback(() => {
    let active = true;
    fetch(`/api/transfers/${encodeURIComponent(ticketId)}`, { credentials: "include" })
      .then(async (res) => {
        if (!active) return;
        // 403 and 404 are the only two answers that mean "this ticket is not
        // for you". Upstream also lands here on a 401 and on a 503, and shows
        // the same "you don't have access to this transfer ticket" — which is
        // how somebody whose session lapsed, or who arrived while the database
        // was down, is told they have been thrown off their own open ticket.
        if (res.status === 403 || res.status === 404) {
          setDenied(true);
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!active) return;
        setTransfer(data);
        setDenied(false);
      })
      .catch(() => active && toast("Failed to load ticket.", "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [ticketId, toast]);

  useEffect(load, [load]);

  // ── Derived permissions (mirrors server/src/lib/portal.js) ────────────────
  const canManage =
    !!transfer &&
    !!user &&
    (user.isManagement ||
      (user.isDeptHead && (transfer.fromDept === user.dept || transfer.toDept === user.dept)));

  // Has this user's department already approved?
  const deptAlreadyApproved =
    !!transfer && !!user?.dept && !!(transfer.approvals ?? []).find((a) => a.dept === user.dept);

  // Both depts have approved = ready to process.
  const bothApproved =
    !!transfer &&
    (transfer.approvals ?? []).some((a) => a.dept === transfer.fromDept) &&
    (transfer.approvals ?? []).some((a) => a.dept === transfer.toDept);

  /**
   * Wraps an async handler so that only one action runs at a time — the ref
   * check is synchronous, which beats React's async setBusy — and so an error
   * always shows a toast and never leaves the guard stuck.
   */
  function withGuard(fn, errMsg = "Action failed.") {
    return async (...args) => {
      if (actionInFlight.current) return;
      actionInFlight.current = true;
      setBusy(true);
      try {
        await fn(...args);
      } catch {
        toast(errMsg, "error");
      } finally {
        actionInFlight.current = false;
        setBusy(false);
      }
    };
  }

  async function patch(body) {
    return api(`/${encodeURIComponent(ticketId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const handleAction = withGuard(async (action, successMsg, type = "success") => {
    setTransfer(await patch({ action }));
    setChatRefresh((n) => n + 1);
    toast(successMsg, type);
  });

  const handleApprove = withGuard(async (dept) => {
    const body = typeof dept === "string" ? { action: "approve", dept } : { action: "approve" };
    setTransfer(await patch(body));
    toast(typeof dept === "string" ? `${dept} approval recorded.` : "Approval recorded.", "success");
  }, "Failed to record approval.");

  const handleRevokeApproval = withGuard(async (dept) => {
    const body =
      typeof dept === "string" ? { action: "revoke-approval", dept } : { action: "revoke-approval" };
    setTransfer(await patch(body));
    toast(typeof dept === "string" ? `${dept} approval revoked.` : "Approval revoked.", "info");
  }, "Failed to revoke approval.");

  const handleReject = withGuard(async (reason) => {
    setTransfer(await patch({ status: "rejected", rejectionReason: reason }));
    setShowReject(false);
    setChatRefresh((n) => n + 1);
    toast("Transfer rejected.", "error");
  }, "Failed to reject transfer.");

  const handleProcess = withGuard(async ({ assignedRank, employmentType }) => {
    setTransfer(await patch({ action: "process", assignedRank, employmentType }));
    setShowProcess(false);
    setChatRefresh((n) => n + 1);
    toast("Transfer processed and completed.", "success");
  }, "Failed to process transfer.");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} /> Back
      </button>

      {loading ? (
        <div className="card py-24 text-center text-sm text-slate-600">Loading ticket...</div>
      ) : denied ? (
        <div className="card flex flex-col items-center py-20 text-center">
          <Lock className="mb-3 size-9 text-slate-700" strokeWidth={1.25} />
          <p className="font-display font-bold text-white">Ticket unavailable</p>
          <p className="mt-1 text-sm text-slate-500">
            You don&apos;t have access to this transfer ticket.
          </p>
        </div>
      ) : transfer ? (
        <div className="space-y-3 sm:space-y-4">
          {/* Header card */}
          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <span
                className="inline-flex items-center gap-1.5 rounded-md border border-[#f2800d]/30 bg-[#f2800d]/10 px-2.5 py-1 text-xs font-bold tracking-wide"
                style={{ color: "var(--color-primary)" }}
              >
                <MessagesSquare className="size-3.5" strokeWidth={2} /> {transfer.id}
              </span>
              <StatusBadge status={transfer.status} />
            </div>

            <h1 className="font-display mt-3 text-xl font-bold text-white sm:text-2xl">
              {transfer.member}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Discord: {transfer.discord} · {transfer.rank}
            </p>

            {/* Dept route */}
            <div
              className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3"
              style={{ backgroundColor: "var(--color-bg)", borderColor: "var(--color-border)" }}
            >
              <DeptBadge dept={transfer.fromDept} fullName />
              <ArrowRight className="size-4 shrink-0 text-slate-600" strokeWidth={1.5} />
              <DeptBadge dept={transfer.toDept} fullName />
            </div>

            {/* Staff-only: approval state, completion details, rejection reason */}
            {canManage && (
              <>
                <ApprovalChips transfer={transfer} />

                {transfer.status === "approved" && bothApproved && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-sky-500/25 bg-sky-500/[0.06] px-4 py-3">
                    <CheckCircle2 className="size-5 shrink-0 text-sky-400" strokeWidth={2} />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Both departments have approved
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Assign the incoming rank below to complete the transfer.
                      </p>
                    </div>
                  </div>
                )}

                {transfer.status === "completed" && (
                  <div className="mt-3">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold"
                      style={{
                        color: "#38bdf8",
                        backgroundColor: "rgba(56,189,248,0.1)",
                        borderColor: "rgba(56,189,248,0.35)",
                      }}
                    >
                      <CheckCircle2 className="size-3.5" strokeWidth={2} /> Processing complete ·
                      ready to close
                    </span>
                  </div>
                )}

                {transfer.status === "rejected" && transfer.rejectionReason && (
                  <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-3">
                    <p className="font-display mb-1 text-[11px] font-semibold uppercase tracking-widest text-rose-400">
                      Rejection Reason
                    </p>
                    <p className="text-sm leading-relaxed text-slate-300">
                      {transfer.rejectionReason}
                    </p>
                  </div>
                )}

                {transfer.status === "completed" && (
                  <div className="mt-3 flex flex-wrap gap-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3">
                    {transfer.assignedRank && (
                      <div>
                        <p className="font-display mb-0.5 text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
                          Assigned Rank
                        </p>
                        <p className="text-sm font-semibold text-white">{transfer.assignedRank}</p>
                      </div>
                    )}
                    {transfer.employmentType && (
                      <div>
                        <p className="font-display mb-0.5 text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
                          Employment
                        </p>
                        <p className="text-sm font-semibold text-white">
                          {transfer.employmentType === "parttime" ? "Part Time" : "Full Time"}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Reason */}
            <div className="mt-4">
              <p className="font-display mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                Reason for transfer
              </p>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">
                {transfer.reason || <span className="italic text-slate-600">No reason provided.</span>}
              </p>
            </div>

            {/* Status controls — staff only */}
            {canManage && (
              <div
                className="mt-5 space-y-2 border-t pt-4"
                style={{ borderColor: "var(--color-border)" }}
              >
                {/* Row 1 — Approve/Revoke (pending or approved) */}
                {(transfer.status === "pending" || transfer.status === "approved") && (
                  <div>
                    {user?.isManagement ? (
                      <Btn
                        size="sm"
                        variant="approve"
                        disabled={busy}
                        onClick={() => setShowApprovals(true)}
                        className="w-full justify-center"
                      >
                        <Check className="size-3.5" strokeWidth={2.5} /> Approvals
                        <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] tabular-nums">
                          {(transfer.approvals ?? []).length}/2
                        </span>
                      </Btn>
                    ) : (
                      user?.isDeptHead &&
                      (deptAlreadyApproved ? (
                        <Btn
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => handleRevokeApproval()}
                          className="w-full justify-center"
                        >
                          <X className="size-3.5" strokeWidth={2.5} /> Revoke Approval
                        </Btn>
                      ) : (
                        <Btn
                          size="sm"
                          variant="approve"
                          disabled={busy}
                          onClick={() => handleApprove()}
                          className="w-full justify-center"
                        >
                          <Check className="size-3.5" strokeWidth={2.5} /> Approve Transfer
                        </Btn>
                      ))
                    )}
                  </div>
                )}

                {/* Row 2 — Process Transfer (once both approved) + Reject. */}
                {(transfer.status === "pending" || transfer.status === "approved") && (
                  <div className="flex gap-2">
                    {(bothApproved || user?.isManagement) && (
                      <Btn
                        size="sm"
                        variant="complete"
                        disabled={busy || !bothApproved}
                        title={
                          bothApproved ? undefined : "Both departments have to approve first."
                        }
                        onClick={() => setShowProcess(true)}
                        className="flex-1 justify-center"
                      >
                        <CheckCircle2 className="size-3.5" strokeWidth={2} /> Process Transfer
                      </Btn>
                    )}
                    <Btn
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => setShowReject(true)}
                      className="flex-1 justify-center"
                    >
                      <X className="size-3.5" strokeWidth={2.5} /> Reject
                    </Btn>
                  </div>
                )}

                {/* Row 3 — Background Check + Close / Reopen (management only) */}
                <div className="flex gap-2">
                  {(user?.isManagement || ["pending", "approved"].includes(transfer.status)) && (
                    <Btn
                      size="sm"
                      variant="secondary"
                      onClick={() => setBgCheck(true)}
                      className="flex-1 justify-center"
                    >
                      <Shield className="size-3.5" strokeWidth={1.75} /> Background Check
                    </Btn>
                  )}
                  {user?.isManagement && transfer.status !== "closed" && (
                    <Btn
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => handleAction("close", "Ticket closed.", "info")}
                      className="flex-1 justify-center"
                    >
                      <Lock className="size-3.5" strokeWidth={2} /> Close Ticket
                    </Btn>
                  )}
                  {user?.isManagement &&
                    ["closed", "completed", "rejected"].includes(transfer.status) && (
                      <Btn
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => handleAction("reopen", "Ticket reopened.")}
                        className="flex-1 justify-center"
                      >
                        <RefreshCw className="size-3.5" strokeWidth={2} /> Reopen
                      </Btn>
                    )}
                </div>
              </div>
            )}
          </div>

          {/* Chat */}
          <TicketChat
            ticketId={transfer.id}
            user={user}
            canInternal={canManage}
            refreshSignal={chatRefresh}
          />

          {/* History timeline — staff only */}
          {canManage && <HistoryTimeline history={transfer.history} />}
        </div>
      ) : null}

      {bgCheck && transfer && (
        <BgCheckModal transfer={transfer} onClose={() => setBgCheck(false)} />
      )}
      {showReject && transfer && (
        <RejectionModal onClose={() => setShowReject(false)} onConfirm={handleReject} busy={busy} />
      )}
      {showProcess && transfer && (
        <ProcessTransferModal
          transfer={transfer}
          onClose={() => setShowProcess(false)}
          onConfirm={handleProcess}
          busy={busy}
        />
      )}
      {showApprovals && transfer && (
        <ApprovalsModal
          transfer={transfer}
          busy={busy}
          onApprove={(dept) => handleApprove(dept)}
          onRevoke={(dept) => handleRevokeApproval(dept)}
          onClose={() => setShowApprovals(false)}
        />
      )}
    </main>
  );
}

export { DEPTS };
