import { ArrowRight, Check, Clock } from "lucide-react";
import Badge from "../ui/Badge";
import { cn } from "../../lib/cn";
import { formatDateTime } from "../../lib/format";
import {
  STATUS_LABELS,
  STATUS_TONES,
  approvalState,
  departmentAbbr,
  departmentFor,
  departmentLabel,
} from "../../lib/transferPortal";
import { toneTile } from "../../lib/tones";

/** A department, as a tinted chip in its own colour. */
export function DeptChip({ id, full = false, className }) {
  const department = departmentFor(id);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-bold ring-1 ring-inset",
        toneTile(department?.tone ?? "slate"),
        className,
      )}
      title={department?.label}
    >
      {full ? department?.label ?? id : departmentAbbr(id)}
    </span>
  );
}

/** The move itself — the one thing every row has to show at a glance. */
export function TransferRoute({ from, to, full = false }) {
  return (
    <span className="inline-flex items-center gap-2">
      <DeptChip id={from} full={full} />
      <ArrowRight className="size-3.5 shrink-0 text-slate-500" aria-label="transfers to" />
      <DeptChip id={to} full={full} />
    </span>
  );
}

export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONES[status] ?? "slate"}>{STATUS_LABELS[status] ?? status}</Badge>;
}

/**
 * Both signatures, side by side.
 *
 * Showing the outstanding one as an empty slot rather than hiding it is the
 * whole point: a transfer waiting on the receiving department looks different
 * from one waiting on the outgoing one, and a department head needs to see
 * which at a glance to know whether it is theirs to act on.
 */
export function ApprovalPair({ ticket, className }) {
  const state = approvalState(ticket);
  const sides = [
    { dept: ticket.fromDept, label: "Releasing", approval: state.from },
    { dept: ticket.toDept, label: "Receiving", approval: state.to },
  ];

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {sides.map((side) => (
        <div
          key={side.dept}
          className={cn(
            "rounded-2xl p-4 ring-1 ring-inset",
            side.approval ? "bg-emerald-500/[0.07] ring-emerald-400/25" : "bg-black/20 ring-white/[0.06]",
          )}
        >
          <p className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400">
            {side.label}
            <DeptChip id={side.dept} />
          </p>
          {side.approval ? (
            <>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-200">
                <Check className="size-4" />
                {side.approval.actorName ?? "Approved"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(side.approval.approvedAt)}</p>
            </>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-400">
              <Clock className="size-4 text-amber-400" />
              Waiting on {departmentLabel(side.dept)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

const ACTION_TONES = {
  raised: "text-slate-400",
  approved: "text-emerald-300",
  revoked: "text-amber-300",
  rejected: "text-rose-300",
  completed: "text-emerald-300",
  closed: "text-slate-400",
  reopened: "text-brand-300",
};

/**
 * Everything that has happened to the ticket, oldest first.
 *
 * Append-only, and rendered in full rather than summarised — the value of a
 * transfer history is that a withdrawn approval is still visible six months
 * later, next to the one that replaced it.
 */
export function HistoryTimeline({ history = [] }) {
  if (!history.length) {
    return <p className="text-sm text-slate-500">Nothing has happened yet.</p>;
  }
  return (
    <ol className="space-y-3">
      {history.map((entry, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-white/25" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm text-slate-200">
              <span className={cn("font-semibold capitalize", ACTION_TONES[entry.action] ?? "text-slate-300")}>
                {entry.action}
              </span>
              {entry.actor ? <span className="text-slate-400"> · {entry.actor}</span> : null}
            </p>
            <p className="mt-0.5 break-words text-sm text-slate-400">{entry.details}</p>
            <p className="mt-0.5 text-xs text-slate-600">{formatDateTime(entry.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Who else has this ticket open right now. */
export function PresenceBar({ viewers = [], meId }) {
  const others = viewers.filter((v) => v.id !== meId);
  if (!others.length) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
      </span>
      {others.map((v) => v.name).join(", ")} {others.length === 1 ? "is" : "are"} also viewing this
    </p>
  );
}
