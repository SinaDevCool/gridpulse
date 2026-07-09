import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Search, MapPin, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { isLiveProject, type Project } from "@/lib/gridpulse-data";
import { projectsQuery } from "@/lib/gridpulse-repo";

const searchSchema = z.object({
  q: z.string().optional().default(""),
  status: z.string().optional().default("All"),
  region: z.string().optional().default("All"),
  country: z.string().optional().default("All"),
  chemistry: z.string().optional().default("All"),
  developer: z.string().optional().default("All"),
  mwMin: z.coerce.number().optional(),
  mwMax: z.coerce.number().optional(),
  mwhMin: z.coerce.number().optional(),
  mwhMax: z.coerce.number().optional(),
  codYear: z.string().optional().default("All"),
});

export const Route = createFileRoute("/projects/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Project Database — GridPulse" },
      { name: "description", content: "Verified database of utility-scale battery energy storage projects worldwide. Filter by region, country, status, chemistry, developer, and capacity." },
    ],
  }),
  component: ProjectsPage,
});

const statusColors: Record<Project["status"], string> = {
  Permitting: "bg-amber-accent/15 text-amber-accent border-amber-accent/40",
  Construction: "bg-cyan-accent/15 text-cyan-accent border-cyan-accent/40",
  Commissioning: "bg-green-accent/15 text-green-accent border-green-accent/40",
  Operational: "bg-green-accent/15 text-green-accent border-green-accent/40",
};

function codYearOf(p: Project): string {
  const m = (p.cod || "").match(/\b(20\d{2})\b/);
  return m ? m[1] : "Unknown";
}

function uniq(arr: (string | null | undefined)[]): string[] {
  return Array.from(new Set(arr.filter((x): x is string => !!x && x.trim().length > 0))).sort();
}

function ProjectsPage() {
  const sp = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: allProjects = [], isLoading, isError, error, refetch } = useQuery(projectsQuery());
  const projects = useMemo(() => allProjects.filter(isLiveProject), [allProjects]);

  const set = (patch: Partial<typeof sp>) =>
    navigate({ search: (prev: typeof sp) => ({ ...prev, ...patch }), replace: true });


  const statuses = ["All", ...uniq(projects.map((p) => p.status))];
  const regions = ["All", ...uniq(projects.map((p) => p.region))];
  const countries = ["All", ...uniq(projects.map((p) => p.country))];
  const chemistries = ["All", ...uniq(projects.map((p) => p.chemistry ?? p.technology))];
  const developers = ["All", ...uniq(projects.map((p) => p.developer))];
  const codYears = ["All", ...uniq(projects.map(codYearOf))];

  const list = useMemo(() => {
    const ql = sp.q.trim().toLowerCase();
    return projects.filter((p: Project) => {
      if (sp.status !== "All" && p.status !== sp.status) return false;
      if (sp.region !== "All" && p.region !== sp.region) return false;
      if (sp.country !== "All" && p.country !== sp.country) return false;
      const chem = p.chemistry ?? p.technology;
      if (sp.chemistry !== "All" && chem !== sp.chemistry) return false;
      if (sp.developer !== "All" && p.developer !== sp.developer) return false;
      if (sp.codYear !== "All" && codYearOf(p) !== sp.codYear) return false;
      if (sp.mwMin !== undefined && p.capacityMw < sp.mwMin) return false;
      if (sp.mwMax !== undefined && p.capacityMw > sp.mwMax) return false;
      if (sp.mwhMin !== undefined && p.capacityMwh < sp.mwhMin) return false;
      if (sp.mwhMax !== undefined && p.capacityMwh > sp.mwhMax) return false;
      if (ql && !(p.name + " " + p.developer + " " + p.location + " " + (p.owner ?? "") + " " + (p.operator ?? "")).toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [sp, projects]);

  const totalMw = list.reduce((s, p) => s + p.capacityMw, 0);
  const totalMwh = list.reduce((s, p) => s + p.capacityMwh, 0);

  const activeFilterCount = [
    sp.status, sp.region, sp.country, sp.chemistry, sp.developer, sp.codYear,
  ].filter((v) => v && v !== "All").length
    + [sp.mwMin, sp.mwMax, sp.mwhMin, sp.mwhMax].filter((v) => v !== undefined).length;

  const clearAll = () => navigate({
    search: { q: "", status: "All", region: "All", country: "All", chemistry: "All", developer: "All", codYear: "All" },
    replace: true,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-12 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">Project Database</div>
        <h1 className="mt-2 font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">Global BESS projects</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Live tracking of verified utility-scale battery energy storage systems (BESS) across global and European grid networks. Data sourced directly from official regulatory registries.
        </p>



        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Stat label="Projects" value={list.length.toString()} />
          <Stat label="Total Power" value={`${totalMw.toLocaleString()} MW`} />
          <Stat label="Total Energy" value={`${totalMwh.toLocaleString()} MWh`} />
        </div>

        <div className="mt-6 relative h-64 overflow-hidden rounded-xl border border-border bg-surface/60">
          <div className="absolute inset-0 bg-grid opacity-40" />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, color-mix(in oklab, var(--cyan-accent) 15%, transparent), transparent 70%)" }} />
          {list.map((p) => {
            const x = ((p.lng + 180) / 360) * 100;
            const y = ((90 - p.lat) / 180) * 100;
            return (
              <Link
                key={p.id}
                to="/projects/$slug"
                params={{ slug: p.slug ?? p.id }}
                title={`${p.name} — ${p.capacityMw} MW`}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-cyan-accent shadow-[0_0_12px_var(--cyan-accent)] hover:h-3 hover:w-3 transition-all cursor-pointer"
              />
            );
          })}
          <div className="absolute bottom-3 left-3 text-[10px] uppercase tracking-wider text-muted-foreground font-mono-data">
            Interactive world map · {list.length} projects plotted
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface/60 px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={sp.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="Search name, developer, owner, operator, or location…"
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
            />
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface/60 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear filters ({activeFilterCount})
            </button>
          )}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Select label="Status" value={sp.status} onChange={(v) => set({ status: v })} options={statuses} />
          <Select label="Region" value={sp.region} onChange={(v) => set({ region: v })} options={regions} />
          <Select label="Country" value={sp.country} onChange={(v) => set({ country: v })} options={countries} />
          <Select label="Chemistry" value={sp.chemistry} onChange={(v) => set({ chemistry: v })} options={chemistries} />
          <Select label="Developer" value={sp.developer} onChange={(v) => set({ developer: v })} options={developers} />
          <Select label="COD Year" value={sp.codYear} onChange={(v) => set({ codYear: v })} options={codYears} />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <RangeInput label="MW min" value={sp.mwMin} onChange={(v) => set({ mwMin: v })} placeholder="0" />
          <RangeInput label="MW max" value={sp.mwMax} onChange={(v) => set({ mwMax: v })} placeholder="Any" />
          <RangeInput label="MWh min" value={sp.mwhMin} onChange={(v) => set({ mwhMin: v })} placeholder="0" />
          <RangeInput label="MWh max" value={sp.mwhMax} onChange={(v) => set({ mwhMax: v })} placeholder="Any" />
        </div>

        <div className="mt-6 overflow-x-auto w-full max-w-full rounded-xl border border-border">
          <table className="w-full min-w-[820px] text-sm">

            <thead className="bg-surface/60 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Project</th>
                <th className="px-4 py-3 text-left">Developer</th>
                <th className="px-4 py-3 text-right">MW</th>
                <th className="px-4 py-3 text-right">MWh</th>
                <th className="px-4 py-3 text-left">Chemistry</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">COD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">Loading projects…</td></tr>
              ) : isError ? (
                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">
                  Couldn't load projects: {(error as Error)?.message ?? "unknown error"}.{" "}
                  <button onClick={() => refetch()} className="text-cyan-accent hover:underline">Retry</button>
                </td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">
                  No projects match your filters. <button onClick={clearAll} className="text-cyan-accent hover:underline">Clear all</button>
                </td></tr>
              ) : list.map((p) => (
                <tr key={p.id} className="hover:bg-surface/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link to="/projects/$slug" params={{ slug: p.slug ?? p.id }} className="text-foreground hover:text-cyan-accent font-medium">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.developer || ((p.countryCode === "DE" || p.country === "Germany") ? "Registered Operator Private" : "—")}</td>
                  <td className="px-4 py-3 text-right font-mono-data">{p.capacityMw.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono-data">{p.capacityMwh ? p.capacityMwh.toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.chemistry ? p.chemistry.toUpperCase() : (p.technology || "Unspecified Technology")}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.location}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider ${statusColors[p.status]}`}>
                      {p.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono-data">{p.cod || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border bg-surface/60 px-3 py-2 text-sm">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 bg-transparent text-sm focus:outline-none cursor-pointer">
        {options.map((o) => <option key={o} value={o} className="bg-surface">{o}</option>)}
      </select>
    </label>
  );
}

function RangeInput({ label, value, onChange, placeholder }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border bg-surface/60 px-3 py-2 text-sm">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : Number(v));
        }}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm font-mono-data focus:outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}
