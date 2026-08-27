import { createElement, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, Search } from "lucide-react";
import Section from "../../components/layout/Section";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import AccessDenied from "../../components/auth/AccessDenied";
import { useAuth } from "../../context/useAuth";
import { iconFor } from "../../lib/icons";
import { ARTICLES } from "../../data/devHubData";

/** Help Center — search the common answers, or open a request. */
export default function DevHelp() {
  const { user, loading } = useAuth();
  const [query, setQuery] = useState("");

  const articles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ARTICLES;
    return ARTICLES.filter((a) => `${a.title} ${a.excerpt}`.toLowerCase().includes(needle));
  }, [query]);

  if (loading) return null;
  if (!user) return <AccessDenied reason="signed-out" />;

  return (
    <Section className="max-w-4xl">
      <PageHeader
        eyebrow="Development"
        title="Help Center"
        subtitle="Common answers for vehicles, liveries and requests. Can't find it? Open a request."
        actions={
          <Button as={Link} to="/development/new" size="sm">
            <Plus className="size-4" />
            Create request
          </Button>
        }
      />

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the help center…"
          aria-label="Search help"
          className="h-12 w-full rounded-2xl bg-black/30 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 ring-1 ring-inset ring-white/10 transition focus:outline-none focus:ring-2 focus:ring-brand-500/70"
        />
      </div>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">Popular articles</h2>
      {articles.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-slate-400">Nothing matches that. Try opening a request instead.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {articles.map((article) => (
            <Card key={article.id} className="flex gap-3 p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-300 ring-1 ring-inset ring-violet-400/20">
                {createElement(iconFor(article.icon, Search), { className: "size-5" })}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{article.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{article.excerpt}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-8 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-sm font-bold text-white">Still stuck?</p>
          <p className="mt-1 text-sm text-slate-400">Open a request and the dev team will pick it up.</p>
        </div>
        <Button as={Link} to="/development/new">
          Create request
          <ArrowRight className="size-4" />
        </Button>
      </Card>
    </Section>
  );
}
