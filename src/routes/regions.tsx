import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { marketRegions, projects, articles } from "@/lib/gridpulse-data";

export const Route = createFileRoute("/regions")({
  head: () => ({
    meta: [
      { title: "Regions — GridPulse" },
      { name: "description", content: "Browse grid-scale battery storage activity by world region." },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 py-12 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">Regions</div>
        <h1 className="mt-2 font-display text-3xl md:text-5xl font-bold tracking-tight">Storage by region</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {marketRegions.map((r) => {
            const pCount = projects.filter((p) => p.region === r.name).length;
            const aCount = articles.filter((a) => a.region === r.name).length;
            return (
              <div key={r.name} className="glass-card rounded-xl p-6">
                <h2 className="font-display text-xl font-bold">{r.name}</h2>
                <div className="mt-2 text-sm text-muted-foreground">{r.gw} GW operational · {pCount} projects · {aCount} recent stories</div>
                <div className="mt-4 flex gap-3 text-sm">
                  <Link to="/projects" className="text-cyan-accent hover:underline">Projects →</Link>
                  <Link to="/news" className="text-cyan-accent hover:underline">News →</Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </div>
  ),
});
