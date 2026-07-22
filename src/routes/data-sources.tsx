import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calculator,
  Check,
  Database,
  ExternalLink,
  FileCheck2,
  Map,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import { PublicCTA, PublicLayout, PublicPageHero } from "@/components/public/PublicLayout";
import { germanGridEvidenceGaps, germanGridSources } from "@/lib/german-grid-sources";

export const Route = createFileRoute("/data-sources")({
  head: () => ({
    meta: [
      { title: "German Grid Data Methodology & Sources | GridPulse" },
      {
        name: "description",
        content:
          "See how GridPulse classifies German grid evidence, preserves source limitations, and separates screening context from operator-confirmed conclusions.",
      },
      { property: "og:title", content: "German Grid Data Methodology & Sources | GridPulse" },
      { property: "og:url", content: "https://gridpulseinsights.com/data-sources" },
    ],
    links: [{ rel: "canonical", href: "https://gridpulseinsights.com/data-sources" }],
  }),
  component: DataSourcesPage,
});

const outcomes = [
  [
    AlertTriangle,
    "Avoid false certainty",
    "Keep indicative public context and calculated results separate from confirmed project capacity.",
  ],
  [
    FileCheck2,
    "Expose decision gaps",
    "Show which missing evidence, assumptions, or operator responses control confidence.",
  ],
  [
    MessageSquareText,
    "Prepare focused engagement",
    "Turn unresolved questions into a traceable network-operator engagement package.",
  ],
] as const;

const evidenceClasses = [
  {
    level: "01",
    title: "Customer-declared",
    example: "Requested import, minimum viable power, and target date.",
    use: "Project input",
    upgrade: "Validate against technical and commercial documents.",
  },
  {
    level: "02",
    title: "Public context",
    example: "Published network area, regulation, or allocation procedure.",
    use: "Screening only",
    upgrade: "Confirm applicability to the site and project.",
  },
  {
    level: "03",
    title: "Assumption",
    example: "Likely responsible operator before confirmation.",
    use: "Hypothesis only",
    upgrade: "Replace with reviewed or operator evidence.",
  },
  {
    level: "04",
    title: "Calculated",
    example: "Connection-option comparison from declared constraints.",
    use: "Reproducible analysis",
    upgrade: "Review inputs, method, and limitations.",
  },
  {
    level: "05",
    title: "Reviewed evidence",
    example: "Technical material inspected through a defined review.",
    use: "Scoped support",
    upgrade: "Record authority, date, scope, and review owner.",
  },
  {
    level: "06",
    title: "Operator-confirmed",
    example: "Current written evidence tied to the project and site.",
    use: "Conclusion within scope",
    upgrade: "Revalidate when scope, conditions, or validity change.",
  },
] as const;

const authorityGroups = [
  {
    icon: Building2,
    title: "Regulatory authority",
    examples: "Bundesnetzagentur · EnWG",
    use: "Legal framework, FCA context, and connection principles.",
    limit: "Does not establish project-specific capacity or terms.",
  },
  {
    icon: ShieldCheck,
    title: "Network-operator evidence",
    examples: "TSOs · DSOs · formal correspondence",
    use: "Operator processes, technical requirements, and written project conclusions.",
    limit: "Only controls a decision within its stated scope and validity.",
  },
  {
    icon: Database,
    title: "Official public datasets",
    examples: "MaStR · SMARD",
    use: "Registered-asset, electricity-system, and market context.",
    limit: "Does not show available connection capacity.",
  },
  {
    icon: Map,
    title: "Indicative geospatial context",
    examples: "OpenStreetMap · OpenGridMap",
    use: "Early infrastructure-proximity screening.",
    limit: "Requires verification of ownership, voltage, and usability.",
  },
] as const;

function DataSourcesPage() {
  return (
    <PublicLayout>
      <main id="main-content" className="section-page public-methodology-page">
        <PublicPageHero
          eyebrow="Methodology & Evidence"
          title="Know what supports the decision—and what still requires operator confirmation."
          description="GridPulse keeps project inputs, public context, assumptions, calculations, and operator evidence visibly separate so every recommendation has a clear basis and validation boundary."
        >
          <Link to="/demo" className="public-button public-button-primary">
            See the Method in the Product <ArrowRight aria-hidden="true" />
          </Link>
          <Link to="/service" className="public-text-link">
            Review the Assessment <ArrowRight aria-hidden="true" />
          </Link>
        </PublicPageHero>

        <div className="public-page-content">
          <section className="methodology-outcomes" aria-labelledby="methodology-why-title">
            <p className="context-label">Why This Matters</p>
            <h2 id="methodology-why-title">
              Evidence quality changes the decision you can credibly make.
            </h2>
            <div>
              {outcomes.map(([Icon, title, copy]) => (
                <article key={title}>
                  <Icon aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="evidence-class-section" aria-labelledby="evidence-class-title">
            <p className="context-label">Evidence Ladder</p>
            <h2 id="evidence-class-title">
              Every material claim carries a visible evidence class.
            </h2>
            <ol className="evidence-ladder">
              {evidenceClasses.map((item) => (
                <li key={item.level}>
                  <span>{item.level}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.example}</p>
                  </div>
                  <dl>
                    <dt>Decision use</dt>
                    <dd>{item.use}</dd>
                    <dt>Upgrade requirement</dt>
                    <dd>{item.upgrade}</dd>
                  </dl>
                </li>
              ))}
            </ol>
          </section>

          <section className="operator-proof" aria-labelledby="operator-proof-title">
            <div>
              <p className="context-label">Strongest Evidence Class</p>
              <h2 id="operator-proof-title">
                Operator-confirmed means more than “an operator said it.”
              </h2>
              <p>
                A conclusion retains the evidence needed to understand exactly who confirmed what,
                for which project, and for how long.
              </p>
            </div>
            <ul>
              {[
                "Issuing network operator and responsible team",
                "Project, site, and connection scope",
                "Date received and document reference",
                "Conditions, limitations, and validity period",
                "Review owner and required revalidation",
              ].map((x) => (
                <li key={x}>
                  <Check aria-hidden="true" />
                  {x}
                </li>
              ))}
            </ul>
          </section>

          <section className="authority-section" aria-labelledby="authority-title">
            <p className="context-label">Source Hierarchy</p>
            <h2 id="authority-title">Different sources support different decisions.</h2>
            <div className="authority-grid">
              {authorityGroups.map(({ icon: Icon, ...item }) => (
                <article key={item.title}>
                  <Icon aria-hidden="true" />
                  <h3>{item.title}</h3>
                  <strong>{item.examples}</strong>
                  <p>{item.use}</p>
                  <small>{item.limit}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="methodology-boundary" aria-labelledby="methodology-boundary-title">
            <div>
              <p className="context-label">Decision Boundary</p>
              <h2 id="methodology-boundary-title">Screen with context. Conclude with evidence.</h2>
            </div>
            <div className="methodology-boundary-grid">
              <article>
                <h3>GridPulse can structure</h3>
                <ul>
                  {[
                    "Customer requirements",
                    "Public and regulatory context",
                    "Evidence completeness",
                    "Assumptions and calculations",
                    "Operator questions",
                  ].map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </article>
              <article>
                <h3>Operator confirmation controls</h3>
                <ul>
                  {[
                    "Responsible network operator",
                    "Available capacity and connection point",
                    "Required reinforcement works",
                    "Operating restrictions",
                    "Schedule and final terms",
                  ].map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </article>
            </div>
          </section>

          <section className="official-source-register" aria-labelledby="official-source-heading">
            <div className="room-heading">
              <div>
                <p className="context-label">Verified Source Register</p>
                <h2 id="official-source-heading">Claims remain attached to their authority.</h2>
                <p>
                  Operator-specific procedures are examples within their stated network scope—not
                  one uniform German process.
                </p>
              </div>
            </div>
            <div
              className="source-register-table"
              role="table"
              aria-label="Grid methodology sources"
            >
              <div className="source-register-head" role="row">
                <span role="columnheader">Authority & source</span>
                <span role="columnheader">Scope</span>
                <span role="columnheader">Review status</span>
              </div>
              {germanGridSources.map((source) => (
                <details className="source-register-item" key={source.id}>
                  <summary>
                    <span>
                      <b>{source.authority}</b>
                      <small>{source.title}</small>
                    </span>
                    <span>{source.geographicScope}</span>
                    <span>
                      <b>{source.integrationStatus}</b>
                      <small>Last verified {source.lastVerified}</small>
                    </span>
                  </summary>
                  <div>
                    <dl>
                      <dt>Supports</dt>
                      <dd>{source.establishes.join(" ")}</dd>
                      <dt>Does not prove</dt>
                      <dd>{source.doesNotEstablish.join(" ")}</dd>
                    </dl>
                    <p>
                      Source published/updated: {source.publishedOrUpdated} · Next review:{" "}
                      {source.nextReview}
                    </p>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      Open official source <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  </div>
                </details>
              ))}
            </div>
            <aside className="source-warning">
              <strong>Known evidence gaps:</strong> {germanGridEvidenceGaps.join(" ")}
            </aside>
          </section>

          <section className="methodology-governance">
            <div>
              <Calculator aria-hidden="true" />
              <p className="context-label">Methodology Governance</p>
              <h2>Versioned, reviewable, and open to correction.</h2>
            </div>
            <dl>
              <div>
                <dt>Methodology version</dt>
                <dd>1.0</dd>
              </div>
              <div>
                <dt>Last reviewed</dt>
                <dd>22 July 2026</dd>
              </div>
              <div>
                <dt>Review owner</dt>
                <dd>GridPulse methodology team</dd>
              </div>
              <div>
                <dt>Review cadence</dt>
                <dd>Quarterly and after material source changes</dd>
              </div>
            </dl>
          </section>
        </div>

        <PublicCTA
          eyebrow="Evidence Before Assertion"
          title="See the evidence boundary inside a real decision workflow."
          description="Follow an illustrative connection case, then apply the same structure to one real project."
          primaryLabel="Start With a Real Project"
          secondaryLabel="Explore the Product Tour"
        />
      </main>
    </PublicLayout>
  );
}
