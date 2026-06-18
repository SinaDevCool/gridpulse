import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Flame } from "lucide-react";
import { categoryStyles, type Article } from "@/lib/gridpulse-data";
import { TimeAgo } from "@/components/site/TimeAgo";

export function CategoryBadge({ category }: { category: Article["category"] }) {
  const s = categoryStyles[category];
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] ${s.className}`}>
      {category === "breaking" && <Flame className="h-2.5 w-2.5" />}
      {s.label}
    </span>
  );
}

export function FeaturedCard({ article }: { article: Article }) {
  return (
    <Link
      to="/news/$slug"
      params={{ slug: article.slug }}
      className="group relative flex flex-col overflow-hidden rounded-xl glass-card hover-lift cursor-pointer"
    >
      <div className="relative h-44 overflow-hidden border-b border-border/50">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--cyan-accent) 25%, var(--surface)) 0%, var(--surface-elevated) 60%, var(--background) 100%)",
          }}
        />
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/90 to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <CategoryBadge category={article.category} />
          {article.verified && (
            <span className="inline-flex items-center gap-1 rounded border border-green-accent/40 bg-green-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-green-accent">
              <CheckCircle2 className="h-2.5 w-2.5" /> VERIFIED
            </span>
          )}
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono-data text-muted-foreground">
          <span>{article.source.name}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> <TimeAgo minutesAgo={article.minutesAgo} />
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-semibold leading-snug tracking-tight text-foreground group-hover:text-cyan-accent transition-colors">
          {article.headline}
        </h3>
        <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{article.summary}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {article.tags.slice(0, 3).map((t) => (
            <span key={t} className="tag-chip">{t}</span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground font-mono-data">
          <span>{article.author}</span>
          <span>{article.readMinutes} min read</span>
        </div>
      </div>
    </Link>
  );
}

export function ArticleRow({ article }: { article: Article }) {
  return (
    <Link
      to="/news/$slug"
      params={{ slug: article.slug }}
      className="group block py-5 first:pt-0 cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <CategoryBadge category={article.category} />
        {article.verified && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-accent">
            <CheckCircle2 className="h-3 w-3" /> Verified
          </span>
        )}
        <span className="text-[11px] text-muted-foreground font-mono-data ml-auto">
          {article.source.name} · <TimeAgo minutesAgo={article.minutesAgo} />
        </span>
      </div>
      <h3 className="mt-2 font-display text-lg font-semibold leading-snug tracking-tight text-foreground group-hover:text-cyan-accent transition-colors md:text-xl">
        {article.headline}
      </h3>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{article.summary}</p>
      <div className="mt-3 rounded-md border border-l-2 border-border/60 border-l-cyan-accent/60 bg-surface/40 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider text-cyan-accent/90">Why this matters · </span>
        {article.whyItMatters}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-mono-data">
        <span>{article.author}</span>
        <span>·</span>
        <span>{article.readMinutes} min read</span>
        <span>·</span>
        <span>{article.region}</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {article.tags.slice(0, 3).map((t) => (
            <span key={t} className="tag-chip">{t}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
