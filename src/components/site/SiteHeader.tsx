import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Battery, Search, Command, Menu, X, Loader2 } from "lucide-react";
import { marketDataQuery, formatMarketValue, formatDelta } from "@/lib/market-data";
import { searchAll, type SearchResults } from "@/lib/search-client";
import { UserMenu } from "@/components/site/UserMenu";
import { NotificationBell } from "@/components/site/NotificationBell";

const navItems = [
  { label: "News", to: "/news" },
  { label: "Projects", to: "/projects" },

  { label: "Companies", to: "/companies" },
  { label: "Markets", to: "/markets" },
  { label: "Analytics", to: "/analytics" },
  { label: "Regions", to: "/regions" },
  { label: "Watchlist", to: "/watchlist" },
  { label: "Newsletter", to: "/newsletter" },
] as const;

export function SiteHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [debouncedQ, setDebouncedQ] = useState("");
  const [results, setResults] = useState<SearchResults>({ articles: [], projects: [], total: 0 });
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(query.trim()), 200);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!debouncedQ) {
      setResults({ articles: [], projects: [], total: 0 });
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchAll(debouncedQ, 5)
      .then((r) => {
        if (!cancelled) setResults(r);
      })
      .catch(() => {
        if (!cancelled) setResults({ articles: [], projects: [], total: 0 });
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/60 glass-card backdrop-blur-xl">
      <LiveTicker />


      <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-4 py-3 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-md bg-cyan-accent/15 text-cyan-accent animate-pulse-ring">
            <Battery className="h-4 w-4 rotate-90" strokeWidth={2.5} />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-foreground">
            GRID<span className="text-cyan-accent">PULSE</span>
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1 text-sm">
          {navItems.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-elevated/60 transition-colors"
              activeProps={{ className: "text-cyan-accent" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="hidden md:flex items-center gap-2 rounded-md border border-border bg-surface/60 px-3 py-1.5 text-xs text-muted-foreground hover:border-cyan-accent/40 hover:text-foreground transition-colors cursor-pointer min-w-0"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden xl:inline truncate">Search articles, projects, companies…</span>
            <kbd className="hidden xl:inline-flex ml-4 items-center gap-0.5 rounded border border-border/80 bg-background/60 px-1.5 py-0.5 font-mono-data text-[10px]">
              <Command className="h-2.5 w-2.5" /> K
            </kbd>
          </button>
          <NotificationBell />
          <UserMenu />
          <Link
            to="/subscribe"
            className="inline-flex items-center rounded-md bg-cyan-accent px-3.5 py-1.5 text-sm font-medium text-primary-foreground hover:brightness-110 transition"
          >
            Subscribe
          </Link>
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-background/95 backdrop-blur-md" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[280px] max-w-[85vw] bg-surface border-l border-border pt-24 pb-6 shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-6 mb-6">
              <span className="font-display text-lg font-bold text-slate-100">Menu</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close" className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border text-slate-100 hover:text-cyan-400 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col items-start justify-start gap-6 px-6 w-full">
              {navItems.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setMobileOpen(false)}
                  className="text-base font-medium text-slate-100 hover:text-cyan-400 transition-colors"
                >
                  {n.label}
                </Link>
              ))}
            </div>
            <div className="mt-6 px-6 grid gap-2">
              <Link to="/auth" onClick={() => setMobileOpen(false)} className="rounded-md border border-border px-3 py-2 text-center text-sm text-slate-100 hover:text-cyan-400 transition-colors">Sign in</Link>
              <Link to="/subscribe" onClick={() => setMobileOpen(false)} className="rounded-md bg-cyan-accent px-3 py-2 text-center text-sm font-medium text-primary-foreground hover:brightness-110 transition">Subscribe</Link>
            </div>
          </div>
        </div>
      )}

      {/* Search modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
          <div className="absolute left-1/2 top-24 w-[92%] max-w-2xl -translate-x-1/2 rounded-xl border border-border bg-surface shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query.trim()) {
                    setSearchOpen(false);
                    navigate({ to: "/search", search: { q: query.trim() } });
                  }
                }}
                placeholder="Search articles, projects, companies…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <kbd className="text-[10px] text-muted-foreground font-mono-data">ESC</kbd>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {debouncedQ && searching && (
                <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                </div>
              )}
              {!searching && debouncedQ && results.total === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">No results for &ldquo;{debouncedQ}&rdquo;</div>
              )}
              {!debouncedQ && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Search articles, projects, companies, technologies, regions…
                </div>
              )}
              {results.articles.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Articles</div>
                  {results.articles.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => { setSearchOpen(false); navigate({ to: "/news/$slug", params: { slug: a.slug } }); }}
                      className="block w-full text-left rounded-md px-3 py-2 text-sm hover:bg-surface-elevated"
                    >
                      <div className="text-foreground">{a.headline}</div>
                      <div className="text-[11px] text-muted-foreground font-mono-data">{a.source_name ?? "GridPulse"} · {a.region}</div>
                    </button>
                  ))}
                </div>
              )}
              {results.projects.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Projects</div>
                  {results.projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setSearchOpen(false); navigate({ to: "/projects/$slug", params: { slug: p.slug ?? p.id } }); }}
                      className="block w-full text-left rounded-md px-3 py-2 text-sm hover:bg-surface-elevated"
                    >
                      <div className="text-foreground">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono-data">{p.developer ?? "—"} · {p.capacity_mw ?? "—"} MW · {p.location ?? "—"}</div>
                    </button>
                  ))}
                </div>
              )}
              {debouncedQ && results.total > 0 && (
                <div className="border-t border-border mt-2 pt-2">
                  <button
                    onClick={() => { setSearchOpen(false); navigate({ to: "/search", search: { q: debouncedQ } }); }}
                    className="block w-full rounded-md px-3 py-2 text-center text-xs font-medium text-cyan-accent hover:bg-cyan-accent/10"
                  >
                    View all results for &ldquo;{debouncedQ}&rdquo; →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function LiveTicker() {
  const { data, isLoading } = useQuery(marketDataQuery());
  const items = data ?? [];
  // Stable display order: stocks first, then commodities, then indices/metrics.
  const order: Record<string, number> = { stock: 0, commodity: 1, index: 2, metric: 3 };
  const sorted = [...items].sort(
    (a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9) || a.label.localeCompare(b.label),
  );

  return (
    <div className="relative w-full border-b border-border/40 bg-background/40 overflow-hidden h-[30px]">
      <div
        className="absolute left-0 top-0 z-10 h-full px-2 flex items-center bg-background/80 backdrop-blur-sm text-[9px] font-semibold tracking-wider text-green-accent uppercase border-r border-border/40"
        title="Live and verified market data — sourced from Finnhub (stocks) and BloombergNEF Battery Price Survey (cell prices)"
      >
        Live market
      </div>
      {isLoading && sorted.length === 0 ? (
        <div className="pl-[110px] py-1.5 text-[11px] font-mono-data text-muted-foreground">
          Loading market data…
        </div>
      ) : sorted.length === 0 ? (
        <div className="pl-[110px] py-1.5 text-[11px] font-mono-data text-muted-foreground">
          Market data unavailable
        </div>
      ) : (
        <div className="absolute left-0 top-0 flex animate-ticker whitespace-nowrap py-1.5 pl-[110px] text-[11px] font-mono-data">
          {[...sorted, ...sorted].map((p, i) => {
            const delta = formatDelta(p);
            return (
              <div
                key={`${p.symbol}-${i}`}
                className="flex items-center gap-2 px-6 shrink-0"
                title={`${p.label} • Source: ${p.sourceName} (${p.sourceType === "api" ? "live API" : p.sourceType})`}
              >
                <span className="text-muted-foreground tracking-wider">{p.label}</span>
                <span className="text-foreground font-medium">{formatMarketValue(p)}</span>
                {delta && (
                  <span className={delta.positive ? "text-green-accent" : "text-red-accent"}>
                    {delta.text}
                  </span>
                )}
                <span className="text-border">•</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

