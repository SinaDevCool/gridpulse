import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { marketRegions, projects } from "@/lib/gridpulse-data";

export const Route = createFileRoute("/markets")({
  head: () => ({
    meta: [
      { title: "Markets — GridPulse" },
      { name: "description", content: "Regional market analysis for grid-scale battery storage: capacity, growth, and key projects by region." },
    ],
  }),
  component: MarketsPage,
});

function MarketsPage() {
  const regions = marketRegions.map((r) => ({
    ...r,
    projectCount: projects.filter((p) => p.region === r.name || (r.name === "APAC ex-China" && p.region === "APAC" && p.country !== "China")).length,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 py-12 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">Markets</div>
        <h1 className="mt-2 font-display text-3xl md:text-5xl font-bold tracking-tight">Regional market intelligence</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Capacity, growth, and pipeline depth for the world's major grid-scale storage markets.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {regions.map((r) => (
            <div key={r.name} className="glass-card rounded-xl p-6 hover-lift">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl font-bold">{r.name}</h2>
                <span className="font-mono-data text-sm text-cyan-accent">{r.gw} GW</span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{r.pct}% of global capacity · {r.projectCount} tracked projects</div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-elevated">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-accent to-green-accent" style={{ width: `${r.pct * 2.4}%` }} />
              </div>
              <Link to="/projects" className="mt-5 inline-block text-xs text-cyan-accent hover:underline">View projects →</Link>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
