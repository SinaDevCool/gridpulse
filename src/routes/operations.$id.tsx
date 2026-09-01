import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Zap } from "lucide-react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { OperationsWorkspace } from "@/features/operations/OperationsWorkspace";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { listAnalyticsJobs } from "@/lib/analytics-api";
import { shadowVerificationResultSchema } from "@/features/analytics/contracts";
export const Route = createFileRoute("/operations/$id")({ component: OperationsProject });
function OperationsProject() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["operations-workspace", id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [site, jobs] = await Promise.all([
        supabase
          .from("candidate_sites")
          .select("id,name,requested_import_mw,likely_network_operator")
          .eq("id", id)
          .single(),
        listAnalyticsJobs(200),
      ]);
      if (site.error) throw site.error;
      const result = jobs
        .filter((job) => job.status === "succeeded" && job.job_type === "shadow_verification")
        .map((job) => shadowVerificationResultSchema.safeParse(job.result_payload))
        .find((parsed) => parsed.success && parsed.data.snapshot.facility_id === id);
      return {
        site: site.data,
        shadow: result?.success ? result.data : null,
      };
    },
  });
  return (
    <AppShell requireAuth>
      <main id="main-content" className="section-page activation-page">
        <Link to="/operations" className="back-link">
          <ArrowLeft aria-hidden="true" />
          All Operations Projects
        </Link>
        {query.isLoading ? (
          <p role="status" aria-live="polite">
            Building Operations Workspace…
          </p>
        ) : query.error || !query.data ? (
          <div className="workspace-error" role="alert">
            <h1>Operations Workspace Unavailable</h1>
            <p>Check your connection and project access, then try again.</p>
            <button type="button" className="secondary-button" onClick={() => void query.refetch()}>
              Retry Loading
            </button>
          </div>
        ) : (
          <>
            <PageHeading
              eyebrow="Power Operations"
              title={query.data.site.name || "Untitled Operations Project"}
              description="Shadow monitoring and restriction-response rehearsal. This interface issues no physical control commands."
              action={
                <Link to="/activation/$id" params={{ id }} className="secondary-button">
                  <Zap size={15} aria-hidden="true" />
                  Open Activation
                </Link>
              }
            />
            <OperationsWorkspace result={query.data.shadow} />
          </>
        )}
      </main>
    </AppShell>
  );
}
