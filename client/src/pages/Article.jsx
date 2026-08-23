import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Section from "../components/layout/Section";
import PageHeader from "../components/layout/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import NotFound from "../components/auth/NotFound";
import { api } from "../lib/api";
import { knowledgeBase as seedArticles } from "../data/mockData";
import { formatDate } from "../lib/format";

/** Article reader for a single knowledge base entry. */
export default function Article() {
  const { slug } = useParams();
  // Seed renders immediately; the fetched record is stamped with its slug so a
  // response for a previous article never lands on the current one.
  const [fetched, setFetched] = useState(null);

  useEffect(() => {
    let active = true;
    api.article(slug).then((data) => {
      if (active) setFetched({ slug, data: data ?? null });
    });
    return () => {
      active = false;
    };
  }, [slug]);

  const seed = seedArticles.find((a) => a.slug === slug) ?? null;
  const settled = fetched?.slug === slug;
  const article = settled ? (fetched.data ?? seed) : seed;

  if (!article) {
    if (!settled) {
      return (
        <Section>
          <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
        </Section>
      );
    }
    return <NotFound />;
  }

  return (
    <Section>
      <PageHeader
        eyebrow={article.category}
        title={article.title}
        subtitle={article.summary}
        backTo="/knowledge-base"
        backLabel="Knowledge base"
        actions={<Badge tone="brand">{article.readingTime} read</Badge>}
      />

      <Card className="p-6 sm:p-8">
        <div className="space-y-5">
          {article.body.map((paragraph, index) => (
            <p
              key={`${article.slug}-p${index}`}
              className="text-[15px] leading-relaxed text-slate-300"
            >
              {paragraph}
            </p>
          ))}
        </div>
        <p className="mt-8 border-t border-white/[0.06] pt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
          Last updated {formatDate(article.updatedAt)}
        </p>
      </Card>
    </Section>
  );
}
