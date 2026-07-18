import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ArticleRow } from "@/components/site/ArticleCard";
import { articlesQuery } from "@/lib/gridpulse-repo";

export const Route = createFileRoute("/policy")({
  head: () => ({
    meta: [
      { title: "Policy Tracker — GridPulse" },
      { name: "description", content: "Real-time tracking of FERC, EU, UK, and global energy storage policy: orders, rule-makings, and incentives." },
    ],
  }),
  component: PolicyPage,
});

function PolicyPage() {
  const { data: articles = [], isLoading, isError, error } = useQuery(articlesQuery());
  const list = articles.filter((a) => a.category === "policy");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 py-12 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">Policy Tracker</div>
        <h1 className="mt-2 font-display text-3xl md:text-5xl font-bold tracking-tight">Storage policy & regulation</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">FERC orders, EU directives, ISO market reforms, and incentive programs — sourced live from the GridPulse news pipeline.</p>
        <div className="mt-8 divide-y divide-border/50">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading…</div>
          ) : isError ? (
            <div className="py-12 text-center text-destructive-foreground">Couldn't load policy stories: {(error as Error)?.message}</div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No policy stories yet. <Link to="/news" className="text-cyan-accent">Browse all news →</Link>
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
