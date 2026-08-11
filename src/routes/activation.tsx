import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, RadioTower } from "lucide-react";
import { AppShell } from "@/components/product/AppShell";
import { SelectedAssetContext } from "@/components/product/SelectedAssetContext";
import { publicSelectedAsset } from "@/components/product/selected-asset-data";
import { ActivationWorkspace } from "@/features/activation/ActivationWorkspace";
import type { ActivationSite } from "@/features/activation/workspace-model";

export const Route = createFileRoute("/activation")({
  head: () => ({ meta: [{ title: "Power Activation | GridPulse" }] }),
  component: ActivationPage,
});

const publicDemonstrationSite: ActivationSite = {
  id: "public-activation-demonstration",
  name: publicSelectedAsset.name,
  project_type: "data_centre",
  requested_import_mw: 250,
  minimum_viable_import_mw: 180,
  bess_power_mw: 15,
  bess_energy_mwh: 30,
  likely_network_operator: "50Hertz",
};

function ActivationPage() {
  return (
    <AppShell>
      <main id="main-content" className="section-page activation-page energy-console">
        <header className="energy-console-heading">
          <div>
            <p className="context-label">02 · Activation Workspace</p>
            <h1>Power Activation</h1>
            <p>Shape a flexible connection strategy for the selected 50Hertz candidate.</p>
          </div>
          <Link to="/operations" className="console-action">
            <RadioTower size={15} aria-hidden="true" />
            Open Operations
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </header>
        <SelectedAssetContext stage="activation" />
        <ActivationWorkspace
          site={publicDemonstrationSite}
          envelopes={[
            {
              id: "berlin-synthetic-n1-basis",
              name: "Berlin synthetic N-1 basis",
              version: 1,
              status: "calculated",
              mode: "synthetic_geographic_demonstration",
              max_import_mw: publicSelectedAsset.firmMw,
              valid_from: null,
              valid_to: null,
              restriction_schedule: null,
            },
          ]}
        />
      </main>
    </AppShell>
  );
}
