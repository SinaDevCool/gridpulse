import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { projectsQuery, articlesQuery } from "@/lib/gridpulse-repo";
import { isLiveProject } from "@/lib/gridpulse-data";
import { euRegionOf, isEuropeanProject, EU_REGIONS, mergeWithFallback, type EuRegion } from "@/lib/eu-regions";

function RegionsPage() {
  const { data: allProjects = [], isLoading: pLoading } = useQuery(projectsQuery());
  const projects = useMemo(
    () => mergeWithFallback(allProjects.filter((p) => isLiveProject(p) && isEuropeanProject(p))),
    [allProjects],
  );
  const { data: articles = [] } = useQuery(articlesQuery());

  const regions = useMemo(() => {
    const zero = () => ({ mw: 0, mwh: 0, projects: 0, stories: 0, operational: 0, pipeline: 0 });
    const map = new Map<EuRegion, ReturnType<typeof zero>>(
      EU_REGIONS.map((r) => [r, zero()] as const),
    );
    for (const p of projects) {
      const region = euRegionOf(p);
      const cur = map.get(region)!;
      cur.mw += p.capacityMw ?? 0;
      cur.mwh += p.capacityMwh ?? 0;
      cur.projects += 1;
      if (p.status === "Operational") cur.operational += p.capacityMw ?? 0;
      else cur.pipeline += p.capacityMw ?? 0;
    }
    // Article region strings roll up into the global 4-tier taxonomy.
    for (const a of articles) {
      const raw = (a.region ?? "").toLowerCase();
      if (!raw) continue;
      let bucket: EuRegion | null = null;
      if (/(united states|usa|canada|north america|us\b|ca\b|mexico)/.test(raw)) bucket = "North America (US/CA)";
      else if (/(german|united kingdom|england|europe|eu\b|emea|uk\b|gb\b|france|spain|italy|nordic)/.test(raw)) bucket = "Europe & UK (EU/UK)";
      else if (/(australia|japan|korea|china|asia|pacific|apac|india|singapore)/.test(raw)) bucket = "Asia-Pacific (APAC)";
      else if (/(brazil|argentina|chile|latam|latin america|colombia)/.test(raw)) bucket = "Latin America (LATAM)";
      if (bucket) map.get(bucket)!.stories += 1;
    }
    return EU_REGIONS.map((name) => ({ name, ...map.get(name)! }));
  }, [projects, articles]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 py-12 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">Regions</div>
        <h1 className="mt-2 font-display text-3xl md:text-5xl font-bold tracking-tight">Storage by region</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Capacity totals, project counts, and story counts are aggregated live from the GridPulse project and news databases.
        </p>

        {pLoading ? (
          <div className="mt-10 py-10 text-center text-sm text-muted-foreground">Loading regional aggregates…</div>
        ) : regions.length === 0 ? (
          <div className="mt-10 py-10 text-center text-sm text-muted-foreground">
            No regional data available yet. Once projects are ingested they will appear here.
          </div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {regions.map((r) => (
              <div key={r.name} className="glass-card rounded-xl p-6">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-xl font-bold">{r.name}</h2>
                  <span
                    className="rounded border border-green-accent/40 bg-green-accent/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-green-accent"
                    title="Live aggregate from the project database"
                  >
                    {(r.mw / 1000).toFixed(2)} GW · Live
                  </span>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  <span className="text-foreground font-mono-data">{r.projects}</span> tracked projects
                  {" · "}
                  <span className="text-foreground font-mono-data">{r.stories}</span> recent stories
                </div>
                <div className="mt-2 text-[11px] font-mono-data text-muted-foreground">
                  Operational <span className="text-foreground">{r.operational.toLocaleString()} MW</span>
                  {" · "}
                  Pipeline <span className="text-foreground">{r.pipeline.toLocaleString()} MW</span>
                  {r.mwh > 0 && <> · <span className="text-foreground">{r.mwh.toLocaleString()} MWh</span></>}
                </div>
                <div className="mt-4 flex gap-3 text-sm">
                  <Link to="/projects" search={{ region: r.name } as never} className="text-cyan-accent hover:underline">Projects →</Link>
                  <Link to="/news" className="text-cyan-accent hover:underline">News →</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export const Route = createFileRoute("/regions")({
  head: () => ({
    meta: [
      { title: "Regions — GridPulse" },
      { name: "description", content: "Browse grid-scale battery storage activity by world region — live aggregates from the GridPulse database." },
    ],
  }),
  component: RegionsPage,
});
