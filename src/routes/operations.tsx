import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Zap } from "lucide-react";
import { AppShell } from "@/components/product/AppShell";
import { OperationsWorkspace } from "@/features/operations/OperationsWorkspace";

export const Route = createFileRoute("/operations")({
  head: () => ({ meta: [{ title: "Power Operations | GridPulse" }] }),
  component: OperationsPage,
});

function OperationsPage() {
  return (
    <AppShell>
      <main id="main-content" className="section-page activation-page energy-console">
        <header className="energy-console-heading">
          <div>
            <p className="context-label">03 · Operations Workspace</p>
            <h1>Power Operations</h1>
            <p>Monitor demand, the active envelope and response readiness in one view.</p>
          </div>
          <Link to="/activation" className="console-action console-action--quiet">
            <ArrowLeft size={14} aria-hidden="true" />
            <Zap size={15} aria-hidden="true" />
            Review Activation
          </Link>
        </header>
        <OperationsWorkspace requestedMw={500} firmMw={420} events={[]} />
      </main>
    </AppShell>
  );
}
