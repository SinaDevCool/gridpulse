import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { projectsQuery, articlesQuery } from "@/lib/gridpulse-repo";
import { isLiveProject } from "@/lib/gridpulse-data";
import { euRegionOf, isEuropeanProject, EU_REGIONS, mergeWithFallback, type EuRegion } from "@/lib/eu-regions";
import { TSO_ZONES, tsoZoneOf, nodeClassLabel, nodeClassStyles, sitingScore } from "@/lib/tso-zones";
import { Activity, Zap } from "lucide-react";


function RegionsPage() {
  const { data: allProjects = [], isLoading: pLoading } = useQuery(projectsQuery());
  const projects = useMemo(
    () => mergeWithFallback(allProjects.filter((p) => isLiveProject(p) && isEuropeanProject(p))),
    [allProjects],
  );
  const { data: articles = [] } = useQuery(articlesQuery());
  const [headroomOn, setHeadroomOn] = useState(false);

  // TSO zone rollup — memoized on projects only so toggling the overlay
  // never re-crunches the dataset.
  const tsoRollup = useMemo(() => {
    const map = new Map<string, { mw: number; count: number }>();
    for (const p of projects) {
      const z = tsoZoneOf(p);
      if (!z) continue;
      const cur = map.get(z.code) ?? { mw: 0, count: 0 };
      cur.mw += p.capacityMw ?? 0;
      cur.count += 1;
      map.set(z.code, cur);
    }
    return TSO_ZONES.map((z) => ({
      zone: z,
      assignedMw: map.get(z.code)?.mw ?? 0,
      assignedProjects: map.get(z.code)?.count ?? 0,
      score: sitingScore(z),
    })).sort((a, b) => b.score - a.score);
  }, [projects]);


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

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-surface/40 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Map overlay</span>
          <button
            type="button"
            onClick={() => setHeadroomOn((v) => !v)}
            aria-pressed={headroomOn}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
              headroomOn
                ? "border-cyan-accent/60 bg-cyan-accent/10 text-cyan-accent"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            <Activity className="h-3 w-3" /> Grid Connection Headroom & Capacity Availability
          </button>
          <span className="ml-auto text-[10px] font-mono-data text-muted-foreground">
            Feeds: ENTSO-E Core Transparency · Bundesnetzagentur SMARD
          </span>
        </div>

        {headroomOn && (
          <section className="mt-4 rounded-xl border border-border/60 bg-surface/40 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-cyan-accent" />
                  Substation Congestion Zones — European TSOs
                </h2>
                <p className="text-xs text-muted-foreground">
                  Every tracked project is attributed to its governing Transmission System Operator. Nodes are flagged by 12-month redispatch exposure and HV connection headroom.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono-data">
                <span className="inline-flex items-center gap-1 rounded border border-red-accent/50 bg-red-accent/10 px-1.5 py-0.5 text-red-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-accent" /> Congested
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-amber-accent/50 bg-amber-accent/10 px-1.5 py-0.5 text-amber-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-accent" /> Balanced
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-green-accent/50 bg-green-accent/10 px-1.5 py-0.5 text-green-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-accent" /> Fast-Track
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {tsoRollup.map(({ zone, assignedMw, assignedProjects, score }) => {
                const styles = nodeClassStyles(zone.nodeClass);
                return (
                  <div key={zone.code} className="rounded-lg border border-border/60 bg-background/40 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
                          <h3 className="font-display text-sm font-bold truncate">{zone.name}</h3>
                          <span className="text-[10px] font-mono-data text-muted-foreground">{zone.country}</span>
                        </div>
                        <div className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${styles.chip}`}>
                          {nodeClassLabel(zone.nodeClass)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Siting</div>
                        <div className="font-display text-lg font-bold text-cyan-accent">{score}</div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-mono-data">
                      <MetricCell label="Headroom" value={`${zone.headroomMw.toLocaleString()} MW`} />
                      <MetricCell label="Redispatch" value={`${zone.redispatchRiskPct}%`} />
                      <MetricCell label="Time-to-Energize" value={`${zone.timeToEnergizeMonths} mo`} />
                    </div>
                    <div className="mt-3 border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                      {assignedProjects} tracked project{assignedProjects === 1 ? "" : "s"} · {assignedMw.toLocaleString()} MW attributed
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}


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
