import TicketTypePicker from "../../components/support/TicketTypePicker";
import { createElement, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Inbox, SlidersHorizontal } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import AccessDenied from "../../components/auth/AccessDenied";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { iconFor } from "../../lib/icons";
import { formatDateTimeLocal } from "../../lib/format";
import { PRIORITY_MAP, statusLabel, statusTone } from "../../lib/support";
import { useSupportConfig } from "../../context/useSupportConfig";

export default function SupportHome() {
  const navigate = useNavigate();
  const { user, hasPermission, loading } = useAuth();
  const { types: catalogue, canConfigure, loading: configLoading, error: configError, reload } = useSupportConfig();
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    api
      .supportTickets("mine")
      .then((result) => active && setData(result))
      .catch(() => active && setData({ tickets: [], agent: false }));
    return () => {
      active = false;
    };
  }, []);

  // The categories this member may open — enabled, and either public or gated on
  // a permission they hold. The server re-checks on submit.
  const types = useMemo(
    () =>
      catalogue.filter(
        (type) => type.enabled !== false && (!type.openPermission || hasPermission(type.openPermission)),
      ),
    [catalogue, hasPermission],
  );

  // Wait for auth to resolve before deciding — otherwise a refresh flashes the
  // signed-out screen for a frame while GET /api/me is still in flight.
  if (loading) return null;
  if (!user) return <AccessDenied reason="signed-out" />;

  const tickets = data?.tickets ?? [];
  const open = tickets.filter((t) => t.status !== "closed" && t.status !== "resolved");

  return (
    <Section className="max-w-6xl">
      <PageHeader
        eyebrow="Support"
        title="How can we help?"
        subtitle="Pick what it is about and we'll route it to whoever handles that. Every ticket gets an answer."
        actions={
          <div className="flex flex-wrap gap-2">
            {canConfigure && (
              <Button as={Link} to="/support/types" variant="ghost" size="sm">
                <SlidersHorizontal className="size-4" />
                Manage queues
              </Button>
            )}
            {data?.agent && (
              <Button as={Link} to="/support/queue" variant="secondary" size="sm">
                <Inbox className="size-4" />
                The queue
              </Button>
            )}
          </div>
        }
      />

      {configLoading ? <p role="status">Loading ticket queues...</p> : configError ? <div role="alert">Ticket queues could not be loaded. <Button onClick={reload}>Retry</Button></div> : <TicketTypePicker types={types} onSelect={type => navigate(`/support/new?type=${encodeURIComponent(type.id)}`)} />}

      {/* Their own tickets, if any — start here, but see where things got to too. */}
      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400">Your tickets</h2>
          {open.length > 0 && <Badge tone="primary">{open.length} open</Badge>}
        </div>

        {data === null ? (
          <div className="space-y-3">
            {[0, 1].map((n) => (
              <div key={n} className="h-20 animate-pulse rounded-2xl bg-white/[0.03]" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-slate-400">
              Nothing open yet. Pick a category above and a staff member will pick it up.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

export function TicketRow({ ticket, showOpener = false }) {
  const { typeMap } = useSupportConfig();
  const type = typeMap[ticket.type];
  return (
    <Card as={Link} to={`/support/${ticket.id}`} hover className="flex flex-wrap items-center gap-4 p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-slate-300 ring-1 ring-inset ring-white/[0.06]">
        {createElement(iconFor(type?.icon ?? "LifeBuoy"), { className: "size-5" })}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
          {ticket.subject}
          <Badge tone={statusTone(ticket.status)}>{statusLabel(ticket.status)}</Badge>
          {ticket.priority && ticket.priority !== "normal" && (
            <Badge tone={PRIORITY_MAP[ticket.priority]?.tone}>{PRIORITY_MAP[ticket.priority]?.label}</Badge>
          )}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{type?.label ?? ticket.type}</span>
          <span>·</span>
          <code>{ticket.id}</code>
          {showOpener && (
            <>
              <span>·</span>
              <span>{ticket.openedByName}</span>
            </>
          )}
          <span>·</span>
          <span>{formatDateTimeLocal(ticket.lastMessageAt ?? ticket.createdAt)}</span>
          {ticket.assignedToName && (
            <>
              <span>·</span>
              <span className="text-slate-400">{ticket.assignedToName}</span>
            </>
          )}
        </p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-slate-500" />
    </Card>
  );
}
