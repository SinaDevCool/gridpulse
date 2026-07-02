import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, MapPin, ExternalLink, ShieldCheck } from "lucide-react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ArticleRow } from "@/components/site/ArticleCard";
import { FollowButton } from "@/components/site/FollowButton";
import { DemoBadge, provenanceVariant } from "@/components/site/DemoBadge";
import {
  articlesQuery,
  projectBySlugQuery,
  projectsQuery,
} from "@/lib/gridpulse-repo";

export const Route = createFileRoute("/projects/$slug")({
  loader: async ({ params, context }) => {
    const project = await context.queryClient.ensureQueryData(projectBySlugQuery(params.slug));
    if (!project) throw notFound();
    return { project };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.project.name} — GridPulse` },
          {
            name: "description",
            content: `${loaderData.project.capacityMw} MW / ${loaderData.project.capacityMwh} MWh ${loaderData.project.technology} project in ${loaderData.project.location}.`,
          },
          { property: "og:title", content: `${loaderData.project.name} — GridPulse` },
          {
            property: "og:description",
            content: `${loaderData.project.capacityMw} MW BESS · ${loaderData.project.location} · ${loaderData.project.status}`,
          },
        ]
      : [],
  }),
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Couldn't load this project</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Link to="/projects" className="mt-6 inline-block text-cyan-accent">
          ← Back to projects
        </Link>
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
        <div className="mt-3 h-4 w-1/3 rounded bg-surface" />
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-surface" />
          ))}
        </div>
      </div>
      <SiteFooter />
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">Project not found</h1>
        <Link to="/projects" className="mt-6 inline-block text-cyan-accent">
          ← Back to projects
        </Link>
      </div>
      <SiteFooter />
    </div>
  ),
  component: GatedProjectDetail,
});

function GatedProjectDetail() {
  return (
    <AuthWall
      title="Sign in to view project deep-dives"
      message="Create a free account to see full project profiles, verified sources, and add projects to your watchlist."
    >
      <ProjectDetail />
    </AuthWall>
  );
}

function ProjectDetail() {
  const { slug } = Route.useParams();
  const { data: p } = useSuspenseQuery(projectBySlugQuery(slug));
  const { data: articles = [] } = useSuspenseQuery(articlesQuery());
  const { data: projects = [] } = useSuspenseQuery(projectsQuery());
  if (!p) throw notFound();
  const related = articles
    .filter((a) => a.relatedProjectIds?.includes(p.id) || a.region === p.region)
    .slice(0, 4);
  const similar = projects
    .filter((x) => x.id !== p.id && (x.chemistry ?? x.technology) === (p.chemistry ?? p.technology))
    .slice(0, 4);
  const duration = p.capacityMw > 0 ? (p.capacityMwh / p.capacityMw).toFixed(1) : "—";
  const verifiedDate = p.lastVerifiedAt
    ? new Date(p.lastVerifiedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;

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
          <DemoBadge variant={provenanceVariant(p.sourceType, p.verificationStatus)} />
          {verifiedDate && p.verificationStatus !== "demo" && (
            <span className="inline-flex items-center gap-1 rounded border border-green-accent/40 bg-green-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-green-accent">
              <ShieldCheck className="h-3 w-3" /> Verified {verifiedDate}
            </span>
          )}
          <FollowButton targetType="project" targetKey={p.slug ?? p.id} targetLabel={p.name} size="sm" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{p.developer || "Developer TBD"}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{p.location}</span>
          <span>·</span>
          <span>COD {p.cod || "TBD"}</span>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Stat label="Power" value={`${p.capacityMw.toLocaleString()} MW`} />
          <Stat label="Energy" value={`${p.capacityMwh.toLocaleString()} MWh`} />
          <Stat label="Duration" value={`${duration} hr`} />
          <Stat label="Chemistry" value={p.chemistry ?? p.technology} />
        </div>

        {p.description && (
          <div className="mt-8 rounded-xl border border-border/60 bg-surface/40 p-6">
            <h2 className="font-display text-lg font-bold">Project overview</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.description}</p>
          </div>
        )}

        <div className="mt-8 grid gap-x-8 gap-y-1 md:grid-cols-2">
          <DetailRow k="Developer" v={p.developer || "—"} />
          <DetailRow k="Owner" v={p.owner || "—"} />
          <DetailRow k="Operator" v={p.operator || "—"} />
          <DetailRow k="Offtaker" v={p.offtaker || "—"} />
          <DetailRow k="Use case" v={p.useCase || "—"} />
          <DetailRow k="Technology" v={p.technology} />
          <DetailRow k="Country" v={p.country} />
          <DetailRow k="Region" v={p.region} />
          <DetailRow k="Coordinates" v={`${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`} />
          <DetailRow k="Status" v={p.status} />
        </div>

        <section className="mt-10 rounded-xl border border-border/60 bg-surface/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Sources</h2>
            {verifiedDate && (
              <span className="text-xs text-muted-foreground">Last verified {verifiedDate}</span>
            )}
          </div>
          {p.sourceUrls && p.sourceUrls.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {p.sourceUrls.map((u) => {
                let host = u;
                try { host = new URL(u).host.replace(/^www\./, ""); } catch { /* keep raw */ }
                return (
                  <li key={u}>
                    <a
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-cyan-accent hover:underline break-all"
                    >
                      <ExternalLink className="h-3 w-3 flex-none" />
                      <span>{host}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No public sources attached yet. GridPulse tracks this project from operator filings and internal verification.
            </p>
          )}
        </section>

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
            <h2 className="font-display text-xl font-bold tracking-tight">
              Similar projects ({p.chemistry ?? p.technology})
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {similar.map((s) => (
                <Link
                  key={s.id}
                  to="/projects/$slug"
                  params={{ slug: s.slug ?? s.id }}
                  className="glass-card rounded-lg p-4 hover-lift"
                >
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
      <span className="font-mono-data text-right">{v}</span>
    </div>
  );
}
