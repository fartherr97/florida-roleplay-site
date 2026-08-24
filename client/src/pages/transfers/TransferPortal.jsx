import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Inbox, Plus, Settings2 } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import AccessDenied from "../../components/auth/AccessDenied";
import { StatusBadge, TransferRoute } from "../../components/transfers/TicketBits";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { formatDateTime } from "../../lib/format";
import {
  STATUS_LABELS,
  TRANSFER_DEPARTMENTS,
  TRANSFER_STATUSES,
  approvalState,
  departmentAbbr,
} from "../../lib/transferPortal";

const STATUS_OPTIONS = [
  { value: "all", label: "Every status" },
  ...TRANSFER_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
];

const DEPT_OPTIONS = [
  { value: "all", label: "Every department" },
  ...TRANSFER_DEPARTMENTS.map((d) => ({ value: d.id, label: d.label })),
];

/**
 * The queue.
 *
 * The original opened on a dashboard of counts with the queue a tab away. This
 * opens on the queue, because the counts are answerable at a glance from the
 * rows themselves and the reason anybody opens this portal is that something is
 * waiting for them.
 */
export default function TransferPortal() {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("all");
  const [dept, setDept] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    api
      .transfers()
      .then((result) => active && setData(result))
      .catch(() => active && setData({ tickets: [], me: { departments: [], management: false } }));
    return () => {
      active = false;
    };
  }, []);

  const tickets = useMemo(() => data?.tickets ?? [], [data]);
  const me = data?.me ?? { departments: [], management: false };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (status !== "all" && ticket.status !== status) return false;
      if (dept !== "all" && ticket.fromDept !== dept && ticket.toDept !== dept) return false;
      if (!needle) return true;
      return [ticket.id, ticket.memberName, ticket.currentRank, ticket.assignedRank]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [tickets, status, dept, query]);

  // Tickets this caller has not signed yet, on a side they sign for. This is
  // the number that actually means "you have work" — a pending count includes
  // everything waiting on the other department.
  const waitingOnMe = useMemo(() => {
    if (!me.departments.length) return 0;
    return tickets.filter((ticket) => {
      if (ticket.status !== "pending") return false;
      const signed = new Set((ticket.approvals ?? []).map((a) => a.dept));
      return me.departments.some(
        (d) => (ticket.fromDept === d || ticket.toDept === d) && !signed.has(d),
      );
    }).length;
  }, [tickets, me.departments]);

  if (!user) return <AccessDenied reason="signed-out" />;
  if (!hasPermission("transfers.view")) return <AccessDenied reason="role" />;

  const loading = data === null;

  return (
    <Section className="max-w-5xl">
      <PageHeader
        eyebrow="Emergency services"
        title="Transfer portal"
        subtitle={
          me.management
            ? "Every transfer between the emergency services departments."
            : me.departments.length
              ? `Transfers involving ${me.departments.map(departmentAbbr).join(" and ")}, and your own.`
              : "Your own transfer requests."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {me.management && (
              <Button as={Link} to="/transfers/settings" variant="ghost" size="sm">
                <Settings2 className="size-4" />
                Settings
              </Button>
            )}
            <Button as={Link} to="/transfers/new" size="sm">
              <Plus className="size-4" />
              Raise a transfer
            </Button>
          </div>
        }
      />

      {waitingOnMe > 0 && (
        <Card className="mb-6 flex flex-wrap items-center gap-3 p-5 ring-1 ring-inset ring-amber-400/25">
          <Inbox className="size-5 shrink-0 text-amber-400" />
          <p className="min-w-0 flex-1 text-sm text-slate-200">
            <span className="font-bold text-white">{waitingOnMe}</span>{" "}
            {waitingOnMe === 1 ? "transfer is" : "transfers are"} waiting on your signature.
          </p>
          <Button variant="secondary" size="sm" onClick={() => setStatus("pending")}>
            Show them
          </Button>
        </Card>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, rank or ticket"
          aria-label="Search transfers"
        />
        <Select value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <Select value={dept} options={DEPT_OPTIONS} onChange={setDept} />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-semibold text-white">
            {tickets.length === 0 ? "No transfers yet." : "Nothing matches that."}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
            {tickets.length === 0
              ? "A transfer moves a member from one emergency services department to another. Both departments have to sign."
              : "Try a wider filter."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </Section>
  );
}

function TicketRow({ ticket }) {
  const state = approvalState(ticket);
  return (
    <Card as={Link} to={`/transfers/${ticket.id}`} hover className="flex flex-wrap items-center gap-4 p-5">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2.5 text-sm font-semibold text-white">
          {ticket.memberName}
          <StatusBadge status={ticket.status} />
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <TransferRoute from={ticket.fromDept} to={ticket.toDept} />
          <span>·</span>
          <span>{ticket.currentRank}</span>
          <span>·</span>
          <code>{ticket.id}</code>
          <span>·</span>
          <span>{formatDateTime(ticket.createdAt)}</span>
        </div>
        {ticket.status === "pending" && state.outstanding.length > 0 && (
          <p className="mt-1.5 text-xs text-amber-300">
            Waiting on {state.outstanding.map(departmentAbbr).join(" and ")}
          </p>
        )}
      </div>
      <ArrowRight className="size-4 shrink-0 text-slate-500" />
    </Card>
  );
}
