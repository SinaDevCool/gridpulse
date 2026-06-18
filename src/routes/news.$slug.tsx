import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Clock, Share2, Twitter, Linkedin, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ArticleRow, CategoryBadge } from "@/components/site/ArticleCard";
import { TimeAgo } from "@/components/site/TimeAgo";
import { articles, getArticleBySlug, getProjectById, type Project } from "@/lib/gridpulse-data";

export const Route = createFileRoute("/news/$slug")({
  loader: ({ params }) => {
    const article = getArticleBySlug(params.slug);
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.article.headline} — GridPulse` },
          { name: "description", content: loaderData.article.summary },
          { property: "og:title", content: loaderData.article.headline },
          { property: "og:description", content: loaderData.article.summary },
        ]
      : [],
  }),
  notFoundComponent: () => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">Article not found</h1>
        <p className="mt-2 text-muted-foreground">This story may have been removed or the link is incorrect.</p>
        <Link to="/news" className="mt-6 inline-block text-cyan-accent">← Back to all news</Link>
      </div>
      <SiteFooter />
    </div>
  ),
  component: ArticlePage,
});

function ArticlePage() {
  const { article } = Route.useLoaderData();

  const related = articles.filter((a) => a.id !== article.id && a.category === article.category).slice(0, 3);
  const relatedProjects: Project[] = (article.relatedProjectIds ?? []).map(getProjectById).filter((p): p is Project => Boolean(p));

  function share(kind: "twitter" | "linkedin" | "copy") {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `${article.headline} — via GridPulse`;
    if (kind === "twitter") window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
    else if (kind === "linkedin") window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, "_blank");
    else {
      navigator.clipboard?.writeText(url);
      toast.success("Link copied to clipboard.");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <article className="mx-auto max-w-[820px] px-4 py-12 lg:px-8">
        <Link to="/news" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-cyan-accent">
          <ArrowLeft className="h-3 w-3" /> All news
        </Link>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <CategoryBadge category={article.category} />
          {article.verified && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-accent">
              <CheckCircle2 className="h-3 w-3" /> VERIFIED
            </span>
          )}
          <span className="text-[11px] text-muted-foreground font-mono-data">
            {article.source.name} · <TimeAgo minutesAgo={article.minutesAgo} />
          </span>
        </div>

        <h1 className="mt-4 font-display text-3xl md:text-5xl font-bold leading-[1.1] tracking-tight">
          {article.headline}
        </h1>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-mono-data">
          <span>By {article.author}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {article.readMinutes} min read</span>
          <span>·</span>
          <span>{article.region}</span>
        </div>

        <div
          className="mt-8 h-64 rounded-xl border border-border/50 overflow-hidden relative"
          style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--cyan-accent) 28%, var(--surface)) 0%, var(--surface-elevated) 60%, var(--background) 100%)" }}
        >
          <div className="absolute inset-0 bg-grid opacity-50" />
        </div>

        <div className="mt-6 rounded-md border border-l-2 border-border/60 border-l-cyan-accent/60 bg-surface/40 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-semibold uppercase tracking-wider text-cyan-accent/90 text-xs">Why this matters · </span>
          {article.whyItMatters}
        </div>

        <div className="prose prose-invert mt-8 max-w-none text-foreground/90">
          {article.content.split("\n\n").map((p: string, i: number) => (
            <p key={i} className="text-base leading-relaxed mb-5">{p}</p>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {article.tags.map((t: string) => (
            <Link key={t} to="/news" search={{ q: t }} className="tag-chip hover:border-cyan-accent/50 hover:text-cyan-accent">
              #{t}
            </Link>
          ))}
        </div>

        <div className="mt-8 flex items-center gap-2 border-t border-border/50 pt-6">
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Share2 className="h-3 w-3" /> Share</span>
          <button onClick={() => share("twitter")} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:border-cyan-accent/40 cursor-pointer">
            <Twitter className="h-3 w-3" /> X / Twitter
          </button>
          <button onClick={() => share("linkedin")} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:border-cyan-accent/40 cursor-pointer">
            <Linkedin className="h-3 w-3" /> LinkedIn
          </button>
          <button onClick={() => share("copy")} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:border-cyan-accent/40 cursor-pointer">
            <LinkIcon className="h-3 w-3" /> Copy link
          </button>
        </div>

        {relatedProjects.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-bold tracking-tight">Related projects</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {relatedProjects.map((p: Project) => (
                <Link key={p.id} to="/projects/$id" params={{ id: p.id }} className="glass-card rounded-lg p-4 hover-lift">
                  <div className="text-sm font-medium text-foreground">{p.name}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground font-mono-data">
                    {p.capacityMw} MW · {p.technology} · {p.location}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-12 border-t border-border/50 pt-8">
            <h2 className="font-display text-xl font-bold tracking-tight">Related stories</h2>
            <div className="mt-4 divide-y divide-border/50">
              {related.map((a) => <ArticleRow key={a.id} article={a} />)}
            </div>
          </section>
        )}
      </article>
      <SiteFooter />
    </div>
  );
}
