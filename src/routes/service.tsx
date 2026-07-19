import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, CircleAlert } from "lucide-react";
import { CAPACITY_NOTICE, PRODUCT_SCOPE_NOTICE } from "@/features/grid-connection/product-truth";

export const Route = createFileRoute("/service")({
  head: () => ({
    meta: [
      { title: "German Grid Connection Options Assessment | GridPulse" },
      {
        name: "description",
        content:
          "Compare German connection locations and firm, flexible and staged strategies with a traceable evidence and operator-engagement package.",
      },
    ],
    links: [{ rel: "canonical", href: "https://gridpulseinsights.com/service" }],
  }),
  component: ServicePage,
});

const deliverables = [
  "Comparison of up to three customer-selected candidate sites",
  "Likely network-operator and application-process screening",
  "Project and application-maturity assessment",
  "Firm, reduced-firm, flexible and staged connection hypotheses",
  "Evidence-gap and operator-question register",
  "Versioned operator-engagement package",
  "Management decision memo and next-action plan",
];

function ServicePage() {
  return (
    <main id="main-content" className="service-page">
      <header className="pilot-topbar">
        <Link to="/" className="landing-brand">
          <span>GRID</span>
          <strong>PULSE</strong>
        </Link>
        <Link to="/" className="pilot-text-link">
          <ArrowLeft /> Back to GridPulse
        </Link>
      </header>
      <section className="service-hero">
        <p className="context-label">German Grid Connection Options Assessment</p>
        <h1>Choose a credible route before committing capital to a connection case.</h1>
        <p>
          A bounded assessment for German data centres, BESS and large electrical loads. GridPulse
          structures the evidence, compares candidate locations and prepares the questions and
          scenarios that require network-operator review.
        </p>
        <div className="cine-actions">
          <Link to="/pilot" className="cine-cta cine-cta-solid">
            Qualify a project <ArrowRight />
          </Link>
          <Link to="/demo" className="cine-cta cine-cta-line">
            Explore the workflow <ArrowRight />
          </Link>
          <Link to="/validation-case" className="cine-cta cine-cta-line">
            Review validation case <ArrowRight />
          </Link>
          <Link to="/pilot-ready" className="cine-cta cine-cta-line">
            Open pilot-ready workspace <ArrowRight />
          </Link>
        </div>
      </section>
      <section className="service-grid">
        <article>
          <p className="context-label">Included</p>
          <h2>One decision package</h2>
          <ul>
            {deliverables.map((deliverable) => (
              <li key={deliverable}>
                <Check /> {deliverable}
              </li>
            ))}
          </ul>
        </article>
        <article>
          <p className="context-label">Required from the customer</p>
          <h2>A real project basis</h2>
          <ul>
            <li>
              <Check /> Requested and minimum viable power
            </li>
            <li>
              <Check /> Candidate locations and land status
            </li>
            <li>
              <Check /> Target date and commercial deadline
            </li>
            <li>
              <Check /> Technical configuration and single-line information
            </li>
            <li>
              <Check /> Representative interval profile where available
            </li>
            <li>
              <Check /> Existing operator correspondence and application evidence
            </li>
          </ul>
        </article>
        <article>
          <p className="context-label">Indicative commercial hypothesis</p>
          <h2>Scope before subscription</h2>
          <dl className="service-pricing">
            <div>
              <dt>Single site</dt>
              <dd>€5,000–€10,000</dd>
            </div>
            <div>
              <dt>Up to three sites</dt>
              <dd>€12,000–€25,000</dd>
            </div>
            <div>
              <dt>Operator support</dt>
              <dd>Scoped monthly retainer</dd>
            </div>
          </dl>
          <small>
            Pricing is an initial hypothesis and is confirmed only in a written proposal.
          </small>
        </article>
      </section>
      <aside className="service-boundary">
        <CircleAlert />
        <div>
          <strong>Product boundary</strong>
          <p>{PRODUCT_SCOPE_NOTICE}</p>
          <p>{CAPACITY_NOTICE}</p>
        </div>
      </aside>
    </main>
  );
}
