import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { PublicCTA, PublicLayout, PublicPageHero } from "@/components/public/PublicLayout";
import { ConnectionCaseExperience } from "@/components/product/ConnectionCaseExperience";
import {
  ProductBoundaryNotice,
  PublicJourney,
  type PublicJourneyId,
} from "@/components/product/PublicJourney";
import { connectionCase, type CaseStageId } from "@/lib/demo-case";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "GridPulse Product Tour | German Connection Strategy" },
      {
        name: "description",
        content:
          "Explore a read-only German connection case from site screening through strategy design to operator preparation.",
      },
      { property: "og:title", content: "GridPulse Product Tour | German Connection Strategy" },
      { property: "og:url", content: "https://gridpulseinsights.com/demo" },
    ],
    links: [{ rel: "canonical", href: "https://gridpulseinsights.com/demo" }],
  }),
  component: ProductTour,
});

function journeyForStage(stage: CaseStageId): PublicJourneyId {
  if (stage === "site") return "discover";
  if (stage === "scenarios") return "design";
  return "prepare";
}

function ProductTour() {
  const [journeyStage, setJourneyStage] = useState<PublicJourneyId>("discover");
  return (
    <PublicLayout>
      <main id="main-content" className="case-demo-page case-demo-v2">
        <PublicPageHero
          eyebrow="Interactive Product Tour · Illustrative Case"
          title="Follow one German project from site screening to operator preparation."
          description="This read-only case shows how GridPulse connects project requirements, site context, connection approaches, evidence status, and operator questions in one decision record. Values are illustrative and do not claim available capacity."
        >
          <Link to="/pilot" className="public-button public-button-primary">
            Start With Your Project <ArrowRight aria-hidden="true" />
          </Link>
          <Link to="/service" className="public-button public-button-secondary">
            Review the Assessment
          </Link>
        </PublicPageHero>

        <div className="public-page-content case-demo-content">
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
            mode="preview"
            onStageChange={(stage) => {
              setJourneyStage(journeyForStage(stage));
              trackEvent("demo_stage_selected", { stage });
            }}
          />
          <ProductBoundaryNotice compact />
        </div>
        <PublicCTA
          eyebrow="Apply the Workflow"
          title="Use the same decision structure for your project."
          description="Bring your site, power requirement, operating constraints, and available evidence into a focused pilot review."
          primaryLabel="Apply This Workflow to Your Project"
          secondaryLabel="Review the Assessment"
          secondaryTo="/service"
        />
      </main>
    </PublicLayout>
  );
}
