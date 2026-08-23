import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import Section from "../components/layout/Section";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import SearchHero from "../components/ui/SearchHero";
import { api } from "../lib/api";
import { knowledgeBase as seedArticles } from "../data/mockData";
import { formatDate } from "../lib/format";

/** Searchable article index, grouped by category. */
export default function KnowledgeBase() {
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState(seedArticles);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api.knowledgeBase(query).then((data) => {
        if (active && data) setArticles(data);
      });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const categories = useMemo(() => {
    const map = new Map();
    articles.forEach((article) => {
      if (!map.has(article.category)) map.set(article.category, []);
      map.get(article.category).push(article);
    });
    return [...map.entries()];
  }, [articles]);

  return (
    <Section>
      <SearchHero
        title="Knowledge Base"
        subtitle="Guides for getting started, applying, troubleshooting and everything in between."
        value={query}
        onChange={setQuery}
        placeholder="Search articles — try 'crash' or 'radio'"
      />

      {articles.length === 0 ? (
        <Card className="mt-6 p-8 text-center">
          <p className="text-sm text-slate-400">
            No articles match “{query}”. Try a broader term, or ask in Discord.
          </p>
        </Card>
      ) : (
        <div className="mt-8 space-y-10">
          {categories.map(([category, items]) => (
            <div key={category}>
              <div className="mb-5 flex items-center gap-3">
                <Badge tone="brand">{category}</Badge>
                <span className="h-px flex-1 bg-white/[0.06]" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((article) => (
                  <Card
                    key={article.slug}
                    as={Link}
                    to={`/knowledge-base/${article.slug}`}
                    hover
                    className="group flex flex-col p-5"
                  >
                    <span className="grid size-9 place-items-center rounded-xl bg-primary-500/15 text-primary-400 ring-1 ring-inset ring-primary-400/20">
                      <BookOpen className="size-4" />
                    </span>
                    <h2 className="mt-4 text-sm font-bold text-white">
                      {article.title}
                    </h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
                      {article.summary}
                    </p>
                    <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                        {article.readingTime} read
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
      )}

      <p className="mt-8 text-center text-xs text-slate-500">
        Articles are kept current by the staff team. Last review{" "}
        {formatDate(articles[0]?.updatedAt)}.
      </p>
    </Section>
  );
}
