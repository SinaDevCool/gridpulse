import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, TrendingUp, TrendingDown, Activity, MapPin, Cpu } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { CountUp } from "@/components/site/CountUp";
import { ArticleRow, FeaturedCard } from "@/components/site/ArticleCard";
import { NewsletterForm } from "@/components/site/NewsletterForm";
import { useMemo, useState } from "react";
import {
  heroStats,
  marketRegions,
  trendingTopics,
  type ArticleCategory,
} from "@/lib/gridpulse-data";
import { articlesQuery, projectsQuery } from "@/lib/gridpulse-repo";

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

function HomePage() {
  const { data: articles = [], isLoading } = useQuery(articlesQuery());
  const featured = articles.slice(0, 3);
  const [filter, setFilter] = useState<ArticleCategory | "all">("all");
  const [count, setCount] = useState(5);

  const feed = useMemo(() => {
    const rest = articles.slice(3);
    return filter === "all" ? rest : rest.filter((a) => a.category === filter);
  }, [filter, articles]);
  const shown = feed.slice(0, count);

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
            <span className="text-cyan-accent"><CountUp value={243} duration={1800} /> GW</span>{" "}
            of grid-scale storage is coming online by 2027.{" "}
            <span className="text-muted-foreground">We track every megawatt.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            GridPulse is the intelligence layer for grid-scale battery energy storage — real-time
            news, a verified project database, and market data sourced from EIA, IEA, FERC, BNEF,
            and the ISO interconnection queues.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {heroStats.map((s) => (
              <div key={s.label} className="glass-card rounded-xl p-5 hover-lift">
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{s.label}</div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-bold text-foreground">
                    {s.value.includes(".") ? (
                      <CountUp value={parseFloat(s.value)} decimals={1} />
                    ) : s.value.startsWith("$") ? (
                      <>$<CountUp value={parseFloat(s.value.slice(1))} /></>
                    ) : (
                      <CountUp value={parseFloat(s.value)} />
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground font-mono-data">{s.unit}</span>
                </div>
                <div className="mt-2 text-xs text-green-accent font-mono-data">{s.delta}</div>
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
            <MarketPulseWidget />
            <RegionMixWidget />
            <TrendingWidget />
            <UpcomingProjectsWidget />
            <NewsletterForm />
          </aside>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function MarketPulseWidget() {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-accent flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" /> Market Pulse
        </div>
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-accent animate-pulse" />
      </div>
      <div className="mt-4 space-y-4">
        <Metric label="Global operational" value={<><CountUp value={412.8} decimals={1} /> GWh</>} delta="+18.4% YoY" up />
        <Metric label="Q3 additions (US)" value={<><CountUp value={9.2} decimals={1} /> GW</>} delta="+62% QoQ" up />
        <Metric label="LFP cell cost" value={<>$<CountUp value={58} />/kWh</>} delta="-6% QoQ" up />
        <Metric label="2027 pipeline" value={<><CountUp value={243} /> GW</>} delta="41 markets" />
      </div>
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

function RegionMixWidget() {
  return (
    <Link to="/regions" className="block glass-card rounded-xl p-5 hover-lift cursor-pointer">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-accent">Regional Capacity Mix</div>
      <div className="mt-4 space-y-2.5">
        {marketRegions.map((r) => (
          <div key={r.name}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground">{r.name}</span>
              <span className="font-mono-data text-muted-foreground">{r.gw} GW · {r.pct}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-accent to-green-accent" style={{ width: `${r.pct * 2.4}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Link>
  );
}

function TrendingWidget() {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-accent">Trending Topics</div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {trendingTopics.map((t) => (
          <Link
            key={t.tag}
            to="/news"
            search={{ q: t.tag }}
            className="tag-chip hover:border-cyan-accent/50 hover:text-cyan-accent transition-colors cursor-pointer"
            style={{ fontSize: `${10 + t.weight}px` }}
          >
            #{t.tag}
          </Link>
        ))}
      </div>
    </div>
  );
}

function UpcomingProjectsWidget() {
  const { data: projects = [] } = useQuery(projectsQuery());
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
              <Link to="/projects/$id" params={{ id: p.id }} className="text-sm font-medium text-foreground hover:text-cyan-accent">
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
