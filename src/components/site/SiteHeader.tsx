import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Battery, Search, Command, Menu, X, Loader2 } from "lucide-react";
import { tickerItems } from "@/lib/gridpulse-data";
import { searchAll, type SearchResults } from "@/lib/search-client";
import { UserMenu } from "@/components/site/UserMenu";
import { NotificationBell } from "@/components/site/NotificationBell";

const navItems = [
  { label: "News", to: "/news" },
  { label: "Data", to: "/data" },
  { label: "Projects", to: "/projects" },
  { label: "Markets", to: "/markets" },
  { label: "Policy", to: "/policy" },
  { label: "Technology", to: "/technology" },
  { label: "Regions", to: "/regions" },
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
    <header className="sticky top-0 z-50 border-b border-border/60 glass-card backdrop-blur-xl">
      <div className="border-b border-border/40 bg-background/40 overflow-hidden">
        <div className="flex animate-ticker whitespace-nowrap py-1.5 text-[11px] font-mono-data">
          {[...tickerItems, ...tickerItems].map((t, i) => (
            <div key={i} className="flex items-center gap-2 px-6 shrink-0">
              <span className="text-muted-foreground tracking-wider">{t.label}</span>
              <span className="text-foreground font-medium">{t.value}</span>
              {t.delta && (
                <span className={t.positive ? "text-green-accent" : "text-red-accent"}>{t.delta}</span>
              )}
              <span className="text-border">•</span>
            </div>
          ))}
        </div>
      </div>

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
            className="hidden md:flex items-center gap-2 rounded-md border border-border bg-surface/60 px-3 py-1.5 text-xs text-muted-foreground hover:border-cyan-accent/40 hover:text-foreground transition-colors cursor-pointer"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search articles, projects, companies…</span>
            <kbd className="ml-4 inline-flex items-center gap-0.5 rounded border border-border/80 bg-background/60 px-1.5 py-0.5 font-mono-data text-[10px]">
              <Command className="h-2.5 w-2.5" /> K
            </kbd>
          </button>
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
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[280px] bg-surface border-l border-border p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between mb-4">
              <span className="font-display text-lg font-bold">Menu</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close" className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border">
                <X className="h-4 w-4" />
              </button>
            </div>
            {navItems.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm text-foreground hover:bg-surface-elevated"
              >
                {n.label}
              </Link>
            ))}
            <div className="mt-4 grid gap-2">
              <Link to="/auth" onClick={() => setMobileOpen(false)} className="rounded-md border border-border px-3 py-2 text-center text-sm">Sign in</Link>
              <Link to="/subscribe" onClick={() => setMobileOpen(false)} className="rounded-md bg-cyan-accent px-3 py-2 text-center text-sm font-medium text-primary-foreground">Subscribe</Link>
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
                placeholder="Search articles, projects, companies…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <kbd className="text-[10px] text-muted-foreground font-mono-data">ESC</kbd>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {results.articles.length === 0 && results.projects.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">No results for "{query}"</div>
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
                      <div className="text-[11px] text-muted-foreground font-mono-data">{a.source.name} · {a.region}</div>
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
                      onClick={() => { setSearchOpen(false); navigate({ to: "/projects/$id", params: { id: p.id } }); }}
                      className="block w-full text-left rounded-md px-3 py-2 text-sm hover:bg-surface-elevated"
                    >
                      <div className="text-foreground">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono-data">{p.developer} · {p.capacityMw} MW · {p.location}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
