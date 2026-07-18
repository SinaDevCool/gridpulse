import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { articlesQuery, projectsQuery } from "@/lib/gridpulse-repo";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — GridPulse" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const articles = useQuery(articlesQuery());
  const projects = useQuery(projectsQuery());

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-12 lg:px-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your GridPulse intelligence dashboard.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface/40 p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Articles tracked</div>
            <div className="mt-2 font-display text-3xl font-bold text-cyan-accent">
              {articles.data?.length ?? "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface/40 p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Projects in registry</div>
            <div className="mt-2 font-display text-3xl font-bold text-cyan-accent">
              {projects.data?.length ?? "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface/40 p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Account</div>
            <div className="mt-2 text-sm text-foreground truncate">{user?.email}</div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
