import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { CountUp } from "@/components/site/CountUp";
import { costTrend, marketRegions, quarterlyAdditions, technologyMix } from "@/lib/gridpulse-data";

export const Route = createFileRoute("/data")({
  head: () => ({
    meta: [
      { title: "Market Data — GridPulse" },
      { name: "description", content: "Interactive dashboards: global BESS capacity, quarterly additions, cost trends, regional breakdown, and technology mix." },
    ],
  }),
  component: DataPage,
});

const COLORS = ["#22d3ee", "#34d399", "#facc15", "#fb7185", "#a78bfa"];

function DataPage() {
  const [range, setRange] = useState<"1Y" | "3Y" | "5Y" | "All">("All");

  const ct = range === "1Y" ? costTrend.slice(-2) : range === "3Y" ? costTrend.slice(-4) : range === "5Y" ? costTrend.slice(-6) : costTrend;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-12 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">Market Data</div>
        <h1 className="mt-2 font-display text-3xl md:text-5xl font-bold tracking-tight">Global BESS dashboard</h1>
        <p className="mt-3 text-sm text-muted-foreground">Demo data · sources include EIA, IEA, BNEF, Wood Mackenzie, and ISO interconnection queues.</p>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Stat label="Global operational" value={<><CountUp value={412.8} decimals={1} /> GWh</>} sub="+18.4% YoY" />
          <Stat label="2026 pipeline" value={<><CountUp value={243} /> GW</>} sub="41 markets" />
          <Stat label="Avg system cost" value={<>$<CountUp value={138} />/kWh</>} sub="-11% YoY" />
          <Stat label="LFP cell cost" value={<>$<CountUp value={58} />/kWh</>} sub="-6% QoQ" />
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {(["1Y", "3Y", "5Y", "All"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                range === r ? "border-cyan-accent/50 bg-cyan-accent/10 text-cyan-accent" : "border-border bg-surface/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ChartCard title="Quarterly additions (GW)">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={quarterlyAdditions}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="quarter" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
                <Bar dataKey="gw" fill="#22d3ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="System cost trend ($/kWh DC)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={ct}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
                <Line type="monotone" dataKey="usdKwh" stroke="#34d399" strokeWidth={2} dot={{ fill: "#34d399" }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Regional capacity mix (GW)">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={marketRegions} dataKey="gw" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {marketRegions.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Technology mix (% of new installs)">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={technologyMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(d) => `${d.name} ${d.value}%`}>
                  {technologyMix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub: string }) {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-green-accent font-mono-data">{sub}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}
