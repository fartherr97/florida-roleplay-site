import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Link2 } from "lucide-react";
import Section from "../components/layout/Section";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import SearchHero from "../components/ui/SearchHero";
import { api } from "../lib/api";
import { rules as seedRules } from "../data/mockData";
import { cn } from "../lib/cn";

/**
 * Searchable, categorised rulebook. Each category collapses, and every rule is
 * deep-linkable by anchor so staff can point at a specific clause.
 */
export default function Rules() {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState(seedRules);
  const [openIds, setOpenIds] = useState(() => seedRules.map((g) => g.id));
  const location = useLocation();

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api.rules(query).then((data) => {
        if (!active || !data) return;
        setGroups(data);
        // A search should reveal its matches rather than hide them behind a collapse.
        if (query.trim()) setOpenIds(data.map((g) => g.id));
      });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  // Open (and scroll to) the category holding a linked rule anchor.
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const group = groups.find((g) => g.items.some((item) => item.id === id));
    const timer = setTimeout(() => {
      if (group) {
        setOpenIds((prev) =>
          prev.includes(group.id) ? prev : [...prev, group.id],
        );
      }
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 220);
    return () => clearTimeout(timer);
  }, [location.hash, groups]);

  const total = useMemo(
    () => groups.reduce((sum, group) => sum + group.items.length, 0),
    [groups],
  );

  const toggle = (id) =>
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );

  return (
    <Section>
      <SearchHero
        title="Server Rules"
        subtitle="Everything below is enforced. Read it once properly and the rest of your time here will go a lot more smoothly."
        value={query}
        onChange={setQuery}
        placeholder="Search rules — try 'pursuit' or 'metagaming'"
      >
        <p className="mt-4 text-xs text-slate-500">
          {total} rule{total === 1 ? "" : "s"} across {groups.length} categor
          {groups.length === 1 ? "y" : "ies"}
        </p>
      </SearchHero>

      {groups.length === 0 ? (
        <Card className="mt-6 p-8 text-center">
          <p className="text-sm text-slate-400">
            No rules match “{query}”. Try a broader term.
          </p>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {groups.map((group) => {
            const isOpen = openIds.includes(group.id);
            return (
              <Card key={group.id} className="overflow-hidden">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggle(group.id)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-white/[0.02]"
                >
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-white">{group.category}</h2>
                    <p className="mt-1 text-sm text-slate-400">{group.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge tone="slate">{group.items.length}</Badge>
                    <ChevronDown
                      className={cn(
                        "size-4 text-slate-400 transition-transform duration-200",
                        isOpen && "rotate-180",
                      )}
                    />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <ul className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
                        {group.items.map((item) => (
                          <li
                            key={item.id}
                            id={item.id}
                            className="group scroll-mt-24 px-5 py-4 target:bg-primary-500/[0.06]"
                          >
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 shrink-0 rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] font-bold text-primary-400 ring-1 ring-inset ring-white/10">
                                {item.number}
                              </span>
                              <div className="min-w-0">
                                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                                  {item.title}
                                  <a
                                    href={`#${item.id}`}
                                    aria-label={`Link to rule ${item.number}`}
                                    className="text-slate-600 opacity-0 transition hover:text-primary-400 group-hover:opacity-100"
                                  >
                                    <Link2 className="size-3.5" />
                                  </a>
                                </h3>
                                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                                  {item.body}
                                </p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      )}
    </Section>
  );
}
