import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, LockKeyhole } from "lucide-react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { readiness, type CandidateSite, type Evidence } from "@/lib/assessment-model";
export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: ReportsPage,
});
function ReportsPage() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["report-index", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [sites, evidence] = await Promise.all([
        supabase
          .from("candidate_sites")
          .select("*")
          .neq("assessment_status", "archived")
          .order("created_at", { ascending: false }),
        supabase.from("assessment_evidence").select("*"),
      ]);
      if (sites.error) throw sites.error;
      if (evidence.error) throw evidence.error;
      return (sites.data as CandidateSite[]).map((site) => ({
        site,
        state: readiness((evidence.data as Evidence[]).filter((item) => item.site_id === site.id)),
      }));
    },
  });
  const items = query.data ?? [];
  return (
    <AppShell requireAuth>
      <main id="main-content" className="section-page">
        <PageHeading
          eyebrow="Decision outputs"
          title="Connection options assessment deliverables"
          description="Open the versioned operator package, evidence register, scenario comparison and management decision memo for each project."
        />
        {query.isLoading ? (
          <div className="portfolio-state">
            <div className="loading-spinner" />
            Loading reports…
          </div>
        ) : items.length === 0 ? (
          <div className="portfolio-state">
            <FileText />
            <h2>No projects available</h2>
            <Link to="/assessments/new" className="primary-button">
              Create project
            </Link>
          </div>
        ) : (
          <div className="report-index-grid">
            {items.map(({ site, state }) => (
              <article className="report-index-card" key={site.id}>
                <div>
                  {state.ready ? <CheckCircle2 className="ready-icon" /> : <LockKeyhole />}
                  <span className={state.ready ? "status collected" : "status warning-text"}>
                    {state.ready ? "Ready" : "Locked"}
                  </span>
                </div>
                <p className="context-label">{site.id.slice(0, 8)}</p>
                <h2>{site.name}</h2>
                <p>{state.completed}/3 readiness requirements complete</p>
                {!state.ready ? (
                  <small>
                    <AlertTriangle />
                    The current package is incomplete. Missing evidence and operator-validation
                    gates remain visible in the workspace.
                  </small>
                ) : null}
                <Link to="/assessments/$id" params={{ id: site.id }}>
                  Open assessment deliverables <ArrowRight />
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
