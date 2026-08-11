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
          title="Activate more usable power"
          description="Turn a capacity finding into an evidence-labelled firm, flexible and storage-supported connection strategy."
        />
        <div className="activation-project-list">
          {query.isLoading ? (
            <p>Loading projects…</p>
          ) : query.error ? (
            <p role="alert">Projects could not be loaded.</p>
          ) : (
            query.data?.map((site) => (
              <Link
                key={site.id}
                to="/activation/$id"
                params={{ id: site.id }}
                className="activation-project-card"
              >
                <Zap />
                <div>
                  <h2>{site.name}</h2>
                  <p>
                    {site.project_type.replaceAll("_", " ")} ·{" "}
                    {site.likely_network_operator ?? "Operator unconfirmed"}
                  </p>
                </div>
                <strong>{site.requested_import_mw} MW</strong>
                <ArrowRight />
              </Link>
            ))
          )}
        </div>
      </main>
    </AppShell>
  );
}
