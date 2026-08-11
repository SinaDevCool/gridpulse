import { createFileRoute, Link } from "@tanstack/react-router";
import { RadioTower } from "lucide-react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { ActivationWorkspace } from "@/features/activation/ActivationWorkspace";
import type { ActivationSite } from "@/features/activation/workspace-model";

export const Route = createFileRoute("/activation")({
  head: () => ({ meta: [{ title: "Power Activation | GridPulse" }] }),
  component: ActivationPage,
});

const publicDemonstrationSite: ActivationSite = {
  id: "public-activation-demonstration",
  name: "50Hertz Flexible Connection Example",
  project_type: "data_centre",
  requested_import_mw: 500,
  minimum_viable_import_mw: 400,
  bess_power_mw: 25,
  bess_energy_mwh: 50,
  likely_network_operator: "50Hertz",
};

function ActivationPage() {
  return (
    <AppShell>
      <main id="main-content" className="section-page activation-page">
        <PageHeading
          eyebrow="02 · Power Activation"
          title="Plan a Flexible Grid Connection"
          description="Explore how firm capacity, a conditional envelope and on-site flexibility can combine to activate more usable power. Values below are an illustrative 50Hertz-region scenario—not an operator offer."
          action={
            <Link to="/operations" className="secondary-button">
              <RadioTower size={15} aria-hidden="true" />
              Continue to Operations
            </Link>
          }
        />
        <ActivationWorkspace site={publicDemonstrationSite} envelopes={[]} />
      </main>
    </AppShell>
  );
}
