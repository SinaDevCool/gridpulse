import { Battery, Search, Command } from "lucide-react";
import { tickerItems } from "@/lib/gridpulse-data";

const navItems = ["News", "Data", "Projects", "Markets", "Policy", "Technology", "Regions", "Newsletter"];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 glass-card backdrop-blur-xl">
      {/* Ticker */}
      <div className="border-b border-border/40 bg-background/40 overflow-hidden">
        <div className="flex animate-ticker whitespace-nowrap py-1.5 text-[11px] font-mono-data">
          {[...tickerItems, ...tickerItems].map((t, i) => (
            <div key={i} className="flex items-center gap-2 px-6 shrink-0">
              <span className="text-muted-foreground tracking-wider">{t.label}</span>
              <span className="text-foreground font-medium">{t.value}</span>
              {t.delta && (
                <span className={t.positive ? "text-green-accent" : "text-red-accent"}>
                  {t.delta}
                </span>
              )}
              <span className="text-border">•</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main bar */}
      <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-4 py-3 lg:px-8">
        <a href="/" className="flex items-center gap-2.5 group">
          <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-md bg-cyan-accent/15 text-cyan-accent animate-pulse-ring">
            <Battery className="h-4 w-4 rotate-90" strokeWidth={2.5} />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-foreground">
            GRID<span className="text-cyan-accent">PULSE</span>
          </span>
        </a>

        <nav className="hidden lg:flex items-center gap-1 text-sm">
          {navItems.map((n) => (
            <a
              key={n}
              href="#"
              className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-elevated/60 transition-colors"
            >
              {n}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            className="hidden md:flex items-center gap-2 rounded-md border border-border bg-surface/60 px-3 py-1.5 text-xs text-muted-foreground hover:border-cyan-accent/40 hover:text-foreground transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search articles, projects, companies…</span>
            <kbd className="ml-4 inline-flex items-center gap-0.5 rounded border border-border/80 bg-background/60 px-1.5 py-0.5 font-mono-data text-[10px]">
              <Command className="h-2.5 w-2.5" /> K
            </kbd>
          </button>
          <button className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground">
            Sign in
          </button>
          <button className="inline-flex items-center rounded-md bg-cyan-accent px-3.5 py-1.5 text-sm font-medium text-primary-foreground hover:brightness-110 transition">
            Subscribe
          </button>
        </div>
      </div>
    </header>
  );
}
