import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ArticleRow } from "@/components/site/ArticleCard";
import { type ArticleCategory } from "@/lib/gridpulse-data";
import { articlesQuery } from "@/lib/gridpulse-repo";

const searchSchema = z.object({
  q: z.string().optional(),
  cat: z.string().optional(),
});

export const Route = createFileRoute("/news")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "News — GridPulse" },
      { name: "description", content: "Real-time grid-scale battery storage news: deals, policy, technology, markets, and safety." },
    ],
  }),
  component: NewsPage,
});

const tabs: { label: string; value: ArticleCategory | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Breaking", value: "breaking" },
  { label: "Analysis", value: "analysis" },
  { label: "Deals", value: "deals" },
  { label: "Policy", value: "policy" },
  { label: "Technology", value: "technology" },
  { label: "Safety", value: "safety" },
  { label: "Markets", value: "markets" },
];

function NewsPage() {
  const { q: initialQ } = Route.useSearch();
  const [query, setQuery] = useState(initialQ ?? "");
  const [filter, setFilter] = useState<ArticleCategory | "all">("all");
  const [count, setCount] = useState(10);
  const { data: articles = [], isLoading } = useQuery(articlesQuery());

  const list = useMemo(() => {
    const ql = query.trim().toLowerCase();
    return articles.filter((a) => {
      if (filter !== "all" && a.category !== filter) return false;
      if (ql && !(a.headline + " " + a.summary + " " + a.tags.join(" ")).toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [query, filter, articles]);
  const shown = list.slice(0, count);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 py-12 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">News</div>
        <h1 className="mt-2 font-display text-3xl md:text-5xl font-bold tracking-tight">All stories</h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
          The full feed of grid-scale battery storage stories tracked by GridPulse. Filter by topic or search by company, project, or technology.
        </p>

        <div className="mt-6 flex items-center gap-3 rounded-md border border-border bg-surface/60 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCount(10); }}
            placeholder="Search headline, summary, or tag…"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
          />
          {query && <button onClick={() => setQuery("")} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => { setFilter(t.value); setCount(10); }}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                filter === t.value
                  ? "border-cyan-accent/50 bg-cyan-accent/10 text-cyan-accent"
                  : "border-border bg-surface/40 text-muted-foreground hover:text-foreground hover:border-border/80"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-8 divide-y divide-border/50">
          {shown.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-sm text-muted-foreground">No stories found. Try a different filter.</div>
              <Link to="/news" className="mt-3 inline-block text-cyan-accent text-sm">Reset filters</Link>
            </div>
          ) : shown.map((a) => <ArticleRow key={a.id} article={a} />)}
        </div>

        {shown.length < list.length && (
          <div className="mt-8 flex justify-center">
            <button onClick={() => setCount((c) => c + 10)} className="rounded-md border border-border bg-surface/40 px-5 py-2 text-sm hover:border-cyan-accent/40 cursor-pointer">
              Load more
            </button>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
