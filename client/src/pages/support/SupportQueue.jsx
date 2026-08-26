import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox, Workflow } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import { TextInput } from "../../components/ui/TextInput";
import AccessDenied from "../../components/auth/AccessDenied";
import { TicketRow } from "./SupportHome";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { useSupportConfig } from "../../context/useSupportConfig";
import { cn } from "../../lib/cn";
import { OPEN_STATUSES, PRIORITIES, TICKET_STATUSES } from "../../lib/support";

const STATUS_OPTIONS = [
  { value: "live", label: "Anything live" },
  { value: "all", label: "Every status" },
  ...TICKET_STATUSES.map((s) => ({ value: s.id, label: s.label })),
];

const PRIORITY_ORDER = Object.fromEntries(PRIORITIES.map((p, i) => [p.id, PRIORITIES.length - i]));

/**
 * The queue.
 *
 * Defaults to unassigned-and-live rather than everything, because the question
 * an agent opens this with is "what is nobody on" — a list dominated by tickets
 * a colleague already took is a list you have to filter before you can use it.
 */
export default function SupportQueue() {
  const { user, hasPermission } = useAuth();
  const { types } = useSupportConfig();
  const typeOptions = useMemo(
    () => [{ value: "all", label: "Every type" }, ...types.map((t) => ({ value: t.id, label: t.label }))],
    [types],
  );
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("live");
  const [type, setType] = useState("all");
  const [scope, setScope] = useState("unassigned");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    api
      .supportTickets()
      .then((result) => active && setData(result))
      .catch(() => active && setData({ tickets: [], agent: false }));
    return () => {
      active = false;
    };
  }, []);

  const tickets = useMemo(() => data?.tickets ?? [], [data]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tickets
      .filter((ticket) => {
        if (status === "live" && !OPEN_STATUSES.includes(ticket.status)) return false;
        if (!["live", "all"].includes(status) && ticket.status !== status) return false;
        if (type !== "all" && ticket.type !== type) return false;
        if (scope === "unassigned" && ticket.assignedToDiscordId) return false;
        if (scope === "mine" && ticket.assignedToDiscordId !== user?.id) return false;
        if (!needle) return true;
        return [ticket.subject, ticket.id, ticket.openedByName, ticket.assignedToName]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      // Urgent first, then whatever has been sitting longest — the two things
      // that decide what to pick up next.
      .sort(
        (a, b) =>
          (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0) ||
          new Date(a.lastMessageAt ?? a.createdAt) - new Date(b.lastMessageAt ?? b.createdAt),
      );
  }, [tickets, status, type, scope, query, user]);

  if (!hasPermission("support.work") && !hasPermission("support.escalated")) {
    return <AccessDenied reason="role" />;
  }

  const counts = {
    unassigned: tickets.filter((t) => OPEN_STATUSES.includes(t.status) && !t.assignedToDiscordId).length,
    mine: tickets.filter((t) => t.assignedToDiscordId === user?.id && OPEN_STATUSES.includes(t.status)).length,
    all: tickets.length,
  };

  return (
    <Section className="max-w-5xl">
      <PageHeader
        eyebrow="Support"
        title="Ticket queue"
        subtitle="Everything open, urgent first and then whatever has been waiting longest."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button as={Link} to="/support" variant="ghost" size="sm">
              <Inbox className="size-4" />
              My tickets
            </Button>
            {hasPermission("support.manage") && (
              <Button as={Link} to="/support/flows" variant="secondary" size="sm">
                <Workflow className="size-4" />
                Response flows
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <ScopeTab active={scope === "unassigned"} onClick={() => setScope("unassigned")} label="Nobody on it" count={counts.unassigned} />
        <ScopeTab active={scope === "mine"} onClick={() => setScope("mine")} label="Mine" count={counts.mine} />
        <ScopeTab active={scope === "all"} onClick={() => setScope("all")} label="Everything" count={counts.all} />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subject, ID or member"
          aria-label="Search tickets"
        />
        <Select value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <Select value={type} options={typeOptions} onChange={setType} />
      </div>

      {data === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-semibold text-white">
            {scope === "unassigned" ? "Nothing waiting to be picked up." : "Nothing matches that."}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
            {scope === "unassigned"
              ? "Every live ticket has somebody on it."
              : "Try a wider filter."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} showOpener />
          ))}
        </div>
      )}
    </Section>
  );
}

function ScopeTab({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-inset transition",
        active ? "bg-brand-500/15 text-white ring-brand-400/40" : "bg-black/20 text-slate-400 ring-white/[0.06] hover:text-white",
      )}
    >
      {label} <span className="tabular-nums text-slate-500">({count})</span>
    </button>
  );
}
