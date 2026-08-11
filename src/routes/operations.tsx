import { createFileRoute, Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { OperationsWorkspace } from "@/features/operations/OperationsWorkspace";

export const Route = createFileRoute("/operations")({
  head: () => ({ meta: [{ title: "Power Operations | GridPulse" }] }),
  component: OperationsPage,
});

function OperationsPage() {
  return (
    <AppShell>
      <main id="main-content" className="section-page activation-page">
        <PageHeading
          eyebrow="03 · Power Operations"
          title="Operate Within Approved Limits"
          description="Rehearse restriction response, monitor evidence quality and assess operational readiness. This public simulation sends no dispatch or network-control commands."
          action={
            <Link to="/activation" className="secondary-button">
              <Zap size={15} aria-hidden="true" />
              Back to Activation
            </Link>
          }
        />
        <OperationsWorkspace requestedMw={500} firmMw={420} events={[]} />
      </main>
    </AppShell>
  );
}
