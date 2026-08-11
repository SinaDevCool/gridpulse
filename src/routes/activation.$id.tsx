import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { ActivationWorkspace } from "@/features/activation/ActivationWorkspace";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/activation/$id")({ component: ActivationProject });
function ActivationProject() {
  const { id } = Route.useParams();
  const query = useQuery({
    queryKey: ["activation-workspace", id],
    queryFn: async () => {
      const [site, envelopes] = await Promise.all([
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
      ]);
      if (site.error) throw site.error;
      if (envelopes.error) throw envelopes.error;
      return { site: site.data, envelopes: envelopes.data ?? [] };
    },
  });
  return (
    <AppShell requireAuth>
      <main id="main-content" className="section-page activation-page">
        <Link to="/activation" className="back-link">
          <ArrowLeft /> All activation projects
        </Link>
        {query.isLoading ? (
          <p>Building activation workspace…</p>
        ) : query.error || !query.data ? (
          <p role="alert">This activation workspace could not be loaded.</p>
        ) : (
          <>
            <PageHeading
              eyebrow="Power Activation"
              title={query.data.site.name}
              description={`Connection activation strategy for ${query.data.site.likely_network_operator ?? "the responsible network operator"}. Evidence labels distinguish operator inputs from illustrative assumptions.`}
            />
            <ActivationWorkspace site={query.data.site} envelopes={query.data.envelopes} />
          </>
        )}
      </main>
    </AppShell>
  );
}
