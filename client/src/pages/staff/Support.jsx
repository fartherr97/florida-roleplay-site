import { LifeBuoy } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";

/** Support ticket queue. Gated behind the staff role by RequireRole. */
const TICKETS = [
  { id: "TKT-8841", subject: "Perks missing after Gold purchase", status: "Open", tone: "green", waiting: "6m" },
  { id: "TKT-8839", subject: "Cannot connect — cache error", status: "Open", tone: "green", waiting: "22m" },
  { id: "TKT-8830", subject: "Character slot not applied", status: "Waiting", tone: "amber", waiting: "3h" },
  { id: "TKT-8822", subject: "Name change request", status: "Waiting", tone: "amber", waiting: "1d" },
];

export default function Support() {
  return (
    <Section>
      <PageHeader
        eyebrow="Staff tools"
        title="Support Queue"
        subtitle="Member tickets, oldest waiting first. Store issues take priority — they involve real money."
      />

      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-500/15 text-brand-400 ring-1 ring-inset ring-brand-400/20">
            <LifeBuoy className="size-4" />
          </span>
          <h2 className="text-sm font-bold text-white">Active tickets</h2>
          <Badge tone="brand" className="ml-auto">
            {TICKETS.length} active
          </Badge>
        </div>

        <ul className="divide-y divide-white/[0.06]">
          {TICKETS.map((ticket) => (
            <li key={ticket.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <code className="rounded-lg bg-black/30 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-inset ring-white/10">
                {ticket.id}
              </code>
              <p className="min-w-0 flex-1 truncate text-sm text-slate-300">
                {ticket.subject}
              </p>
              <Badge tone={ticket.tone} dot>
                {ticket.status}
              </Badge>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {ticket.waiting}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="mt-6 text-xs text-slate-500">
        {/* TODO: replace this static queue with a live GET /api/staff/tickets feed. */}
        Showing seed data — the live ticket feed lands with the staff API.
      </p>
    </Section>
  );
}
