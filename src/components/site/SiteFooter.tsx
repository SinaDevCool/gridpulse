import { Zap, ShieldCheck, Database } from "lucide-react";

const cols = [
  {
    title: "GridPulse",
    items: ["About", "Methodology", "Editorial Standards", "Corrections Log", "Careers", "Press"],
  },
  {
    title: "Data Sources",
    items: ["EIA", "IEA", "ACP", "Wood Mackenzie", "Bloomberg NEF", "SEC EDGAR", "FERC", "Ofgem"],
  },
  {
    title: "Product",
    items: ["News", "Project Database", "Market Dashboards", "API Access", "Pricing", "Status"],
  },
  {
    title: "Connect",
    items: ["Newsletter", "Tips & Leaks", "Contact", "Twitter / X", "LinkedIn", "RSS"],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border/60 bg-background/60">
      <div className="mx-auto max-w-[1400px] px-4 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-cyan-accent/15 text-cyan-accent">
                <Zap className="h-4 w-4" />
              </span>
              <span className="font-display text-lg font-bold tracking-tight">
                GRID<span className="text-cyan-accent">PULSE</span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              The intelligence layer for grid-scale battery energy storage.
            </p>
            <div className="mt-4 flex items-center gap-2 tag-chip">
              <ShieldCheck className="h-3 w-3 text-green-accent" />
              <span className="text-green-accent">All data primary-sourced</span>
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {c.title}
              </div>
              <ul className="mt-4 space-y-2.5 text-sm">
                {c.items.map((i) => (
                  <li key={i}>
                    <a href="#" className="text-foreground/80 hover:text-cyan-accent transition-colors">
                      {i}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border/50 pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 font-mono-data">
            <Database className="h-3 w-3" />
            <span>Last data sync: {new Date().toLocaleTimeString()} · 14 sources healthy</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span>© {new Date().getFullYear()} GridPulse Intelligence, Inc.</span>
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Disclosures</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
