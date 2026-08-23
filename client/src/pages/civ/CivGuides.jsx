import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { api } from "../../lib/api";
import { guides as seedGuides } from "../../data/civilianHubData";

/**
 * Civilian guides. Each one opens the matching knowledge base article, so there
 * is a single copy of the writing rather than two that drift.
 */
export default function CivGuides() {
  const [guides, setGuides] = useState(seedGuides);

  useEffect(() => {
    let active = true;
    api.civGuides().then((next) => {
      if (active && next?.length) setGuides(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const byCategory = useMemo(() => {
    const map = new Map();
    guides.forEach((guide) => {
      if (!map.has(guide.category)) map.set(guide.category, []);
      map.get(guide.category).push(guide);
    });
    return [...map.entries()];
  }, [guides]);

  return (
    <>
      <HubPageHeader
        icon="BookOpen"
        eyebrow="Civilian Hub"
        title="Civilian Guides"
        subtitle="How the civilian side of the server works — vehicles, property, work and the law."
        actions={
          <Badge tone="brand" as={Link} to="/knowledge-base">
            Full knowledge base
          </Badge>
        }
      />

      <div className="space-y-10">
        {byCategory.map(([category, items]) => (
          <div key={category}>
            <div className="mb-5 flex items-center gap-3">
              <Badge tone="primary">{category}</Badge>
              <span className="h-px flex-1 bg-white/[0.06]" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((guide) => (
                <Card
                  key={guide.slug}
                  as={Link}
                  to={`/knowledge-base/${guide.slug}`}
                  hover
                  className="group flex flex-col p-5"
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-primary-500/15 text-primary-400 ring-1 ring-inset ring-primary-400/20">
                    <BookOpen className="size-4" />
                  </span>
                  <h2 className="mt-4 text-sm font-bold text-white">{guide.title}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
                    {guide.summary}
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      {guide.readingTime} read
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-400 transition-all group-hover:gap-2.5">
                      Read
                      <ArrowRight className="size-3.5" />
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
