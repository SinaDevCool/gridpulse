import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Zap } from "lucide-react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/activation")({ component: ActivationIndex });

function ActivationIndex() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["activation-projects", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const result = await supabase
        .from("candidate_sites")
        .select(
          "id,name,project_type,requested_import_mw,likely_network_operator,assessment_status",
        )
        .neq("assessment_status", "archived")
        .order("updated_at", { ascending: false });
      if (result.error) throw result.error;
      return result.data ?? [];
    },
  });
  return (
    <AppShell requireAuth>
      <main id="main-content" className="section-page activation-index">
        <PageHeading
          eyebrow="Power Activation"
          title="Activate More Usable Power"
          description="Turn a capacity finding into an evidence-labelled firm, flexible and storage-supported connection strategy."
        />
        <div className="activation-project-list">
          {query.isLoading ? (
            <p role="status" aria-live="polite">
              Loading Projects…
            </p>
          ) : query.error ? (
            <div className="workspace-error" role="alert">
              <h2>Projects Could Not Be Loaded</h2>
              <p>Check your connection, then try again.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void query.refetch()}
              >
                Retry Loading
              </button>
            </div>
          ) : query.data?.length ? (
            query.data.map((site) => (
              <Link
                key={site.id}
                to="/activation/$id"
                params={{ id: site.id }}
                className="activation-project-card"
              >
                <Zap aria-hidden="true" />
                <div className="project-card-copy">
                  <h2>{site.name}</h2>
                  <p>
                    {site.project_type.replaceAll("_", " ")} ·{" "}
                    {site.likely_network_operator ?? "Operator unconfirmed"}
                  </p>
                </div>
                <strong>{site.requested_import_mw} MW</strong>
                <ArrowRight aria-hidden="true" />
              </Link>
            ))
          ) : (
            <div className="workspace-empty">
              <Zap aria-hidden="true" />
              <h2>No Activation Projects Yet</h2>
              <p>Create a project to turn a capacity finding into an activation strategy.</p>
              <Link to="/assessments/new" className="primary-button">
                Create Project
              </Link>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
