import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Database, ExternalLink, Map, RadioTower } from "lucide-react";
import { PublicCTA, PublicLayout, PublicPageHero } from "@/components/public/PublicLayout";
import { germanGridEvidenceGaps, germanGridSources } from "@/lib/german-grid-sources";

export const Route = createFileRoute("/data-sources")({
  head: () => ({
    meta: [
      { title: "German Grid Data Methodology & Sources | GridPulse" },
      {
        name: "description",
        content:
          "See how GridPulse classifies German grid evidence, uses official public sources, and separates indicative context from network-operator confirmation.",
      },
      { property: "og:title", content: "German Grid Data Methodology & Sources | GridPulse" },
      { property: "og:url", content: "https://gridpulseinsights.com/data-sources" },
    ],
    links: [{ rel: "canonical", href: "https://gridpulseinsights.com/data-sources" }],
  }),
  component: DataSourcesPage,
});

const sources = [
  {
    name: "Bundesnetzagentur",
    type: "Regulatory and network context",
    use: "Network operator and grid-area validation",
    status: "Public source",
    icon: Building2,
  },
  {
    name: "Marktstammdatenregister",
    type: "Asset registry",
    use: "Generation and storage asset context",
    status: "Connector retained",
    icon: Database,
  },
  {
    name: "SMARD",
    type: "Electricity market data",
    use: "System and market context; not connection capacity",
    status: "Connector retained",
    icon: RadioTower,
  },
  {
    name: "OpenStreetMap / OpenGridMap",
    type: "Geospatial context",
    use: "Infrastructure proximity screening requiring verification",
    status: "Public source",
    icon: Map,
  },
] as const;

const evidenceClasses = [
  ["Customer-declared", "Project information supplied by the customer."],
  ["Public context", "Published geographic, regulatory, or system information."],
  ["Calculated", "A reproducible result derived from stated inputs."],
  ["Assumption", "A proposition that remains open to challenge."],
  ["Reviewed evidence", "Material inspected through a defined review step."],
  ["Operator-confirmed", "Current, written, project-specific operator evidence."],
] as const;

function DataSourcesPage() {
  return (
    <PublicLayout>
      <main id="main-content" className="section-page public-methodology-page">
        <PublicPageHero
          eyebrow="Methodology & Evidence"
          title="Know what the evidence establishes—and what it cannot."
          description="GridPulse keeps public context, customer inputs, calculations, assumptions, reviewed evidence, and operator-confirmed conclusions visibly separate."
        >
          <Link to="/demo" className="public-button public-button-primary">
            View the Product Tour <ArrowRight aria-hidden="true" />
          </Link>
        </PublicPageHero>

        <div className="public-page-content">
          <section className="evidence-class-section" aria-labelledby="evidence-class-title">
            <p className="context-label">Evidence Model</p>
            <h2 id="evidence-class-title">
              Every material claim carries a visible evidence class.
            </h2>
            <div className="evidence-class-grid">
              {evidenceClasses.map(([title, description]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="source-warning">
            <strong>Important:</strong> Public datasets can support site screening but cannot
            confirm live connection capacity, a connection date, or final flexible-connection terms.
          </div>

          <div className="source-grid">
            {sources.map(({ icon: Icon, ...source }) => (
              <article className="source-card" key={source.name}>
                <div>
                  <span className="source-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="status">{source.status}</span>
                </div>
                <h2>{source.name}</h2>
                <p>{source.type}</p>
                <dl>
                  <dt>Used for</dt>
                  <dd>{source.use}</dd>
                  <dt>Evidence treatment</dt>
                  <dd>Record source URL, retrieval date, and limitations.</dd>
                </dl>
              </article>
            ))}
          </div>

          <section className="methodology-boundary" aria-labelledby="methodology-boundary-title">
            <div>
              <p className="context-label">Decision Boundary</p>
              <h2 id="methodology-boundary-title">Screen with context. Conclude with evidence.</h2>
            </div>
            <div className="methodology-boundary-grid">
              <article>
                <h3>GridPulse can structure</h3>
                <ul>
                  <li>Public geographic context</li>
                  <li>Likely network responsibility</li>
                  <li>Evidence completeness</li>
                  <li>Scenario assumptions</li>
                  <li>Project operating requirements</li>
                </ul>
              </article>
              <article>
                <h3>Operator confirmation controls</h3>
                <ul>
                  <li>Responsible network operator</li>
                  <li>Available capacity</li>
                  <li>Connection point</li>
                  <li>Required reinforcement works</li>
                  <li>Restrictions, timing, and final terms</li>
                </ul>
              </article>
            </div>
          </section>

          <section className="official-source-register" aria-labelledby="official-source-heading">
            <div className="room-heading">
              <div>
                <p className="context-label">German Official-Source Register</p>
                <h2 id="official-source-heading">Claims remain attached to their authority.</h2>
                <p>Each source states both what it supports and what it cannot prove.</p>
              </div>
            </div>
            <div className="source-register-list">
              {germanGridSources.map((source) => (
                <article className="source-register-row" key={source.id}>
                  <div>
                    <span className="status">{source.evidenceClass.replaceAll("_", " ")}</span>
                    <h3>{source.title}</h3>
                    <p>
                      {source.authority} · updated {source.publishedOrUpdated}
                    </p>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      Open official source <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  </div>
                  <dl>
                    <dt>Supports</dt>
                    <dd>{source.establishes.join(" ")}</dd>
                    <dt>Does not prove</dt>
                    <dd>{source.doesNotEstablish.join(" ")}</dd>
                  </dl>
                </article>
              ))}
            </div>
            <aside className="source-warning">
              <strong>Known evidence gaps:</strong> {germanGridEvidenceGaps.join(" ")}
            </aside>
          </section>
        </div>

        <PublicCTA
          eyebrow="Evidence Before Assertion"
          title="Build your project case on an explicit evidence boundary."
          description="See how one connection decision moves from indicative context to focused operator questions."
        />
      </main>
    </PublicLayout>
  );
}
