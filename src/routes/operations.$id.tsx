import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Zap } from "lucide-react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { OperationsWorkspace } from "@/features/operations/OperationsWorkspace";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/operations/$id")({ component: OperationsProject });
function OperationsProject() {
  const { id } = Route.useParams();
  const query = useQuery({
    queryKey: ["operations-workspace", id],
    queryFn: async () => {
      const [site, envelopes, events] = await Promise.all([
        supabase
          .from("candidate_sites")
          .select("id,name,requested_import_mw,likely_network_operator")
          .eq("id", id)
          .single(),
        supabase
          .from("fca_envelopes")
          .select("max_import_mw,version,status")
          .eq("site_id", id)
          .order("version", { ascending: false })
          .limit(1),
        supabase
          .from("integration_events")
          .select("id,kind,evidence_state,organization,valid_from,payload")
          .eq("site_id", id)
          .order("valid_from", { ascending: false })
          .limit(100),
      ]);
      if (site.error) throw site.error;
      if (envelopes.error) throw envelopes.error;
      if (events.error) throw events.error;
      return {
        site: site.data,
        firmMw: envelopes.data?.[0]?.max_import_mw ?? site.data.requested_import_mw * 0.84,
        events: events.data ?? [],
      };
    },
  });
  return (
    <AppShell requireAuth>
      <main id="main-content" className="section-page activation-page">
        <Link to="/operations" className="back-link">
          <ArrowLeft />
          All operations projects
        </Link>
        {query.isLoading ? (
          <p>Building operations workspace…</p>
        ) : query.error || !query.data ? (
          <p role="alert">This operations workspace could not be loaded.</p>
        ) : (
          <>
            <PageHeading
              eyebrow="Power Operations"
              title={query.data.site.name}
              description="Shadow monitoring and restriction-response rehearsal. This interface issues no physical control commands."
              action={
                <Link to="/activation/$id" params={{ id }} className="secondary-button">
                  <Zap size={15} />
                  Open Activation
                </Link>
              }
            />
            <OperationsWorkspace
              requestedMw={query.data.site.requested_import_mw}
              firmMw={query.data.firmMw}
              events={query.data.events}
            />
          </>
        )}
      </main>
    </AppShell>
  );
}
