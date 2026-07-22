import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { PublicCTA, PublicLayout, PublicPageHero } from "@/components/public/PublicLayout";
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
  "Which candidate location is mature enough to progress?",
  "Which network responsibility is likely?",
  "Which connection approaches fit the project constraints?",
  "Which evidence and operator confirmations control the decision?",
] as const;

const customerInputs = [
  "1–3 candidate locations",
  "Requested and minimum viable power",
  "Technical configuration and load profile",
  "Target milestones",
  "Available project and operator evidence",
] as const;

const deliverables = [
  ["Candidate-site screening brief", "An evidence-led view of maturity, responsibility, and gaps."],
  [
    "Connection-strategy comparison",
    "Firm, reduced, staged, and flexible hypotheses with limitations.",
  ],
  ["Evidence-gap register", "The missing information and assumptions controlling confidence."],
  ["Operator question set", "Focused questions for the responsible network operator."],
  [
    "Engagement package and decision memo",
    "A traceable recommendation, alternatives, actions, and validation gates.",
  ],
] as const;

function ServicePage() {
  return (
    <PublicLayout>
      <main id="main-content" className="service-page service-page-v2">
        <PublicPageHero
          eyebrow="German Grid-Connection Strategy Assessment"
          title="Turn an uncertain site into an operator-ready connection strategy."
          description="GridPulse helps German data centres, battery projects, and large industrial loads qualify candidate sites, compare connection approaches, and prepare the evidence and questions required for network-operator engagement."
        >
          <Link to="/pilot" className="public-button public-button-primary">
            Start a Pilot <ArrowRight aria-hidden="true" />
          </Link>
          <Link to="/demo" className="public-button public-button-secondary">
            View an Example Case <ArrowRight aria-hidden="true" />
          </Link>
        </PublicPageHero>

        <section className="service-at-glance" aria-label="Assessment at a glance">
          {[
            ["1", "real project"],
            ["1–3", "candidate locations"],
            ["3", "connected stages"],
            ["5", "decision outputs"],
          ].map(([value, label]) => (
            <div key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
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
          <h2 id="service-journey-title">
            One decision, developed through three connected stages.
          </h2>
          <PublicJourney />
        </section>

        <section className="service-example" aria-labelledby="service-example-title">
          <div>
            <p className="context-label">Example Output</p>
            <h2 id="service-example-title">See the evidence behind the recommended next action.</h2>
            <p>
              The product tour shows one illustrative German project with candidate-site context,
              connection approaches, evidence status, and operator questions connected in a single
              record.
            </p>
            <Link to="/demo" className="public-text-link">
              Explore the Interactive Case <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <div className="service-example-card" aria-label="Illustrative assessment output">
            <span>Illustrative assessment</span>
            <h3>Berlin–Brandenburg Energy Project</h3>
            <dl>
              <div>
                <dt>Candidate sites</dt>
                <dd>3 compared</dd>
              </div>
              <div>
                <dt>Connection approaches</dt>
                <dd>4 structured</dd>
              </div>
              <div>
                <dt>Evidence status</dt>
                <dd>5 of 7 recorded</dd>
              </div>
              <div>
                <dt>Next action</dt>
                <dd>Confirm operator responsibility</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="service-scope" aria-labelledby="assessment-deliverables">
          <header id="deliverables">
            <p className="context-label">Assessment Scope</p>
            <h2 id="assessment-deliverables">Assessment Inputs &amp; Deliverables</h2>
          </header>
          <div className="service-scope-grid">
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
          </div>
        </section>

        <ProductBoundaryNotice />
        <PublicCTA
          eyebrow="Start With One Real Decision"
          title="Bring a German connection project into focus."
          description="Use one real project to test the evidence, connection options, and operator questions controlling the next decision."
          secondaryLabel="Review What the Pilot Includes"
          secondaryTo="/pilot"
          secondaryHash="what-is-included"
        />
      </main>
    </PublicLayout>
  );
}
