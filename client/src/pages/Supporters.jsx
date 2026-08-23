import { useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import Section from "../components/layout/Section";
import PageHeader from "../components/layout/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { supporters as seedSupporters } from "../data/mockData";
import { formatDate } from "../lib/format";

const TIER_ORDER = ["Gold", "Silver", "Bronze"];
const TIER_TONES = { Gold: "primary", Silver: "slate", Bronze: "amber" };

/** Wall of supporters, grouped by tier with tier-coloured badges. */
export default function Supporters() {
  const [supporters, setSupporters] = useState(seedSupporters);

  useEffect(() => {
    let active = true;
    api.supporters().then((data) => {
      if (active && data?.length) setSupporters(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(
    () =>
      TIER_ORDER.map((tier) => ({
        tier,
        members: supporters.filter((s) => s.tier === tier),
      })).filter((group) => group.members.length > 0),
    [supporters],
  );

  return (
    <Section>
      <PageHeader
        eyebrow="Thank you"
        title="Supporters"
        subtitle="These members keep the server online. Every tier below funds hosting, asset licensing and development time."
        actions={
          <Button as={Link} to="/store" size="sm">
            <Heart className="size-4" />
            Become a supporter
          </Button>
        }
      />

      <div className="space-y-10">
        {grouped.map((group) => (
          <div key={group.tier}>
            <div className="mb-5 flex items-center gap-3">
              <Badge tone={TIER_TONES[group.tier] ?? "slate"} dot>
                {group.tier}
              </Badge>
              <span className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                {group.members.length} supporter
                {group.members.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {group.members.map((member) => (
                <Card key={member.id} hover className="p-5">
                  <p className="text-sm font-bold text-white">{member.name}</p>
                  <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    Since {formatDate(member.since)}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
