import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Flame,
  Mail,
  Activity,
  MapPin,
  Cpu,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { CountUp } from "@/components/site/CountUp";
import {
  articles,
  categoryStyles,
  heroStats,
  marketRegions,
  timeAgo,
  trendingTopics,
  upcomingProjects,
  type Article,
} from "@/lib/gridpulse-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GridPulse — Grid-Scale Battery Storage News, Data & Markets" },
      {
        name: "description",
        content:
          "Real-time news, project tracking, and market data for grid-scale battery energy storage. Built for BESS developers, investors, utilities, EPCs, OEMs, and policymakers.",
      },
      { property: "og:title", content: "GridPulse — Grid-Scale Battery Storage Intelligence" },
      {
        property: "og:description",
        content:
          "TechCrunch-style news and data for the global grid-scale battery storage industry.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
});

const filterTabs = ["All", "Breaking", "Analysis", "Deals", "Policy", "Technology", "Safety", "Markets"];

function HomePage() {
  const featured = articles.slice(0, 3);
  const feed = articles.slice(3);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at top, color-mix(in oklab, var(--cyan-accent) 18%, transparent), transparent 60%)",
          }}
        />

        <div className="relative mx-auto max-w-[1400px] px-4 py-14 lg:px-8 lg:py-20">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-green-accent animate-pulse" />
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Live · {articles.length} stories tracked in the last 24 hours
            </span>
          </div>

          <h1 className="mt-5 max-w-5xl font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            <span className="text-cyan-accent">
              <CountUp value={243} duration={1800} /> GW
            </span>{" "}
            of grid-scale storage is coming online by 2027.{" "}
            <span className="text-muted-foreground">We track every megawatt.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            GridPulse is the intelligence layer for grid-scale battery energy storage —
            real-time news, a verified project database, and market data sourced from
            EIA, IEA, FERC, BNEF, and the ISO interconnection queues.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {heroStats.map((s) => (
              <div key={s.label} className="glass-card rounded-xl p-5 hover-lift">
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {s.label}
                </div>
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

      {/* FEATURED */}
      <section className="mx-auto max-w-[1400px] px-4 py-12 lg:px-8">
        <SectionHeader eyebrow="Front Page" title="What matters this morning" />
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((a, i) => (
            <FeaturedCard key={a.id} article={a} large={i === 0} />
          ))}
        </div>
      </section>

      {/* MAIN GRID */}
      <section className="mx-auto max-w-[1400px] px-4 pb-16 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Feed */}
          <div>
            <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
              <h2 className="font-display text-2xl font-bold tracking-tight">Latest</h2>
              <div className="text-xs text-muted-foreground font-mono-data">
                Sort: <span className="text-foreground">Latest</span> · Trending · Most Read
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {filterTabs.map((t, i) => (
                <button
                  key={t}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                    i === 0
                      ? "border-cyan-accent/50 bg-cyan-accent/10 text-cyan-accent"
                      : "border-border bg-surface/40 text-muted-foreground hover:text-foreground hover:border-border/80"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="mt-6 divide-y divide-border/50">
              {feed.map((a) => (
                <ArticleRow key={a.id} article={a} />
              ))}
            </div>

            <div className="mt-8 flex justify-center">
              <button className="rounded-md border border-border bg-surface/40 px-5 py-2 text-sm text-muted-foreground hover:border-cyan-accent/40 hover:text-foreground transition">
                Load more stories
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-32 lg:self-start">
            <MarketPulseWidget />
            <RegionMixWidget />
            <TrendingWidget />
            <UpcomingProjectsWidget />
            <NewsletterWidget />
          </aside>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border/60 pb-3">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">
          {eyebrow}
        </div>
        <h2 className="mt-1 font-display text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
      </div>
      <a href="#" className="hidden md:inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-cyan-accent">
        View all <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function CategoryBadge({ category }: { category: Article["category"] }) {
  const s = categoryStyles[category];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] ${s.className}`}
    >
      {category === "breaking" && <Flame className="h-2.5 w-2.5" />}
      {s.label}
    </span>
  );
}

function FeaturedCard({ article, large }: { article: Article; large?: boolean }) {
  return (
    <a
      href="#"
      className={`group relative flex flex-col overflow-hidden rounded-xl glass-card hover-lift ${
        large ? "lg:col-span-1 lg:row-span-1" : ""
      }`}
    >
      {/* Visual */}
      <div className="relative h-44 overflow-hidden border-b border-border/50">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--cyan-accent) 25%, var(--surface)) 0%, var(--surface-elevated) 60%, var(--background) 100%)",
          }}
        />
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/90 to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <CategoryBadge category={article.category} />
          {article.verified && (
            <span className="inline-flex items-center gap-1 rounded border border-green-accent/40 bg-green-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-green-accent">
              <CheckCircle2 className="h-2.5 w-2.5" /> VERIFIED
            </span>
          )}
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono-data text-muted-foreground">
          <span>{article.source.name}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {timeAgo(article.publishedAt)}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-semibold leading-snug tracking-tight text-foreground group-hover:text-cyan-accent transition-colors">
          {article.headline}
        </h3>
        <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{article.summary}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {article.tags.slice(0, 3).map((t) => (
            <span key={t} className="tag-chip">{t}</span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground font-mono-data">
          <span>{article.author}</span>
          <span>{article.readMinutes} min read</span>
        </div>
      </div>
    </a>
  );
}

function ArticleRow({ article }: { article: Article }) {
  return (
    <a href="#" className="group block py-5 first:pt-0">
      <div className="flex items-center gap-2">
        <CategoryBadge category={article.category} />
        {article.verified && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-accent">
            <CheckCircle2 className="h-3 w-3" /> Verified
          </span>
        )}
        <span className="text-[11px] text-muted-foreground font-mono-data ml-auto">
          {article.source.name} · {timeAgo(article.publishedAt)}
        </span>
      </div>
      <h3 className="mt-2 font-display text-lg font-semibold leading-snug tracking-tight text-foreground group-hover:text-cyan-accent transition-colors md:text-xl">
        {article.headline}
      </h3>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{article.summary}</p>
      <div className="mt-3 rounded-md border border-l-2 border-border/60 border-l-cyan-accent/60 bg-surface/40 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider text-cyan-accent/90">Why this matters · </span>
        {article.whyItMatters}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-mono-data">
        <span>{article.author}</span>
        <span>·</span>
        <span>{article.readMinutes} min read</span>
        <span>·</span>
        <span>{article.region}</span>
        {article.alsoReportedBy && (
          <>
            <span>·</span>
            <span>Also: {article.alsoReportedBy.join(", ")}</span>
          </>
        )}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {article.tags.slice(0, 3).map((t) => (
            <span key={t} className="tag-chip">{t}</span>
          ))}
        </div>
      </div>
    </a>
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

function Metric({
  label,
  value,
  delta,
  up,
}: {
  label: string;
  value: React.ReactNode;
  delta?: string;
  up?: boolean;
}) {
  return (
    <div className="flex items-end justify-between border-b border-border/40 pb-3 last:border-0 last:pb-0">
      <div>
        <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
        <div className="mt-1 font-display text-xl font-semibold">{value}</div>
      </div>
      {delta && (
        <span
          className={`flex items-center gap-1 text-xs font-mono-data ${
            up === undefined ? "text-muted-foreground" : up ? "text-green-accent" : "text-red-accent"
          }`}
        >
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
    <div className="glass-card rounded-xl p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-accent">
        Regional Capacity Mix
      </div>
      <div className="mt-4 space-y-2.5">
        {marketRegions.map((r) => (
          <div key={r.name}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground">{r.name}</span>
              <span className="font-mono-data text-muted-foreground">{r.gw} GW · {r.pct}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-accent to-green-accent"
                style={{ width: `${r.pct * 2.4}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendingWidget() {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-accent">
        Trending Topics
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {trendingTopics.map((t) => (
          <a
            key={t.tag}
            href="#"
            className="tag-chip hover:border-cyan-accent/50 hover:text-cyan-accent transition-colors"
            style={{ fontSize: `${10 + t.weight}px` }}
          >
            #{t.tag}
          </a>
        ))}
      </div>
    </div>
  );
}

function UpcomingProjectsWidget() {
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
        <a href="#" className="text-[11px] text-muted-foreground hover:text-cyan-accent">All →</a>
      </div>
      <ul className="mt-4 space-y-3.5">
        {upcomingProjects.map((p) => (
          <li key={p.id} className="border-b border-border/40 pb-3 last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-2">
              <a href="#" className="text-sm font-medium text-foreground hover:text-cyan-accent">
                {p.name}
              </a>
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

function NewsletterWidget() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-cyan-accent/30 bg-gradient-to-br from-cyan-accent/10 via-surface to-surface p-5 neon-cyan-glow">
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-accent">
          <Mail className="h-3.5 w-3.5" /> The GridPulse Brief
        </div>
        <h3 className="mt-3 font-display text-lg font-bold leading-tight">
          The 5 stories shaping grid storage, in your inbox at 7am ET.
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Joined by 14,200+ developers, investors, and utility planners.
        </p>
        <form className="mt-4 flex gap-2">
          <input
            type="email"
            placeholder="you@utility.com"
            className="flex-1 rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-cyan-accent focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-cyan-accent px-3 py-2 text-sm font-medium text-primary-foreground hover:brightness-110"
          >
            Subscribe
          </button>
        </form>
      </div>
    </div>
  );
}
