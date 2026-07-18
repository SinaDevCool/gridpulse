import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { companiesQuery } from "@/lib/companies";

export const Route = createFileRoute("/companies/")({
  head: () => ({
    meta: [
      { title: "Companies — GridPulse" },
      {
        name: "description",
        content:
          "Browse developers, owners, operators, and offtakers across the global utility-scale battery storage market.",
      },
    ],
  }),
  component: CompaniesPage,
});

function CompaniesPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"All" | "developer" | "owner" | "operator" | "offtaker">("All");
  const { data: companies = [], isLoading, isError, error, refetch } = useQuery(companiesQuery());

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return companies.filter((c) => {
      if (role !== "All" && !c.roles.includes(role)) return false;
      if (ql && !c.name.toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [companies, q, role]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-4 py-12 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">
          Company Intelligence
        </div>
        <h1 className="mt-2 font-display text-3xl md:text-5xl font-bold tracking-tight">
          Companies
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Aggregated from verified projects — developers, owners, operators, and offtakers active across the global BESS market. Follow any company to get notified when new articles mention them.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface/60 px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search companies…"
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
            />
          </div>
          <label className="flex items-center gap-2 rounded-md border border-border bg-surface/60 px-3 py-2 text-sm">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="bg-transparent text-sm focus:outline-none"
            >
              {["All", "developer", "owner", "operator", "offtaker"].map((r) => (
                <option key={r} value={r} className="bg-surface">{r}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface/60 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Roles</th>
                <th className="px-4 py-3 text-right">Projects</th>
                <th className="px-4 py-3 text-right">MW</th>
                <th className="px-4 py-3 text-right">MWh</th>
                <th className="px-4 py-3 text-left">Regions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Loading companies…</td></tr>
              ) : isError ? (
                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">
                  Couldn't load companies: {(error as Error)?.message}.{" "}
                  <button onClick={() => refetch()} className="text-cyan-accent hover:underline">Retry</button>
                </td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center">
                  <Building2 className="mx-auto h-7 w-7 text-muted-foreground opacity-50" />
                  <div className="mt-3 text-sm text-muted-foreground">No companies match your filters.</div>
                </td></tr>
              ) : list.map((c) => (
                <tr key={c.slug} className="hover:bg-surface/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link to="/companies/$slug" params={{ slug: c.slug }} className="text-foreground hover:text-cyan-accent font-medium">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{c.roles.join(", ")}</td>
                  <td className="px-4 py-3 text-right font-mono-data">{c.projectCount}</td>
                  <td className="px-4 py-3 text-right font-mono-data">{c.totalMw.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono-data">{c.totalMwh.toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{c.regions.join(", ") || "—"}</td>
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
