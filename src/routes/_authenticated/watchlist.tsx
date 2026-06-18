import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star, X, Building2, Battery } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { listFollows, removeFollow } from "@/utils/follows.functions";

export const Route = createFileRoute("/_authenticated/watchlist")({
  head: () => ({ meta: [{ title: "Watchlist — GridPulse" }] }),
  component: WatchlistPage,
});

type FollowsState = {
  follows: Array<{ id: string; target_type: "company" | "project"; target_key: string; target_label: string | null; created_at: string }>;
  tier: "free" | "pro" | "enterprise";
  limit: number | null;
  used: number;
};

function WatchlistPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listFollows);
  const rmFn = useServerFn(removeFollow);

  const q = useQuery<FollowsState>({
    queryKey: ["follows"],
    queryFn: () => listFn() as Promise<FollowsState>,
  });

  const rmMut = useMutation({
    mutationFn: (v: { target_type: "company" | "project"; target_key: string }) => rmFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["follows"] }),
  });

  const companies = q.data?.follows.filter((f) => f.target_type === "company") ?? [];
  const projects = q.data?.follows.filter((f) => f.target_type === "project") ?? [];
  const limitText = q.data?.limit === null ? "Unlimited" : `${q.data?.used ?? 0} / ${q.data?.limit ?? 0}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1000px] px-4 py-10 lg:px-8">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">Watchlist</div>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Followed companies & projects</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {q.data ? (
                <>Plan: <span className="font-medium text-foreground capitalize">{q.data.tier}</span> · Follows used: <span className="font-mono-data">{limitText}</span></>
              ) : null}
            </p>
          </div>
          {q.data && q.data.tier !== "enterprise" && (
            <Link to="/subscribe" className="rounded-md bg-cyan-accent px-3 py-1.5 text-xs font-medium text-primary-foreground">
              {q.data.tier === "free" ? "Upgrade to Pro (20 follows)" : "Upgrade to Enterprise (unlimited)"}
            </Link>
          )}
        </div>

        {q.isLoading ? (
          <div className="mt-10 text-sm text-muted-foreground">Loading…</div>
        ) : q.error ? (
          <div className="mt-10 text-sm text-destructive">{(q.error as Error).message}</div>
        ) : (q.data?.follows.length ?? 0) === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-border p-12 text-center">
            <Star className="mx-auto h-7 w-7 text-muted-foreground opacity-50" />
            <div className="mt-3 text-sm font-medium">No follows yet</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Open a <Link to="/companies" className="text-cyan-accent">company</Link> or <Link to="/projects" className="text-cyan-accent">project</Link> and tap “Follow” to track it.
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <Section title="Companies" icon={<Building2 className="h-4 w-4" />}>
              {companies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No companies followed.</p>
              ) : (
                <ul className="divide-y divide-border/50 rounded-lg border border-border">
                  {companies.map((f) => (
                    <li key={f.id} className="flex items-center justify-between px-4 py-3">
                      <Link to="/companies/$slug" params={{ slug: f.target_key }} className="text-sm font-medium hover:text-cyan-accent">
                        {f.target_label ?? f.target_key}
                      </Link>
                      <button
                        onClick={() => rmMut.mutate({ target_type: "company", target_key: f.target_key })}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Unfollow"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="Projects" icon={<Battery className="h-4 w-4 rotate-90" />}>
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No projects followed.</p>
              ) : (
                <ul className="divide-y divide-border/50 rounded-lg border border-border">
                  {projects.map((f) => (
                    <li key={f.id} className="flex items-center justify-between px-4 py-3">
                      <Link to="/projects/$slug" params={{ slug: f.target_key }} className="text-sm font-medium hover:text-cyan-accent">
                        {f.target_label ?? f.target_key}
                      </Link>
                      <button
                        onClick={() => rmMut.mutate({ target_type: "project", target_key: f.target_key })}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Unfollow"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
