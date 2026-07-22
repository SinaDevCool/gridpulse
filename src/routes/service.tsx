import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { ProductBoundaryNotice, PublicJourney } from "@/components/product/PublicJourney";

export const Route = createFileRoute("/service")({
  head: () => ({
    meta: [
      { title: "German Grid Connection Strategy Assessment | GridPulse" },
      {
        name: "description",
        content:
          "Compare German candidate sites and firm, staged, and flexible grid-connection strategies with a traceable operator-engagement package.",
      },
    ],
    links: [{ rel: "canonical", href: "https://gridpulseinsights.com/service" }],
  }),
  component: ServicePage,
});

const decisions = [
  "Which candidate location is sufficiently mature?",
  "Which connection approaches fit the project constraints?",
  "What must be confirmed by the responsible network operator?",
] as const;

const customerInputs = [
  "1–3 candidate locations",
  "Requested and minimum viable capacity",
  "Technical configuration",
  "Target milestones",
  "Available project and operator evidence",
] as const;

const deliverables = [
  [
    "Candidate-site readiness comparison",
    "An evidence-led view of maturity, responsibility, and gaps.",
  ],
  [
    "Connection-strategy comparison",
    "Firm, reduced, staged, and flexible hypotheses with limitations.",
  ],
  [
    "Evidence and operator-question register",
    "The unresolved information controlling the next decision.",
  ],
  [
    "Engagement package and decision memo",
    "A traceable recommendation, alternatives, actions, and validation gates.",
  ],
] as const;

function ServicePage() {
  return (
    <main id="main-content" className="service-page service-page-v2">
      <header className="pilot-topbar">
        <Link to="/" className="landing-brand">
          <span>GRID</span>
          <strong>PULSE</strong>
        </Link>
        <Link to="/" className="pilot-text-link">
          <ArrowLeft aria-hidden="true" /> Back to GridPulse
        </Link>
      </header>

      <section className="service-hero">
        <p className="context-label">German Grid Connection Strategy Assessment</p>
        <h1>Build an evidence-led route into operator engagement.</h1>
        <p>
          For German data centres, battery projects, and large industrial loads evaluating 1–3
          candidate locations, requested capacity, and firm or flexible connection approaches.
        </p>
        <div className="cine-actions">
          <Link to="/pilot" className="cine-cta cine-cta-solid">
            Start a Pilot <ArrowRight aria-hidden="true" />
          </Link>
          <Link to="/demo" className="cine-cta cine-cta-line">
            View an Example Case <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="service-decision" aria-labelledby="service-decision-title">
        <div>
          <p className="context-label">The Customer Decision</p>
          <h2 id="service-decision-title">
            Which site and connection strategy has the most credible route forward?
          </h2>
        </div>
        <ul>
          {decisions.map((decision) => (
            <li key={decision}>
              <Check aria-hidden="true" /> {decision}
            </li>
          ))}
        </ul>
      </section>

      <section className="service-journey" aria-labelledby="service-journey-title">
        <p className="context-label">Assessment Journey</p>
        <h2 id="service-journey-title">One decision, developed through three connected stages.</h2>
        <PublicJourney />
      </section>

      <section className="service-scope-grid">
        <article>
          <p className="context-label">You Provide</p>
          <h2>A real project basis</h2>
          <ul>
            {customerInputs.map((item) => (
              <li key={item}>
                <Check aria-hidden="true" /> {item}
              </li>
            ))}
          </ul>
        </article>
        <article>
          <p className="context-label">You Receive</p>
          <h2>A decision-ready package</h2>
          <dl>
            {deliverables.map(([title, copy]) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{copy}</dd>
              </div>
            ))}
          </dl>
        </article>
      </section>

      <ProductBoundaryNotice />

      <section className="service-final-cta">
        <p className="context-label">Start With One Real Decision</p>
        <h2>Bring a German connection project into focus.</h2>
        <div className="cine-actions">
          <Link to="/pilot" className="cine-cta cine-cta-solid">
            Start a Pilot <ArrowRight aria-hidden="true" />
          </Link>
          <Link to="/demo" className="pilot-text-link">
            Explore the Working Product <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
