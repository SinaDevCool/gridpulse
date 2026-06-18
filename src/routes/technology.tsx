import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ArticleRow } from "@/components/site/ArticleCard";
import { articles } from "@/lib/gridpulse-data";

export const Route = createFileRoute("/technology")({
  head: () => ({
    meta: [
      { title: "Technology — GridPulse" },
      { name: "description", content: "Deep-dives into LFP, sodium-ion, flow, and long-duration storage technologies." },
    ],
  }),
  component: () => {
    const list = articles.filter((a) => a.category === "technology" || a.category === "analysis");
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-[1100px] px-4 py-12 lg:px-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">Technology</div>
          <h1 className="mt-2 font-display text-3xl md:text-5xl font-bold tracking-tight">Technology deep-dives</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">LFP, NMC, sodium-ion, flow batteries, CAES, liquid air — chemistry, cost, and deployment.</p>
          <div className="mt-8 divide-y divide-border/50">
            {list.map((a) => <ArticleRow key={a.id} article={a} />)}
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  },
});
