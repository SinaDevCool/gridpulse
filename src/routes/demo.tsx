import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/product/AppShell";
import { ConnectionCaseExperience } from "@/components/product/ConnectionCaseExperience";
import {
  ProductBoundaryNotice,
  PublicJourney,
  type PublicJourneyId,
} from "@/components/product/PublicJourney";
import { connectionCase, type CaseStageId } from "@/lib/demo-case";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "GridPulse Demo | From Site Screening to Operator-Ready Strategy" },
      {
        name: "description",
        content:
          "See an illustrative German connection case move from site screening through connection-strategy design to operator preparation.",
      },
      { property: "og:title", content: "GridPulse Demo | German Connection Strategy" },
      { property: "og:url", content: "https://gridpulseinsights.com/demo" },
    ],
    links: [{ rel: "canonical", href: "https://gridpulseinsights.com/demo" }],
  }),
  component: AssessmentWorkspace,
});

function journeyForStage(stage: CaseStageId): PublicJourneyId {
  if (stage === "site") return "discover";
  if (stage === "scenarios") return "design";
  return "prepare";
}

function AssessmentWorkspace() {
  const [journeyStage, setJourneyStage] = useState<PublicJourneyId>("discover");

  return (
    <AppShell>
      <main id="main-content" className="case-demo-page case-demo-v2">
        <div className="case-demo-breadcrumb">
          <Link to="/">
            <ArrowLeft aria-hidden="true" /> Back to GridPulse
          </Link>
          <span>Illustrative assessment · no available-capacity claim</span>
        </div>

        <header className="case-demo-heading">
          <div>
            <p>Illustrative German Connection Case</p>
            <h1>See one project move from site screening to an operator-ready strategy.</h1>
            <span>
              This example connects the project requirement, candidate location, connection
              hypotheses, evidence status, and next operator action.
            </span>
          </div>
          <Link to="/pilot">
            Start a Pilot With Your Project <ArrowRight aria-hidden="true" />
          </Link>
        </header>

        <PublicJourney active={journeyStage} />

        <section className="case-demo-project-summary" aria-label="Illustrative project summary">
          <small>{connectionCase.id}</small>
          <strong>{connectionCase.name}</strong>
          <span>
            {connectionCase.requirement} requested · {connectionCase.voltage}
          </span>
        </section>

        <ConnectionCaseExperience
          initialStage="site"
          onStageChange={(stage) => setJourneyStage(journeyForStage(stage))}
        />

        <ProductBoundaryNotice compact />

        <div className="case-demo-actions">
          <Link to="/pilot">
            Start a Pilot With Your Project <ArrowRight aria-hidden="true" />
          </Link>
          <Link to="/service">Review the Assessment Scope</Link>
        </div>
      </main>
    </AppShell>
  );
}
