import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ArticleRow } from "@/components/site/ArticleCard";
import { articlesQuery } from "@/lib/gridpulse-repo";

export const Route = createFileRoute("/technology")({
  head: () => ({
    meta: [
      { title: "Technology — GridPulse" },
      { name: "description", content: "Deep-dives into LFP, sodium-ion, flow, and long-duration storage technologies." },
    ],
  }),
  component: TechnologyPage,
});

function TechnologyPage() {
  const { data: articles = [], isLoading, isError, error } = useQuery(articlesQuery());
  const list = articles.filter((a) => a.category === "technology" || a.category === "analysis");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 py-12 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">Technology</div>
        <h1 className="mt-2 font-display text-3xl md:text-5xl font-bold tracking-tight">Technology deep-dives</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">LFP, NMC, sodium-ion, flow batteries, CAES, liquid air — sourced live from the GridPulse news pipeline.</p>
        <div className="mt-8 divide-y divide-border/50">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading…</div>
          ) : isError ? (
            <div className="py-12 text-center text-destructive-foreground">Couldn't load technology stories: {(error as Error)?.message}</div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No technology stories yet. <Link to="/news" className="text-cyan-accent">Browse all news →</Link>
            </div>
          ) : (
            list.map((a) => <ArticleRow key={a.id} article={a} />)
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
