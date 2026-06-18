import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, MapPin } from "lucide-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ArticleRow } from "@/components/site/ArticleCard";
import {
  articlesQuery,
  projectByExternalIdQuery,
  projectsQuery,
} from "@/lib/gridpulse-repo";

export const Route = createFileRoute("/projects/$id")({
  loader: async ({ params, context }) => {
    const project = await context.queryClient.ensureQueryData(projectByExternalIdQuery(params.id));
    if (!project) throw notFound();
    return { project };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.project.name} — GridPulse` },
          { name: "description", content: `${loaderData.project.capacityMw} MW / ${loaderData.project.capacityMwh} MWh ${loaderData.project.technology} project in ${loaderData.project.location}.` },
        ]
      : [],
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Couldn't load this project</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Link to="/projects" className="mt-6 inline-block text-cyan-accent">← Back to projects</Link>
      </div>
      <SiteFooter />
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">Project not found</h1>
        <Link to="/projects" className="mt-6 inline-block text-cyan-accent">← Back to projects</Link>
      </div>
      <SiteFooter />
    </div>
  ),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const { data: p } = useSuspenseQuery(projectByExternalIdQuery(id));
  const { data: articles = [] } = useSuspenseQuery(articlesQuery());
  const { data: projects = [] } = useSuspenseQuery(projectsQuery());
  if (!p) throw notFound();
  const related = articles.filter((a) => a.relatedProjectIds?.includes(p.id) || a.region === p.region).slice(0, 4);
  const similar = projects.filter((x) => x.id !== p.id && x.technology === p.technology).slice(0, 4);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 py-12 lg:px-8">
        <Link to="/projects" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-cyan-accent">
          <ArrowLeft className="h-3 w-3" /> All projects
        </Link>

        <div className="mt-5 flex flex-wrap items-baseline gap-3">
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight">{p.name}</h1>
          <span className="rounded border border-cyan-accent/40 bg-cyan-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-accent">
            {p.status}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{p.developer}</span> <span>·</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{p.location}</span>
          <span>·</span> <span>COD {p.cod}</span>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Stat label="Power" value={`${p.capacityMw} MW`} />
          <Stat label="Energy" value={`${p.capacityMwh.toLocaleString()} MWh`} />
          <Stat label="Duration" value={`${(p.capacityMwh / p.capacityMw).toFixed(1)} hr`} />
          <Stat label="Technology" value={p.technology} />
        </div>

        {p.description && (
          <div className="mt-8 rounded-xl border border-border/60 bg-surface/40 p-6">
            <h2 className="font-display text-lg font-bold">Project overview</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.description}</p>
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <DetailRow k="Country" v={p.country} />
          <DetailRow k="Region" v={p.region} />
          <DetailRow k="Latitude" v={p.lat.toString()} />
          <DetailRow k="Longitude" v={p.lng.toString()} />
        </div>

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-bold tracking-tight">Related news</h2>
            <div className="mt-4 divide-y divide-border/50">
              {related.map((a) => <ArticleRow key={a.id} article={a} />)}
            </div>
          </section>
        )}

        {similar.length > 0 && (
          <section className="mt-12 border-t border-border/50 pt-8">
            <h2 className="font-display text-xl font-bold tracking-tight">Similar projects ({p.technology})</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {similar.map((s) => (
                <Link key={s.id} to="/projects/$id" params={{ id: s.id }} className="glass-card rounded-lg p-4 hover-lift">
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground font-mono-data">
                    {s.capacityMw} MW · {s.location}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
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

function DetailRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-2 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono-data">{v}</span>
    </div>
  );
}
