import { Gavel } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";

/** Moderation queue. Gated behind the moderator role by RequireRole. */
const QUEUE = [
  { id: "RPT-2026-40218", type: "Player report", subject: "RDM on Bayshore", age: "12m", tone: "rose" },
  { id: "RPT-2026-40216", type: "Ban appeal", subject: "Appeal — exploiting", age: "1h", tone: "amber" },
  { id: "RPT-2026-40211", type: "Staff complaint", subject: "Scene handling dispute", age: "4h", tone: "brand" },
  { id: "RPT-2026-40204", type: "Bug report", subject: "Evidence locker duplication", age: "1d", tone: "slate" },
];

export default function Moderation() {
  return (
    <Section>
      <PageHeader
        eyebrow="Staff tools"
        title="Moderation"
        subtitle="Open reports awaiting a decision. Claim one before you start working it."
      />

      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          <span className="grid size-9 place-items-center rounded-xl bg-primary-500/15 text-primary-400 ring-1 ring-inset ring-primary-400/20">
            <Gavel className="size-4" />
          </span>
          <h2 className="text-sm font-bold text-white">Open queue</h2>
          <Badge tone="amber" className="ml-auto">
            {QUEUE.length} waiting
          </Badge>
        </div>

        <ul className="divide-y divide-white/[0.06]">
          {QUEUE.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <code className="rounded-lg bg-black/30 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-inset ring-white/10">
                {item.id}
              </code>
              <Badge tone={item.tone}>{item.type}</Badge>
              <p className="min-w-0 flex-1 truncate text-sm text-slate-300">
                {item.subject}
              </p>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {item.age} old
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="mt-6 text-xs text-slate-500">
        {/* TODO: replace this static queue with a live GET /api/staff/reports feed. */}
        Showing seed data — the live moderation feed lands with the staff API.
      </p>
    </Section>
  );
}
