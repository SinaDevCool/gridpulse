import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, TrendingUp, TrendingDown, Activity, MapPin, Cpu } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { CountUp } from "@/components/site/CountUp";
import { ArticleRow, FeaturedCard } from "@/components/site/ArticleCard";
import { NewsletterForm } from "@/components/site/NewsletterForm";
import { useMemo, useState } from "react";
import { type ArticleCategory, type Project } from "@/lib/gridpulse-data";
import { articlesQuery, projectsQuery, trendingTopicsQuery, type TrendingTopic } from "@/lib/gridpulse-repo";

import { marketDataQuery, type MarketDataPoint } from "@/lib/market-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GridPulse — Grid-Scale Battery Storage News, Data & Markets" },
      { name: "description", content: "Real-time news, project tracking, and market data for grid-scale battery energy storage. Built for BESS developers, investors, utilities, EPCs, OEMs, and policymakers." },
      { property: "og:title", content: "GridPulse — Grid-Scale Battery Storage Intelligence" },
      { property: "og:description", content: "TechCrunch-style news and data for the global grid-scale battery storage industry." },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
});

const filterTabs: { label: string; value: ArticleCategory | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Breaking", value: "breaking" },
  { label: "Analysis", value: "analysis" },
  { label: "Deals", value: "deals" },
  { label: "Policy", value: "policy" },
  { label: "Technology", value: "technology" },
  { label: "Safety", value: "safety" },
  { label: "Markets", value: "markets" },
];

// Live aggregation from the project database.
function useProjectAggregates() {
  const { data: projects = [] } = useQuery(projectsQuery());
  return useMemo(() => {
    let opMw = 0;
    let opMwh = 0;
    let pipelineMw = 0;
    let pipelineMwh = 0;
    let verifiedOpMw = 0;
    let verifiedPipelineMw = 0;
    const byRegion: Record<string, number> = {};
    for (const p of projects) {
      const isOp = p.status === "Operational";
      const isDemo = p.verificationStatus === "demo";
      if (isOp) {
        opMw += p.capacityMw ?? 0;
        opMwh += p.capacityMwh ?? 0;
        if (!isDemo) verifiedOpMw += p.capacityMw ?? 0;
      } else {
        pipelineMw += p.capacityMw ?? 0;
        pipelineMwh += p.capacityMwh ?? 0;
        if (!isDemo) verifiedPipelineMw += p.capacityMw ?? 0;
      }
      const region = p.region ?? "Other";
      byRegion[region] = (byRegion[region] ?? 0) + (p.capacityMw ?? 0);
    }
    const totalRegionMw = Object.values(byRegion).reduce((a, b) => a + b, 0) || 1;
    const regions = Object.entries(byRegion)
      .map(([name, mw]) => ({ name, mw, pct: (mw / totalRegionMw) * 100 }))
      .sort((a, b) => b.mw - a.mw);
    const verifiedTotalGw = (verifiedOpMw + verifiedPipelineMw) / 1000;
    const allTotalGw = (opMw + pipelineMw) / 1000;
    return {
      projects,
      opMw,
      opMwh,
      pipelineMw,
      pipelineMwh,
      totalProjects: projects.length,
      regions,
      verifiedTotalGw,
      allTotalGw,
    };
  }, [projects]);
}


function findMetric(data: MarketDataPoint[] | undefined, symbol: string) {
  return data?.find((p) => p.symbol === symbol);
}

function HomePage() {
  const { data: articles = [] } = useQuery(articlesQuery());
  const agg = useProjectAggregates();
  const { data: market } = useQuery(marketDataQuery());
  const featured = articles.slice(0, 3);
  const [filter, setFilter] = useState<ArticleCategory | "all">("all");
  const [count, setCount] = useState(5);

  const feed = useMemo(() => {
    const rest = articles.slice(3);
    return filter === "all" ? rest : rest.filter((a) => a.category === filter);
  }, [filter, articles]);
  const shown = feed.slice(0, count);

  const lfp = findMetric(market, "LFP_CELL_USD_KWH");
  const systemCost = findMetric(market, "BESS_SYSTEM_USD_KWH_DC");

  // Live hero tiles, derived from the project database + market_data.
  const heroTiles = [
    {
      label: "Operational capacity tracked",
      value: agg.opMwh,
      decimals: 0,
      unit: "MWh",
      footnote: `${agg.totalProjects} projects in database`,
    },
    {
      label: "Pipeline capacity",
      value: agg.pipelineMw / 1000,
      decimals: 2,
      unit: "GW",
      footnote: `${agg.pipelineMw.toLocaleString()} MW announced`,
    },
    {
      label: systemCost?.label ?? "Avg system cost",
      value: systemCost?.value ?? 0,
      decimals: 0,
      unit: systemCost?.unit ?? "USD/kWh DC",
      footnote: systemCost ? `Source: ${systemCost.sourceName}` : "Awaiting market feed",
      prefix: "$",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at top, color-mix(in oklab, var(--cyan-accent) 18%, transparent), transparent 60%)" }} />
        <div className="relative mx-auto max-w-[1400px] px-4 py-14 lg:px-8 lg:py-20">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-green-accent animate-pulse" />
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Live · {articles.length} stories tracked
            </span>
          </div>
          <h1 className="mt-5 max-w-5xl font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            <span className="text-cyan-accent">
              <CountUp value={agg.verifiedTotalGw > 0 ? agg.verifiedTotalGw : agg.allTotalGw} decimals={agg.verifiedTotalGw < 10 ? 2 : 1} duration={1800} /> GW
            </span>{" "}
            of grid-scale storage tracked across our verified project database.{" "}
            <span className="text-muted-foreground">We track every megawatt.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            GridPulse is the intelligence layer for grid-scale battery energy storage — real-time
            news, a verified project database, and market data sourced from EIA, IEA, FERC, BNEF,
            and the ISO interconnection queues.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {heroTiles.map((s) => (
              <div key={s.label} className="glass-card rounded-xl p-5 hover-lift relative">
                <span
                  className="absolute right-3 top-3 rounded border border-green-accent/40 bg-green-accent/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-green-accent"
                  title="Live aggregate computed from the project and market databases"
                >
                  Live
                </span>
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{s.label}</div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-bold text-foreground">
                    {s.prefix}
                    <CountUp value={s.value} decimals={s.decimals} />
                  </span>
                  <span className="text-sm text-muted-foreground font-mono-data">{s.unit}</span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground font-mono-data">{s.footnote}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 py-12 lg:px-8">
        <div className="flex items-end justify-between gap-4 border-b border-border/60 pb-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">Front Page</div>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight md:text-3xl">What matters this morning</h2>
          </div>
          <Link to="/news" className="hidden md:inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-cyan-accent">
            View all <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((a) => <FeaturedCard key={a.id} article={a} />)}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pb-16 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
              <h2 className="font-display text-2xl font-bold tracking-tight">Latest</h2>
              <Link to="/news" className="text-xs text-muted-foreground hover:text-cyan-accent">Browse all →</Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {filterTabs.map((t) => (
                <button
                  key={t.value}
                  onClick={() => { setFilter(t.value); setCount(5); }}
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
            <div className="mt-6 divide-y divide-border/50">
              {shown.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No articles in this category yet.</div>
              ) : shown.map((a) => <ArticleRow key={a.id} article={a} />)}
            </div>
            {shown.length < feed.length && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setCount((c) => c + 5)}
                  className="rounded-md border border-border bg-surface/40 px-5 py-2 text-sm text-muted-foreground hover:border-cyan-accent/40 hover:text-foreground transition cursor-pointer"
                >
                  Load more stories
                </button>
              </div>
            )}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-32 lg:self-start">
            <MarketPulseWidget agg={agg} lfp={lfp} systemCost={systemCost} />
            <RegionMixWidget regions={agg.regions} />
            <TrendingWidget />
            <UpcomingProjectsWidget projects={agg.projects} />
            <NewsletterForm />
          </aside>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function MarketPulseWidget({
  agg,
  lfp,
  systemCost,
}: {
  agg: ReturnType<typeof useProjectAggregates>;
  lfp?: MarketDataPoint;
  systemCost?: MarketDataPoint;
}) {
  const lfpDelta = lfp?.changePct != null ? `${lfp.changePct >= 0 ? "+" : ""}${lfp.changePct.toFixed(1)}% QoQ` : undefined;
  const sysDelta = systemCost?.changePct != null ? `${systemCost.changePct >= 0 ? "+" : ""}${systemCost.changePct.toFixed(1)}% YoY` : undefined;
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-accent flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" /> Market Pulse
        </div>
        <span
          className="rounded border border-green-accent/40 bg-green-accent/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-green-accent"
          title="Live aggregates from the project database and market_data"
        >
          Live
        </span>
      </div>
      <div className="mt-4 space-y-4">
        <Metric
          label="Operational tracked"
          value={<><CountUp value={agg.opMwh} /> MWh</>}
          delta={`${agg.totalProjects} projects`}
        />
        <Metric
          label="Pipeline capacity"
          value={<><CountUp value={agg.pipelineMw / 1000} decimals={2} /> GW</>}
          delta={`${agg.pipelineMw.toLocaleString()} MW announced`}
          up
        />
        {lfp && (
          <Metric
            label={`${lfp.label} cost`}
            value={<>$<CountUp value={lfp.value} />/kWh</>}
            delta={lfpDelta}
            up={lfp.changePct != null ? lfp.changePct <= 0 : undefined}
          />
        )}
        {systemCost && (
          <Metric
            label={systemCost.label}
            value={<>$<CountUp value={systemCost.value} /> {systemCost.unit.replace(/^USD\/?/, "")}</>}
            delta={sysDelta}
            up={systemCost.changePct != null ? systemCost.changePct <= 0 : undefined}
          />
        )}
      </div>
      {(lfp || systemCost) && (
        <div className="mt-3 border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
          Cell &amp; system prices: {lfp?.sourceName ?? systemCost?.sourceName}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, delta, up }: { label: string; value: React.ReactNode; delta?: string; up?: boolean }) {
  return (
    <div className="flex items-end justify-between border-b border-border/40 pb-3 last:border-0 last:pb-0">
      <div>
        <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
        <div className="mt-1 font-display text-xl font-semibold">{value}</div>
      </div>
      {delta && (
        <span className={`flex items-center gap-1 text-xs font-mono-data ${up === undefined ? "text-muted-foreground" : up ? "text-green-accent" : "text-red-accent"}`}>
          {up === true && <TrendingUp className="h-3 w-3" />}
          {up === false && <TrendingDown className="h-3 w-3" />}
          {delta}
        </span>
      )}
    </div>
  );
}

function RegionMixWidget({ regions }: { regions: { name: string; mw: number; pct: number }[] }) {
  const top = regions.slice(0, 6);
  const maxPct = top[0]?.pct ?? 1;
  return (
    <Link to="/regions" className="block glass-card rounded-xl p-5 hover-lift cursor-pointer">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-accent">Regional Capacity Mix</div>
        <span className="rounded border border-green-accent/40 bg-green-accent/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-green-accent">
          Live
        </span>
      </div>
      {top.length === 0 ? (
        <div className="mt-4 text-xs text-muted-foreground">No region data yet.</div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {top.map((r) => (
            <div key={r.name}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground">{r.name}</span>
                <span className="font-mono-data text-muted-foreground">
                  {(r.mw / 1000).toFixed(2)} GW · {r.pct.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-accent to-green-accent"
                  style={{ width: `${(r.pct / maxPct) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
        Aggregated from {regions.reduce((a, b) => a + (b.mw > 0 ? 1 : 0), 0)} regions in the project database
      </div>
    </Link>
  );
}

function TrendingWidget() {
  const { data: topics = [], isLoading } = useQuery(trendingTopicsQuery());
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-accent">Trending Topics</div>
        <span
          className="rounded border border-green-accent/40 bg-green-accent/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-green-accent"
          title="Aggregated from article tags in the last 30 days"
        >
          Live
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {isLoading ? (
          <span className="text-xs text-muted-foreground">Loading…</span>
        ) : topics.length === 0 ? (
          <span className="text-xs text-muted-foreground">No tagged stories yet.</span>
        ) : (
          topics.map((t: TrendingTopic) => (
            <Link
              key={t.tag}
              to="/news"
              search={{ q: t.tag }}
              className="tag-chip hover:border-cyan-accent/50 hover:text-cyan-accent transition-colors cursor-pointer"
              style={{ fontSize: `${10 + t.weight}px` }}
              title={`${t.count} article${t.count === 1 ? "" : "s"} in last 30 days`}
            >
              #{t.tag}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}


function UpcomingProjectsWidget({ projects }: { projects: Project[] }) {
  const upcoming = projects.filter((p) => p.status !== "Operational").slice(0, 5);
  const statusColor: Record<string, string> = {
    Permitting: "bg-amber-accent/15 text-amber-accent border-amber-accent/40",
    Construction: "bg-cyan-accent/15 text-cyan-accent border-cyan-accent/40",
    Commissioning: "bg-green-accent/15 text-green-accent border-green-accent/40",
    Operational: "bg-green-accent/15 text-green-accent border-green-accent/40",
  };
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-accent flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5" /> Upcoming Projects
        </div>
        <Link to="/projects" className="text-[11px] text-muted-foreground hover:text-cyan-accent">All →</Link>
      </div>
      <ul className="mt-4 space-y-3.5">
        {upcoming.map((p) => (
          <li key={p.id} className="border-b border-border/40 pb-3 last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-2">
              <Link to="/projects/$slug" params={{ slug: p.slug ?? p.id }} className="text-sm font-medium text-foreground hover:text-cyan-accent">
                {p.name}
              </Link>
              <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider ${statusColor[p.status]}`}>
                {p.status.toUpperCase()}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground font-mono-data">
              <span>{p.capacityMw} MW / {p.capacityMwh} MWh</span>
              <span>·</span>
              <span>{p.technology}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {p.location} · COD {p.cod}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
