import { createElement, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Inbox, Plus } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import AccessDenied from "../../components/auth/AccessDenied";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { iconFor } from "../../lib/icons";
import { formatDateTime } from "../../lib/format";
import { PRIORITY_MAP, TYPE_MAP, statusLabel, statusTone, typeLabel } from "../../lib/support";

/** A member's own tickets. Everything they have opened, newest activity first. */
export default function SupportHome() {
  const { user } = useAuth();
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

  if (!user) return <AccessDenied reason="signed-out" />;

  const tickets = data?.tickets ?? [];

  return (
    <Section className="max-w-4xl">
      <PageHeader
        eyebrow="Support"
        title="Your tickets"
        subtitle="Anything you have asked us about, and where it got to. We answer every one."
        actions={
          <div className="flex flex-wrap gap-2">
            {data?.agent && (
              <Button as={Link} to="/support/queue" variant="secondary" size="sm">
                <Inbox className="size-4" />
                The queue
              </Button>
            )}
            <Button as={Link} to="/support/new" size="sm">
              <Plus className="size-4" />
              Open a ticket
            </Button>
          </div>
        }
      />

      {data === null ? (
        <div className="space-y-3">
          {[0, 1].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-semibold text-white">You have not opened one.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
            Ban appeals, reports, bugs, store questions — anything you need a
            person to look at.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </Section>
  );
}

export function TicketRow({ ticket, showOpener = false }) {
  const type = TYPE_MAP[ticket.type];
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
          <span>{typeLabel(ticket.type)}</span>
          <span>·</span>
          <code>{ticket.id}</code>
          {showOpener && (
            <>
              <span>·</span>
              <span>{ticket.openedByName}</span>
            </>
          )}
          <span>·</span>
          <span>{formatDateTime(ticket.lastMessageAt ?? ticket.createdAt)}</span>
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
