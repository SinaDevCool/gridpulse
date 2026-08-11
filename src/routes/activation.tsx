import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, RadioTower } from "lucide-react";
import { AppShell } from "@/components/product/AppShell";
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
        <ActivationWorkspace site={publicDemonstrationSite} envelopes={[]} />
      </main>
    </AppShell>
  );
}
