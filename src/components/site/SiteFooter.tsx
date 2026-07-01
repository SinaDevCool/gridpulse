import { Link } from "@tanstack/react-router";
import { Zap, ShieldCheck, Database } from "lucide-react";

const cols: { title: string; items: { label: string; to?: string; href?: string }[] }[] = [
  {
    title: "GridPulse",
    items: [
      { label: "About", to: "/about" },
      { label: "Methodology", to: "/about" },
      { label: "Newsletter", to: "/newsletter" },
      { label: "Subscribe", to: "/subscribe" },
    ],
  },
  {
    title: "Data Sources",
    items: [
      { label: "EIA", href: "https://www.eia.gov" },
      { label: "IEA", href: "https://www.iea.org" },
      { label: "FERC", href: "https://www.ferc.gov" },
      { label: "Ofgem", href: "https://www.ofgem.gov.uk" },
      { label: "Bloomberg NEF", href: "https://about.bnef.com" },
      { label: "Wood Mackenzie", href: "https://www.woodmac.com" },
    ],
  },
  {
    title: "Product",
    items: [
      { label: "News", to: "/news" },
      { label: "Project Database", to: "/projects" },
      { label: "Analytics", to: "/analytics" },
      { label: "Markets", to: "/markets" },
      { label: "Policy Tracker", to: "/policy" },
      { label: "Technology", to: "/technology" },
    ],
  },
  {
    title: "Connect",
    items: [
      { label: "Newsletter", to: "/newsletter" },
      { label: "Sign In", to: "/auth" },
      { label: "Subscribe", to: "/subscribe" },
      { label: "Regions", to: "/regions" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border/60 bg-background/60">
      <div className="mx-auto max-w-[1400px] px-4 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-cyan-accent/15 text-cyan-accent">
                <Zap className="h-4 w-4" />
              </span>
              <span className="font-display text-lg font-bold tracking-tight">
                GRID<span className="text-cyan-accent">PULSE</span>
              </span>
            </Link>
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
                  <li key={i.label}>
                    {i.to ? (
                      <Link to={i.to} className="text-foreground/80 hover:text-cyan-accent transition-colors">
                        {i.label}
                      </Link>
                    ) : (
                      <a href={i.href} target="_blank" rel="noopener noreferrer" className="text-foreground/80 hover:text-cyan-accent transition-colors">
                        {i.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border/50 pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 font-mono-data">
            <Database className="h-3 w-3" />
            <span>Demo data · 14 sources tracked</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span>© {new Date().getFullYear()} GridPulse Intelligence, Inc.</span>
            <Link to="/about" className="hover:text-foreground">Privacy</Link>
            <Link to="/about" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
