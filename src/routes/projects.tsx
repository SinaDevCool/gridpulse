import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { type Project } from "@/lib/gridpulse-data";
import { projectsQuery } from "@/lib/gridpulse-repo";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Project Database — GridPulse" },
      { name: "description", content: "Verified database of utility-scale battery energy storage projects worldwide. Filter by status, region, technology, and capacity." },
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

function ProjectsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("All");
  const [region, setRegion] = useState<string>("All");
  const [tech, setTech] = useState<string>("All");
  const { data: projects = [], isLoading } = useQuery(projectsQuery());

  const statuses = ["All", ...Array.from(new Set(projects.map((p) => p.status)))];
  const regions = ["All", ...Array.from(new Set(projects.map((p) => p.region)))];
  const techs = ["All", ...Array.from(new Set(projects.map((p) => p.technology)))];

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return projects.filter((p: Project) => {
      if (status !== "All" && p.status !== status) return false;
      if (region !== "All" && p.region !== region) return false;
      if (tech !== "All" && p.technology !== tech) return false;
      if (ql && !(p.name + " " + p.developer + " " + p.location).toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [q, status, region, tech, projects]);

  const totalMw = list.reduce((s, p) => s + p.capacityMw, 0);
  const totalMwh = list.reduce((s, p) => s + p.capacityMwh, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-12 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">Project Database</div>
        <h1 className="mt-2 font-display text-3xl md:text-5xl font-bold tracking-tight">Global BESS projects</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Live · {projects.length} verified utility-scale projects. Click any row for full specs.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Stat label="Projects" value={list.length.toString()} />
          <Stat label="Total Capacity" value={`${totalMw.toLocaleString()} MW`} />
          <Stat label="Total Energy" value={`${totalMwh.toLocaleString()} MWh`} />
        </div>

        {/* Map placeholder */}
        <div className="mt-6 relative h-64 overflow-hidden rounded-xl border border-border bg-surface/60">
          <div className="absolute inset-0 bg-grid opacity-40" />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, color-mix(in oklab, var(--cyan-accent) 15%, transparent), transparent 70%)" }} />
          {list.map((p) => {
            const x = ((p.lng + 180) / 360) * 100;
            const y = ((90 - p.lat) / 180) * 100;
            return (
              <Link
                key={p.id}
                to="/projects/$id"
                params={{ id: p.id }}
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

        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface/60 px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, developer, or location…" className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground" />
          </div>
          <Select label="Status" value={status} onChange={setStatus} options={statuses} />
          <Select label="Region" value={region} onChange={setRegion} options={regions} />
          <Select label="Tech" value={tech} onChange={setTech} options={techs} />
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface/60 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Project</th>
                <th className="px-4 py-3 text-left">Developer</th>
                <th className="px-4 py-3 text-right">MW</th>
                <th className="px-4 py-3 text-right">MWh</th>
                <th className="px-4 py-3 text-left">Tech</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">COD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">Loading projects…</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">No projects match your filters.</td></tr>
              ) : list.map((p) => (
                <tr key={p.id} className="hover:bg-surface/40 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <Link to="/projects/$id" params={{ id: p.id }} className="text-foreground hover:text-cyan-accent font-medium">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.developer}</td>
                  <td className="px-4 py-3 text-right font-mono-data">{p.capacityMw.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono-data">{p.capacityMwh.toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.technology}</td>
                  <td className="px-4 py-3 text-muted-foreground inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.location}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider ${statusColors[p.status]}`}>
                      {p.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono-data">{p.cod}</td>
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
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent text-sm focus:outline-none cursor-pointer">
        {options.map((o) => <option key={o} value={o} className="bg-surface">{o}</option>)}
      </select>
    </label>
  );
}
