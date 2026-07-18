import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/product/AppShell";
import { ConnectionCaseExperience } from "@/components/product/ConnectionCaseExperience";
import { connectionCase } from "@/lib/demo-case";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "GridPulse Demo | German Grid Connection Assessment" },
      {
        name: "description",
        content:
          "Explore an illustrative GridPulse assessment for German BESS, data-centre and large-load grid connection decisions.",
      },
      { property: "og:title", content: "GridPulse Demo | German Grid Connection Assessment" },
      { property: "og:url", content: "https://gridpulseinsights.com/demo" },
    ],
    links: [{ rel: "canonical", href: "https://gridpulseinsights.com/demo" }],
  }),
  component: AssessmentWorkspace,
});

function AssessmentWorkspace() {
  return (
    <AppShell>
      <main className="case-demo-page">
        <div className="case-demo-breadcrumb">
          <Link to="/">
            <ArrowLeft /> Back to platform
          </Link>
          <span>Illustrative assessment · no capacity claim</span>
        </div>
        <header className="case-demo-heading">
          <div>
            <p>Connection assessment / {connectionCase.id}</p>
            <h1>{connectionCase.name}</h1>
            <span>
              {connectionCase.requirement} · {connectionCase.voltage}
            </span>
          </div>
          <Link to="/pilot">
            Bring us a real case <ArrowRight />
          </Link>
        </header>
        <ConnectionCaseExperience initialStage="site" />
        <div className="case-demo-footnote">
          Preliminary decision support only. Validate operator responsibility, voltage, capacity,
          connection conditions and all conclusions with the responsible network operator.
        </div>
      </main>
    </AppShell>
  );
}
