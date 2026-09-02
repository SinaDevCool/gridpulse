import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { ActivationWorkspace } from "@/features/activation/ActivationWorkspace";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { listAnalyticsJobs } from "@/lib/analytics-api";
import { facilityPlanResultSchema } from "@/features/analytics/contracts";

export const Route = createFileRoute("/activation/$id")({ component: ActivationProject });
function ActivationProject() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["activation-workspace", id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [site, envelopes, jobs] = await Promise.all([
        supabase
          .from("candidate_sites")
          .select(
            "id,name,project_type,requested_import_mw,minimum_viable_import_mw,bess_power_mw,bess_energy_mwh,likely_network_operator",
          )
          .eq("id", id)
          .single(),
        supabase
          .from("fca_envelopes")
          .select(
            "id,name,version,status,mode,max_import_mw,valid_from,valid_to,restriction_schedule",
          )
          .eq("site_id", id)
          .order("version", { ascending: false }),
        listAnalyticsJobs(200),
      ]);
      if (site.error) throw site.error;
      if (envelopes.error) throw envelopes.error;
      const plan = jobs
        .filter((job) => job.status === "succeeded" && job.job_type === "facility_plan")
        .filter((job) => {
          const facility = job.input_payload.facility;
          const requirement = job.input_payload.requirement;
          return (typeof facility === "object" && facility !== null && (facility as Record<string, unknown>).site_id === id) ||
            (typeof requirement === "object" && requirement !== null && (requirement as Record<string, unknown>).site_id === id);
        })
        .map((job) => facilityPlanResultSchema.safeParse(job.result_payload))
        .find((parsed) => parsed.success);
      return { site: site.data, envelopes: envelopes.data ?? [], plan: plan?.success ? plan.data : null };
    },
  });
  return (
    <AppShell requireAuth>
      <main id="main-content" className="section-page activation-page">
        <Link to="/activation" className="back-link">
          <ArrowLeft aria-hidden="true" /> All Activation Projects
        </Link>
        {query.isLoading ? (
          <p role="status" aria-live="polite">
            Building Activation Workspace…
          </p>
        ) : query.error || !query.data ? (
          <div className="workspace-error" role="alert">
            <h1>Activation Workspace Unavailable</h1>
            <p>Check your connection and project access, then try again.</p>
            <button type="button" className="secondary-button" onClick={() => void query.refetch()}>
              Retry Loading
            </button>
          </div>
        ) : (
          <>
            <PageHeading
              eyebrow="Power Activation"
              title={query.data.site.name || "Untitled Activation Project"}
              description={`Connection activation strategy for ${query.data.site.likely_network_operator ?? "the responsible network operator"}. Evidence labels distinguish operator inputs from illustrative assumptions.`}
            />
            <ActivationWorkspace plan={query.data.plan} envelopes={query.data.envelopes} />
          </>
        )}
      </main>
    </AppShell>
  );
}
