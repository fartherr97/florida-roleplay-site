import { useEffect, useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import Section from "../components/layout/Section";
import PageHeader from "../components/layout/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { api } from "../lib/api";
import { SITE, storeTiers as seedTiers } from "../data/mockData";
import { cn } from "../lib/cn";

/** Supporter tiers, priced and linked out to the external Tebex store. */
export default function Store() {
  const [tiers, setTiers] = useState(seedTiers);

  useEffect(() => {
    let active = true;
    api.storeTiers().then((data) => {
      if (active && data?.length) setTiers(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Section>
      <PageHeader
        eyebrow="Support the server"
        title="Store"
        subtitle="Supporter tiers cover our hosting and asset licensing. Everything they unlock is quality-of-life — nothing affects in-character balance."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {tiers.map((tier) => (
          <Card
            key={tier.id}
            hover
            className={cn(
              "flex flex-col p-6",
              tier.popular && "ring-1 ring-inset ring-primary-400/40",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-white">{tier.name}</h2>
              {tier.popular && <Badge tone="primary">Most Popular</Badge>}
            </div>

            <p className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold tracking-tight text-white">
                {tier.price}
              </span>
              <span className="text-sm text-slate-500">{tier.period}</span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{tier.blurb}</p>

            <ul className="mt-6 flex-1 space-y-3">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary-400" />
                  <span className="text-sm text-slate-300">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              as="a"
              href={SITE.storeUrl}
              target="_blank"
              rel="noreferrer noopener"
              variant={tier.popular ? "primary" : "secondary"}
              block
              className="mt-7"
            >
              Get {tier.name}
              <ExternalLink className="size-4" />
            </Button>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-slate-500">
        Payments are handled by Tebex. Subscriptions can be cancelled at any time
        and perks stay active until the end of the paid period.
      </p>
    </Section>
  );
}
