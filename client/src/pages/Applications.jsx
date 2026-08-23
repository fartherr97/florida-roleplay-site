import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Section from "../components/layout/Section";
import PageHeader from "../components/layout/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { api } from "../lib/api";
import { iconFor } from "../lib/icons";
import { toneTile } from "../lib/tones";
import { applicationTypes as seedTypes } from "../data/mockData";

/** Index of every application the community is currently accepting. */
export default function Applications() {
  const [types, setTypes] = useState(seedTypes);

  useEffect(() => {
    let active = true;
    api.applicationTypes().then((data) => {
      if (active && data?.length) setTypes(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Section>
      <PageHeader
        eyebrow="Join the community"
        title="Applications"
        subtitle="Pick the application you want to submit. Whitelist first — every department application requires an approved whitelist behind it."
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((type) => {
          const Icon = iconFor(type.icon);
          const open = type.status === "Open";
          return (
            <Card
              key={type.type}
              as={open ? Link : "div"}
              to={open ? `/applications/${type.type}` : undefined}
              hover={open}
              className="group flex flex-col p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`grid size-11 place-items-center rounded-xl ring-1 ring-inset ${toneTile(type.tone)}`}
                >
                  <Icon className="size-5" />
                </span>
                <Badge tone={open ? "green" : "rose"} dot>
                  {type.status}
                </Badge>
              </div>

              <h2 className="mt-5 text-base font-bold text-white">{type.name}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
                {type.blurb}
              </p>

              <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Review · {type.estimate}
                </p>
                {open ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-400 transition-all group-hover:gap-2.5">
                    Apply
                    <ArrowRight className="size-3.5" />
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-slate-600">
                    Not accepting
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
