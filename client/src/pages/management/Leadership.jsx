import { Crown } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { staff } from "../../data/mockData";

/** Leadership overview. Gated behind the management role by RequireRole. */
export default function Leadership() {
  const leadership = staff.filter((member) => member.group === "Management");

  return (
    <Section>
      <PageHeader
        eyebrow="Management"
        title="Leadership"
        subtitle="Ownership, community management and development direction for the server."
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {leadership.map((member) => (
          <Card key={member.id} hover className="p-6">
            <span className="grid size-11 place-items-center rounded-xl bg-rose-500/15 text-rose-400 ring-1 ring-inset ring-rose-400/20">
              <Crown className="size-5" />
            </span>
            <h2 className="mt-5 text-base font-bold text-white">{member.name}</h2>
            <p className="mt-1 text-xs text-slate-500">@{member.handle}</p>
            <div className="mt-4">
              <Badge tone="rose">{member.role}</Badge>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-6">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Standing decisions
        </h2>
        <ul className="mt-5 space-y-3">
          {[
            "Whitelist review SLA stays at 48 hours through the season.",
            "DHS recruitment remains invitation-only until the task force script ships.",
            "Store perks are quality-of-life only — no pay-to-win proposals are considered.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-rose-500" />
              <span className="text-sm leading-relaxed text-slate-400">{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}
