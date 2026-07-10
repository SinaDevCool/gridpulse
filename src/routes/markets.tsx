import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { projectsQuery } from "@/lib/gridpulse-repo";
import { isLiveProject, type Project } from "@/lib/gridpulse-data";
import { euRegionOf, isEuropeanProject, EU_REGIONS, type EuRegion } from "@/lib/eu-regions";

export const Route = createFileRoute("/markets")({
  head: () => ({
    meta: [
      { title: "European Market Dashboard — GridPulse" },
      { name: "description", content: "Institutional market intelligence for grid-scale battery storage across Germany, the United Kingdom, and the rest of Europe: capacity, status, chemistry, and upcoming COD year." },
    ],
  }),
  component: MarketsPage,
});

const COLORS = ["#22d3ee", "#34d399", "#fbbf24", "#a78bfa", "#fb7185", "#60a5fa", "#f472b6", "#facc15"];

function regionOf(p: Project): EuRegion {
  return euRegionOf(p) ?? "Rest of Europe (EU)";
}

const CHEMISTRY_ALIASES: Array<[RegExp, string]> = [
  [/redox|flow/i, "Redox-Flow"],
  [/sodium|natrium|na[- ]?ion/i, "Sodium-ion"],
  [/lead|blei/i, "Lead-acid"],
  [/vanadium/i, "Vanadium"],
  [/lfp|nmc|li[- ]?ion|lithium|bess|battery|speicher/i, "Lithium-ion"],
];

function normalizeChemistry(p: Project): string {
  const raw = `${p.chemistry ?? ""} ${p.technology ?? ""}`.trim();
  if (!raw) return "Unspecified";
  for (const [re, label] of CHEMISTRY_ALIASES) if (re.test(raw)) return label;
  if (/wind/i.test(raw)) return "Wind";
  if (/solar|pv/i.test(raw)) return "Solar PV";
  return "Other";
}

function codYearOf(p: Project): string {
  const m = (p.cod || "").match(/\b(20\d{2})\b/);
  return m ? m[1] : "Unknown";
}

function rollup(projects: Project[], key: (p: Project) => string) {
  const map = new Map<string, { mw: number; mwh: number; count: number }>();
  for (const p of projects) {
    const k = key(p) || "Unknown";
    const cur = map.get(k) ?? { mw: 0, mwh: 0, count: 0 };
    cur.mw += p.capacityMw;
    cur.mwh += p.capacityMwh;
    cur.count += 1;
    map.set(k, cur);
  }
  return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }));
}


function MarketsPage() {
  const { data: allProjects = [], isLoading, isError, error, refetch } = useQuery(projectsQuery());
  // Enterprise European view: live rows only, and only projects located in
  // Germany, the UK, or the rest of Europe.
  const projects = useMemo(
    () => allProjects.filter((p) => isLiveProject(p) && isEuropeanProject(p)),
    [allProjects],
  );

  const byRegion = useMemo(() => {
    const rows = rollup(projects, regionOf);
    // Sort in the canonical order so charts read Germany → UK → Rest of EU.
    const order: Record<EuRegion, number> = {
      "Germany (DE)": 0,
      "United Kingdom (UK)": 1,
      "Rest of Europe (EU)": 2,
    };
    return EU_REGIONS
      .map((name) => rows.find((r) => r.name === name) ?? { name, mw: 0, mwh: 0, count: 0 })
      .sort((a, b) => order[a.name as EuRegion] - order[b.name as EuRegion]);
  }, [projects]);
  const byStatus = useMemo(() => rollup(projects, (p) => p.status), [projects]);
  const byChemistry = useMemo(() => rollup(projects, normalizeChemistry).sort((a, b) => b.mw - a.mw), [projects]);
  const byCodYear = useMemo(
    () => rollup(projects, codYearOf)
      .filter((r) => /^20\d{2}$/.test(r.name))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );

  const totalMw = projects.reduce((s, p) => s + p.capacityMw, 0);
  const totalMwh = projects.reduce((s, p) => s + p.capacityMwh, 0);
  const opMw = projects.filter((p) => p.status === "Operational").reduce((s, p) => s + p.capacityMw, 0);
  const pipelineMw = totalMw - opMw;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-12 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">Market Dashboard</div>
        <h1 className="mt-2 font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">Grid-scale storage, by the numbers</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Live aggregates from {projects.length.toLocaleString()} tracked projects in the GridPulse database. Slice the pipeline by region, status, chemistry, and upcoming COD year.
        </p>

        <div className="mt-8 grid gap-3 md:grid-cols-4">
          <Stat label="Tracked projects" value={projects.length.toLocaleString()} />
          <Stat label="Total power" value={`${totalMw.toLocaleString()} MW`} />
          <Stat label="Total energy" value={`${totalMwh.toLocaleString()} MWh`} />
          <Stat label="Pipeline (non-op)" value={`${pipelineMw.toLocaleString()} MW`} />
        </div>

        {isError && (
          <ErrorBox message={(error as Error)?.message ?? "Failed to load market data"} onRetry={() => refetch()} />
        )}

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <ChartCard title="Capacity by region" subtitle="MW · all statuses" loading={isLoading} empty={byRegion.length === 0}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byRegion} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toLocaleString()} MW`, "Power"]} />
                <Bar dataKey="mw" fill="#22d3ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Capacity by status" subtitle="MW share of pipeline" loading={isLoading} empty={byStatus.length === 0}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={byStatus}
                  dataKey="mw"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
                <Tooltip {...tooltipStyle} formatter={(v: number, n) => [`${v.toLocaleString()} MW`, n]} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Capacity by chemistry" subtitle="MW · cells & technology" loading={isLoading} empty={byChemistry.length === 0}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byChemistry} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toLocaleString()} MW`, "Power"]} />
                <Bar dataKey="mw" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Upcoming COD by year" subtitle="MW expected online" loading={isLoading} empty={byCodYear.length === 0}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byCodYear} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toLocaleString()} MW`, "Power"]} />
                <Bar dataKey="mw" fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <section className="mt-10 rounded-xl border border-border/60 bg-surface/40 p-6">
          <h2 className="font-display text-lg font-bold">Region breakdown</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">Region</th>
                  <th className="py-2 text-right">Projects</th>
                  <th className="py-2 text-right">MW</th>
                  <th className="py-2 text-right">MWh</th>
                  <th className="py-2 text-right">% of MW</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {byRegion.map((r) => (
                  <tr key={r.name}>
                    <td className="py-2">
                      <Link to="/projects" search={{ region: r.name }} className="hover:text-cyan-accent">{r.name}</Link>
                    </td>
                    <td className="py-2 text-right font-mono-data">{r.count}</td>
                    <td className="py-2 text-right font-mono-data">{r.mw.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono-data">{r.mwh.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono-data">{totalMw > 0 ? ((r.mw / totalMw) * 100).toFixed(1) : "0"}%</td>
                  </tr>
                ))}
                {!isLoading && byRegion.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No projects yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--surface))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  },
  cursor: { fill: "hsl(var(--surface-elevated) / 0.4)" },
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, loading, empty }: { title: string; subtitle: string; children: React.ReactNode; loading?: boolean; empty?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/40 p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-base font-bold">{title}</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{subtitle}</span>
      </div>
      <div className="mt-4">
        {loading ? (
          <div className="h-[280px] animate-pulse rounded bg-surface" />
        ) : empty ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">No data available</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-8 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
      <p className="text-destructive-foreground">Couldn't load market data: {message}.</p>
      <button onClick={onRetry} className="mt-2 text-cyan-accent hover:underline">Retry</button>
    </div>
  );
}
