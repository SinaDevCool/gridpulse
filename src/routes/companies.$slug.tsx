import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Building2 } from "lucide-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ArticleRow } from "@/components/site/ArticleCard";
import { FollowButton } from "@/components/site/FollowButton";
import { articlesQuery, projectsQuery } from "@/lib/gridpulse-repo";
import { deriveCompanies, projectsForCompany, articlesForCompany } from "@/lib/companies";

export const Route = createFileRoute("/companies/$slug")({
  loader: async ({ params, context }) => {
    const projects = await context.queryClient.ensureQueryData(projectsQuery());
    const company = deriveCompanies(projects).find((c) => c.slug === params.slug);
    if (!company) throw notFound();
    return { company };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.company.name} — GridPulse` },
          {
            name: "description",
            content: `${loaderData.company.name}: ${loaderData.company.projectCount} BESS project${loaderData.company.projectCount === 1 ? "" : "s"}, ${loaderData.company.totalMw.toLocaleString()} MW / ${loaderData.company.totalMwh.toLocaleString()} MWh tracked by GridPulse.`,
          },
          { property: "og:title", content: `${loaderData.company.name} — GridPulse` },
        ]
      : [],
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Couldn't load this company</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Link to="/companies" className="mt-6 inline-block text-cyan-accent">← All companies</Link>
      </div>
      <SiteFooter />
    </div>
  ),
  pendingComponent: () => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-[1100px] px-4 py-12 lg:px-8 animate-pulse">
        <div className="h-3 w-24 rounded bg-surface" />
        <div className="mt-5 h-10 w-2/3 rounded bg-surface" />
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-20 rounded-xl bg-surface" />))}
        </div>
      </div>
      <SiteFooter />
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <Building2 className="mx-auto h-10 w-10 text-muted-foreground opacity-50" />
        <h1 className="mt-4 font-display text-3xl font-bold">Company not found</h1>
        <Link to="/companies" className="mt-6 inline-block text-cyan-accent">← All companies</Link>
      </div>
      <SiteFooter />
    </div>
  ),
  component: CompanyDetail,
});

function CompanyDetail() {
  const { slug } = Route.useParams();
  const { data: projects = [] } = useSuspenseQuery(projectsQuery());
  const { data: articles = [] } = useSuspenseQuery(articlesQuery());
  const company = deriveCompanies(projects).find((c) => c.slug === slug);
  if (!company) throw notFound();

  const linkedProjects = projectsForCompany(projects, company);
  const related = articlesForCompany(articles, company).slice(0, 8);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 py-12 lg:px-8">
        <Link to="/companies" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-cyan-accent">
          <ArrowLeft className="h-3 w-3" /> All companies
        </Link>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight">{company.name}</h1>
          <FollowButton targetType="company" targetKey={company.slug} targetLabel={company.name} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {company.roles.map((r) => (
            <span key={r} className="rounded border border-border bg-surface/60 px-2 py-0.5 uppercase tracking-wider">{r}</span>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Stat label="Projects" value={String(company.projectCount)} />
          <Stat label="Total Power" value={`${company.totalMw.toLocaleString()} MW`} />
          <Stat label="Total Energy" value={`${company.totalMwh.toLocaleString()} MWh`} />
          <Stat label="Countries" value={String(company.countries.length)} />
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Panel title="Status breakdown">
            {Object.keys(company.statusBreakdown).length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects linked.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {Object.entries(company.statusBreakdown).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-mono-data">{v}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Technologies">
            {company.chemistries.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {company.chemistries.map((c) => (
                  <span key={c} className="rounded border border-border bg-surface/60 px-2 py-0.5 text-xs">{c}</span>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Regions">
            {company.regions.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {company.regions.map((r) => (
                  <span key={r} className="rounded border border-border bg-surface/60 px-2 py-0.5 text-xs">{r}</span>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Countries">
            {company.countries.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {company.countries.map((c) => (
                  <span key={c} className="rounded border border-border bg-surface/60 px-2 py-0.5 text-xs">{c}</span>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <section className="mt-12">
          <h2 className="font-display text-xl font-bold tracking-tight">Linked projects</h2>
          {linkedProjects.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No projects linked.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Project</th>
                    <th className="px-4 py-3 text-right">MW</th>
                    <th className="px-4 py-3 text-right">MWh</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {linkedProjects.map((p) => (
                    <tr key={p.id} className="hover:bg-surface/40">
                      <td className="px-4 py-3">
                        <Link to="/projects/$slug" params={{ slug: p.slug ?? p.id }} className="text-foreground hover:text-cyan-accent font-medium">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-mono-data">{p.capacityMw.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono-data">{p.capacityMwh.toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{p.status}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs"><span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{p.location}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="font-display text-xl font-bold tracking-tight">Related news</h2>
          {related.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No recent articles mention {company.name} yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-border/50">
              {related.map((a) => <ArticleRow key={a.id} article={a} />)}
            </div>
          )}
        </section>
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

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/40 p-5">
      <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}
