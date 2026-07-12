import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid, LineChart, Line,
} from "recharts";
import { Download, Lock, Filter, X } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { AuthWall } from "@/components/site/AuthWall";
import { projectsQuery } from "@/lib/gridpulse-repo";
import { supabase } from "@/integrations/supabase/client";
import { isLiveProject, type Project } from "@/lib/gridpulse-data";
import { TSO_ZONES, tsoZoneOf, nodeClassStyles, nodeClassLabel, sitingScore, activeFeedsForCountry } from "@/lib/tso-zones";


export const Route = createFileRoute("/analytics")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Analytics — GridPulse" },
      { name: "description", content: "Interactive analytics for grid-scale battery storage: filter by region, country, status, chemistry, developer, and COD year. Compare companies and export data." },
      { property: "og:title", content: "Analytics — GridPulse" },
      { property: "og:description", content: "Slice the global BESS pipeline by region, technology, status, developer, and year." },
    ],
  }),
  component: GatedAnalyticsPage,
  pendingComponent: () => (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-10 lg:px-8">
        <div className="h-8 w-64 animate-pulse rounded bg-surface" />
        <div className="mt-4 h-4 w-96 animate-pulse rounded bg-surface" />
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {[0,1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-surface" />)}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {[0,1,2,3].map(i => <div key={i} className="h-[320px] animate-pulse rounded-xl bg-surface" />)}
        </div>
      </div>
    </div>
  ),
  errorComponent: ({ error }: { error: Error }) => (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-2xl font-bold">Analytics failed to load</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error?.message || "Unknown error"}</p>
        <a href="/analytics" className="mt-6 inline-flex rounded-md border border-border/60 bg-surface/60 px-4 py-2 text-sm font-medium hover:bg-surface">Retry</a>
      </div>
    </div>
  ),
});

const COLORS = ["#22d3ee", "#34d399", "#fbbf24", "#a78bfa", "#fb7185", "#60a5fa", "#f472b6", "#facc15", "#4ade80", "#f87171"];

type Tier = "free" | "pro" | "enterprise";

function codYearOf(p: Project): string {
  const m = (p.cod || "").match(/\b(20\d{2})\b/);
  return m ? m[1] : "Unknown";
}

import { euRegionOf, isEuropeanProject, EU_REGIONS, mergeWithFallback, type EuRegion } from "@/lib/eu-regions";

function regionOf(p: Project): EuRegion {
  return euRegionOf(p);
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


function rollup<T extends Project>(items: T[], key: (p: T) => string) {
  const map = new Map<string, { mw: number; mwh: number; count: number }>();
  for (const p of items) {
    const k = (key(p) || "Unknown").trim() || "Unknown";
    const cur = map.get(k) ?? { mw: 0, mwh: 0, count: 0 };
    cur.mw += p.capacityMw;
    cur.mwh += p.capacityMwh;
    cur.count += 1;
    map.set(k, cur);
  }
  return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }));
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function useTier(): Tier {
  const [tier, setTier] = useState<Tier>("free");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.rpc("get_user_tier", { _user_id: u.user.id });
      if (!cancelled && (data === "pro" || data === "enterprise" || data === "free")) {
        setTier(data as Tier);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return tier;
}

function uniq(values: Array<string | undefined | null>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const s = (v ?? "").trim();
    if (s) set.add(s);
  }
  return Array.from(set).sort();
}

function GatedAnalyticsPage() {
  return (
    <AuthWall
      title="Sign in to unlock GridPulse Analytics"
      message="Filter the global BESS pipeline, compare developers, and export project-level data. Free account required."
    >
      <AnalyticsPage />
    </AuthWall>
  );
}

function AnalyticsPage() {
  const { data: allProjects = [], isLoading, isError, error, refetch } = useQuery(projectsQuery());
  // Global 4-tier taxonomy: exclude demo seed rows but keep every real market
  // (NA / EU-UK / APAC / LATAM). Fallback projects are merged for regions
  // where the live DB is still empty.
  const projects = useMemo(
    () => mergeWithFallback(allProjects.filter((p) => isLiveProject(p) && isEuropeanProject(p))),
    [allProjects],
  );
  const tier = useTier();
  const canExportAdvanced = tier === "pro" || tier === "enterprise";

  const [region, setRegion] = useState("");
  const [country, setCountry] = useState(""); // country_code (ISO-alpha-2) when known, else country name
  const [status, setStatus] = useState("");
  const [chemistry, setChemistry] = useState("");
  const [developer, setDeveloper] = useState("");
  const [codYear, setCodYear] = useState("");
  const [compare, setCompare] = useState<string[]>([]);

  // Canonical European regional taxonomy — enterprise UI never shows
  // "north-america" / "asia-pacific" / "latin-america" here.
  const regions = EU_REGIONS;
  // Country options deduped by country_code (so US/USA/United States collapse to one chip).
  const countryOptions = useMemo(() => {
    const map = new Map<string, string>(); // key → label
    for (const p of projects) {
      const key = (p.countryCode ?? p.country ?? "").trim();
      const label = (p.country ?? "").trim() || key;
      if (!key) continue;
      if (!map.has(key)) map.set(key, label);
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [projects]);
  const statuses = useMemo(() => uniq(projects.map((p) => p.status)), [projects]);
  const chemistries = useMemo(() => uniq(projects.map(normalizeChemistry)), [projects]);
  const developers = useMemo(() => uniq(projects.map((p) => p.developer)), [projects]);
  const codYears = useMemo(
    () => uniq(projects.map(codYearOf)).filter((y) => /^20\d{2}$/.test(y)),
    [projects],
  );

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (region && regionOf(p) !== region) return false;
      if (country) {
        const key = (p.countryCode ?? p.country ?? "").trim();
        if (key !== country) return false;
      }
      if (status && p.status !== status) return false;
      if (chemistry && normalizeChemistry(p) !== chemistry) return false;
      if (developer && p.developer !== developer) return false;
      if (codYear && codYearOf(p) !== codYear) return false;
      return true;
    });
  }, [projects, region, country, status, chemistry, developer, codYear]);

  const byRegion = useMemo(() => rollup(filtered, regionOf).sort((a, b) => b.mw - a.mw), [filtered]);
  const byChem = useMemo(() => rollup(filtered, normalizeChemistry).sort((a, b) => b.mw - a.mw), [filtered]);
  const byStatus = useMemo(() => rollup(filtered, (p) => p.status), [filtered]);
  const byCodYear = useMemo(
    () => rollup(filtered, codYearOf).filter((r) => /^20\d{2}$/.test(r.name)).sort((a, b) => a.name.localeCompare(b.name)),
    [filtered],
  );
  const topDevelopers = useMemo(
    () => rollup(filtered, (p) => p.developer).sort((a, b) => b.mw - a.mw).slice(0, 10),
    [filtered],
  );

  const totalMw = filtered.reduce((s, p) => s + p.capacityMw, 0);
  const totalMwh = filtered.reduce((s, p) => s + p.capacityMwh, 0);
  const opMw = filtered.filter((p) => p.status === "Operational").reduce((s, p) => s + p.capacityMw, 0);

  // company comparison: aggregate selected developer names
  const compareData = useMemo(() => {
    if (compare.length === 0) return [];
    return compare.map((dev) => {
      const items = projects.filter((p) => p.developer === dev);
      const mw = items.reduce((s, p) => s + p.capacityMw, 0);
      const mwh = items.reduce((s, p) => s + p.capacityMwh, 0);
      const operational = items.filter((p) => p.status === "Operational").reduce((s, p) => s + p.capacityMw, 0);
      const pipeline = mw - operational;
      return { name: dev, projects: items.length, mw, mwh, operational, pipeline };
    });
  }, [compare, projects]);

  const activeFilters = [region, country, status, chemistry, developer, codYear].filter(Boolean).length;
  const clearAll = () => {
    setRegion(""); setCountry(""); setStatus(""); setChemistry(""); setDeveloper(""); setCodYear("");
  };

  const exportAggregate = (name: string, rows: Array<{ name: string; mw: number; mwh: number; count: number }>) => {
    downloadCsv(`gridpulse-${name}.csv`, toCsv(rows.map((r) => ({ group: r.name, projects: r.count, mw: r.mw, mwh: r.mwh }))));
  };

  const exportFullProjects = () => {
    if (!canExportAdvanced) return;
    const rows = filtered.map((p) => ({
      id: p.id,
      slug: p.slug ?? "",
      name: p.name,
      developer: p.developer,
      owner: p.owner ?? "",
      operator: p.operator ?? "",
      offtaker: p.offtaker ?? "",
      capacity_mw: p.capacityMw,
      capacity_mwh: p.capacityMwh,
      technology: p.technology,
      chemistry: p.chemistry ?? "",
      use_case: p.useCase ?? "",
      status: p.status,
      cod: p.cod,
      country: p.country,
      region: p.region,
      location: p.location,
      last_verified_at: p.lastVerifiedAt ?? "",
    }));
    downloadCsv(`gridpulse-projects-full.csv`, toCsv(rows));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-10 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">Analytics</div>
            <h1 className="mt-2 font-display text-3xl md:text-4xl font-bold tracking-tight">Market analytics & data visualization</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Interactive view of {projects.length.toLocaleString()} tracked grid-scale storage projects from the live database. Filter, compare, and export.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => exportAggregate("region-summary", byRegion)}
              className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-surface/60 px-3 py-1.5 text-xs font-medium hover:bg-surface"
            >
              <Download className="h-3.5 w-3.5" /> Region CSV
            </button>
            <button
              onClick={() => exportAggregate("chemistry-summary", byChem)}
              className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-surface/60 px-3 py-1.5 text-xs font-medium hover:bg-surface"
            >
              <Download className="h-3.5 w-3.5" /> Chemistry CSV
            </button>
            <button
              onClick={exportFullProjects}
              disabled={!canExportAdvanced}
              title={canExportAdvanced ? "Export filtered projects with full enrichment" : "Pro / Enterprise feature"}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold ${
                canExportAdvanced
                  ? "border border-cyan-accent/50 bg-cyan-accent/10 text-cyan-accent hover:bg-cyan-accent/20"
                  : "cursor-not-allowed border border-border/40 bg-surface/40 text-muted-foreground"
              }`}
            >
              {canExportAdvanced ? <Download className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              Full projects CSV {canExportAdvanced ? "" : "(Pro)"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <section className="mt-6 rounded-xl border border-border/60 bg-surface/40 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span className="font-semibold uppercase tracking-wider">Filters</span>
            {activeFilters > 0 && (
              <button onClick={clearAll} className="ml-auto inline-flex items-center gap-1 text-cyan-accent hover:underline">
                <X className="h-3 w-3" /> Clear ({activeFilters})
              </button>
            )}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <FilterSelect label="Region" value={region} onChange={setRegion} options={regions} />
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Country</span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full truncate rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs"
              >
                <option value="">All</option>
                {countryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <FilterSelect label="Status" value={status} onChange={setStatus} options={statuses} />
            <FilterSelect label="Chemistry" value={chemistry} onChange={setChemistry} options={chemistries} />
            <FilterSelect label="Developer" value={developer} onChange={setDeveloper} options={developers} />
            <FilterSelect label="COD year" value={codYear} onChange={setCodYear} options={codYears} />
          </div>
        </section>

        {/* KPIs */}
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <Stat label="Projects (filtered)" value={filtered.length.toLocaleString()} />
          <Stat label="Total power" value={`${totalMw.toLocaleString()} MW`} />
          <Stat label="Total energy" value={`${totalMwh.toLocaleString()} MWh`} />
          <Stat label="Operational MW" value={`${opMw.toLocaleString()} MW`} />
        </div>

        {isError && <ErrorBox message={(error as Error)?.message ?? "Failed to load"} onRetry={() => refetch()} />}

        {/* Charts grid */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <ChartCard title="MW & MWh by region" subtitle="Power vs energy" loading={isLoading} empty={byRegion.length === 0}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byRegion} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip {...tooltipStyle} formatter={(v: number, n) => [v.toLocaleString(), n === "mw" ? "MW" : "MWh"]} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="mw" name="MW" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                <Bar dataKey="mwh" name="MWh" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="MW & MWh by technology / chemistry" subtitle="Cells & long-duration tech" loading={isLoading} empty={byChem.length === 0}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byChem} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip {...tooltipStyle} formatter={(v: number, n) => [v.toLocaleString(), n === "mw" ? "MW" : "MWh"]} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="mw" name="MW" fill="#34d399" radius={[4, 4, 0, 0]} />
                <Bar dataKey="mwh" name="MWh" fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Project count by status" subtitle="Pipeline composition" loading={isLoading} empty={byStatus.length === 0}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={byStatus} dataKey="count" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
                <Tooltip {...tooltipStyle} formatter={(v: number, n) => [`${v} projects`, n]} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Upcoming COD by year" subtitle="MW expected online" loading={isLoading} empty={byCodYear.length === 0}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={byCodYear} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toLocaleString()} MW`, "Power"]} />
                <Line type="monotone" dataKey="mw" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Top developers */}
        <section className="mt-8 rounded-xl border border-border/60 bg-surface/40 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold">Top developers by capacity</h2>
              <p className="text-xs text-muted-foreground">Click a developer to add it to the comparison panel (max 4).</p>
            </div>
            <button
              onClick={() => exportAggregate("top-developers", topDevelopers)}
              className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-surface/60 px-3 py-1.5 text-xs font-medium hover:bg-surface"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
          {isLoading ? (
            <div className="mt-4 h-[320px] animate-pulse rounded bg-surface" />
          ) : topDevelopers.length === 0 ? (
            <div className="mt-4 flex h-[200px] items-center justify-center text-sm text-muted-foreground">No developers match the filters.</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(240, topDevelopers.length * 32)}>
              <BarChart data={topDevelopers} layout="vertical" margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis type="category" dataKey="name" width={160} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toLocaleString()} MW`, "Power"]} />
                <Bar dataKey="mw" fill="#60a5fa" radius={[0, 4, 4, 0]}
                  onClick={(d: { name?: string }) => {
                    const name = d?.name;
                    if (!name) return;
                    setCompare((prev) =>
                      prev.includes(name) ? prev.filter((x) => x !== name) : prev.length >= 4 ? prev : [...prev, name],
                    );
                  }}
                  cursor="pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* Company comparison */}
        <section className="mt-8 rounded-xl border border-border/60 bg-surface/40 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">Company comparison</h2>
              <p className="text-xs text-muted-foreground">Compare operational vs pipeline capacity for selected developers.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  setCompare((prev) => (prev.includes(v) || prev.length >= 4 ? prev : [...prev, v]));
                }}
                className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs"
              >
                <option value="">Add developer…</option>
                {developers.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              {compare.length > 0 && (
                <button onClick={() => setCompare([])} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
              )}
            </div>
          </div>

          {compare.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {compare.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs">
                  {c}
                  <button onClick={() => setCompare((prev) => prev.filter((x) => x !== c))} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="mt-4">
            {compareData.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                Select up to 4 developers above (or click bars in the Top developers chart) to compare.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={compareData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip {...tooltipStyle} formatter={(v: number, n) => [`${v.toLocaleString()} MW`, n]} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="operational" name="Operational MW" stackId="a" fill="#34d399" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="pipeline" name="Pipeline MW" stackId="a" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="py-2 text-left">Developer</th>
                        <th className="py-2 text-right">Projects</th>
                        <th className="py-2 text-right">MW</th>
                        <th className="py-2 text-right">MWh</th>
                        <th className="py-2 text-right">Operational MW</th>
                        <th className="py-2 text-right">Pipeline MW</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {compareData.map((c) => (
                        <tr key={c.name}>
                          <td className="py-2">
                            <Link to="/companies/$slug" params={{ slug: encodeURIComponent(c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) }} className="hover:text-cyan-accent">
                              {c.name}
                            </Link>
                          </td>
                          <td className="py-2 text-right font-mono-data">{c.projects}</td>
                          <td className="py-2 text-right font-mono-data">{c.mw.toLocaleString()}</td>
                          <td className="py-2 text-right font-mono-data">{c.mwh.toLocaleString()}</td>
                          <td className="py-2 text-right font-mono-data">{c.operational.toLocaleString()}</td>
                          <td className="py-2 text-right font-mono-data">{c.pipeline.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>

        <SitingScorecard filtered={filtered} country={country} region={region} />

        <p className="mt-8 text-xs text-muted-foreground">
          Source: live GridPulse project database. {!canExportAdvanced && (
            <>Upgrade to <Link to="/subscribe" className="text-cyan-accent hover:underline">Pro</Link> for full per-project CSV exports with owner, operator, offtaker, and source-verification fields.</>
          )}
        </p>

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

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full truncate rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs"
      >
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function ChartCard({ title, subtitle, children, loading, empty }: { title: string; subtitle: string; children: React.ReactNode; loading?: boolean; empty?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/40 p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-bold">{title}</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{subtitle}</span>
      </div>
      <div className="mt-4">
        {loading ? (
          <div className="h-[280px] animate-pulse rounded bg-surface" />
        ) : empty ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">No data for current filters.</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
      <p className="text-destructive-foreground">Couldn't load analytics data: {message}.</p>
      <button onClick={onRetry} className="mt-2 text-cyan-accent hover:underline">Retry</button>
    </div>
  );
}

function riskLabel(pct: number): { label: "High" | "Medium" | "Low"; chip: string } {
  if (pct >= 35) return { label: "High", chip: "border-red-accent/50 bg-red-accent/10 text-red-accent" };
  if (pct >= 20) return { label: "Medium", chip: "border-amber-accent/50 bg-amber-accent/10 text-amber-accent" };
  return { label: "Low", chip: "border-green-accent/50 bg-green-accent/10 text-green-accent" };
}

function timeToConnectEstimate(months: number): { text: string; tone: string } {
  if (months <= 18) return { text: "6-12 Months (Fast-Track)", tone: "text-green-accent" };
  if (months <= 36) return { text: "18-30 Months (Standard Queue)", tone: "text-cyan-accent" };
  if (months <= 48) return { text: "3-4 Years (Constrained)", tone: "text-amber-accent" };
  return { text: "5+ Years (Queue Blocked)", tone: "text-red-accent" };
}

function SitingScorecard({ filtered, country, region }: { filtered: Project[]; country: string; region: string }) {
  const [calcOpen, setCalcOpen] = useState(false);

  // Global tab visibility rule — the TSO / Redispatch matrix is only
  // meaningful for regions with a TSO in TSO_ZONES (currently NA + EU/UK).
  // When the user narrows to APAC / LATAM the module hides itself, matching
  // the "UI State Integrity" requirement.
  const regionApplicable = !region || region === "Europe & UK (EU/UK)" || region === "North America (US/CA)";

  const rows = useMemo(() => {
    if (!regionApplicable) return [];
    const map = new Map<string, { mw: number; count: number }>();
    for (const p of filtered) {
      const z = tsoZoneOf(p);
      if (!z) continue;
      const cur = map.get(z.code) ?? { mw: 0, count: 0 };
      cur.mw += p.capacityMw ?? 0;
      cur.count += 1;
      map.set(z.code, cur);
    }
    // Total operational BESS MW per zone drives the Co-location Opportunity
    // Index — more nearby operational capacity = stronger co-location signal.
    const totalOperational = filtered
      .filter((p) => p.status === "Operational")
      .reduce((s, p) => s + (p.capacityMw ?? 0), 0) || 1;
    return TSO_ZONES.map((zone) => {
      const assignedMw = map.get(zone.code)?.mw ?? 0;
      const assignedProjects = map.get(zone.code)?.count ?? 0;
      const coLocationIndex = Math.min(
        Math.round(((assignedMw / totalOperational) * 100) + (100 - zone.redispatchRiskPct) * 0.35),
        100,
      );
      return {
        zone,
        score: sitingScore(zone),
        assignedMw,
        assignedProjects,
        coLocationIndex,
      };
    }).sort((a, b) => b.score - a.score);
  }, [filtered, regionApplicable]);

  const activeFeeds = useMemo(() => activeFeedsForCountry(country || null), [country]);

  if (!regionApplicable) {
    return (
      <section className="mt-8 rounded-xl border border-border/60 bg-surface/30 p-5 text-sm text-muted-foreground">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">European Load Siting Optimization Matrix</div>
        <p className="mt-2">TSO capacity, redispatch, and time-to-energize metrics are published for North America and Europe/UK. Switch the Region filter to <span className="text-foreground">Europe & UK (EU/UK)</span> or <span className="text-foreground">North America (US/CA)</span> to activate the matrix.</p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-xl border border-cyan-accent/30 bg-cyan-accent/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-accent">Institutional Module</div>
          <h2 className="mt-1 font-display text-xl font-bold">European Load Siting Optimization Matrix</h2>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Time-to-Connect ranking of every governing TSO zone — headroom, redispatch exposure, and co-location opportunity for hyperscale data centers and heavy industrial loads.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-cyan-accent/40 bg-cyan-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-accent">
            GridCARE methodology
          </span>
          <button
            onClick={() => setCalcOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-cyan-accent/50 bg-cyan-accent/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-accent hover:bg-cyan-accent/20 cursor-pointer"
          >
            Evaluate Co-Location Potential
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-2 text-left">Regional Node / Grid Zone</th>
              <th className="py-2 text-left">Governing TSO</th>
              <th className="py-2 text-right">Hidden Capacity Headroom</th>
              <th className="py-2 text-left">Redispatch & Curtailment Risk</th>
              <th className="py-2 text-right">Co-location Opportunity Index</th>
              <th className="py-2 text-left">Time-to-Connect Estimate</th>
              <th className="py-2 text-right">Siting Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map(({ zone, score, coLocationIndex }) => {
              const s = nodeClassStyles(zone.nodeClass);
              const risk = riskLabel(zone.redispatchRiskPct);
              const ttc = timeToConnectEstimate(zone.timeToEnergizeMonths);
              return (
                <tr key={zone.code}>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{zone.name} — {zone.country}</div>
                        <div className="text-[10px] font-mono-data text-muted-foreground truncate">
                          {zone.regions.slice(0, 2).join(", ")}{zone.regions.length > 2 ? "…" : ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 font-mono-data text-muted-foreground">{zone.name}</td>
                  <td className="py-2 text-right font-mono-data">{zone.headroomMw.toLocaleString()} MW</td>
                  <td className="py-2">
                    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${risk.chip}`}>
                      {risk.label} · {zone.redispatchRiskPct}%
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-elevated sm:block">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-accent to-green-accent" style={{ width: `${coLocationIndex}%` }} />
                      </div>
                      <span className="font-mono-data">{coLocationIndex}%</span>
                    </div>
                  </td>
                  <td className={`py-2 text-xs font-medium ${ttc.tone}`}>{ttc.text}</td>
                  <td className="py-2 text-right">
                    <span className="font-display text-base font-bold text-cyan-accent">{score}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 border-t border-border/40 pt-3 text-[10px] font-mono-data text-muted-foreground">
        Active validation feeds{country ? ` for ${country}` : ""}: {activeFeeds.join(" · ")}
      </div>

      {calcOpen && <CoLocationCalculator onClose={() => setCalcOpen(false)} />}
    </section>
  );
}



