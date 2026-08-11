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
  Network,
  ShieldCheck,
} from "lucide-react";
import { PublicCTA, PublicLayout, PublicPageHero } from "@/components/public/PublicLayout";
import { isFinderMvp } from "@/config/product-mode";
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

const calculationEvidence = [
  {
    label: "Geographic Demonstration",
    value: "15 nodes",
    detail: "Berlin mapped anchors with a synthetic 110 kV electrical model",
    status: "Calculated",
  },
  {
    label: "Security Assessment",
    value: "32 N-1",
    detail: "Every synthetic branch evaluated as an individual outage",
    status: "Physics solved",
  },
  {
    label: "Hourly Envelope",
    value: "236,520 h",
    detail: "27 deterministic scenarios across the reference candidate set",
    status: "Representative",
  },
  {
    label: "Graph Reduction",
    value: "40%",
    detail: "Fewer cases selected with 100% constraint and infeasible recall",
    status: "Qualified",
  },
] as const;

const benchmarkSteps = [
  ["01", "Map the candidate", "OpenStreetMap anchors, voltage context and proximity."],
  ["02", "Trace the pathway", "Neo4j-compatible topology selects relevant upstream cases."],
  ["03", "Solve the physics", "Pandapower AC load flow tests voltage, thermal and N-1 limits."],
  [
    "04",
    "Build the envelope",
    "Hourly scenarios compare firm, flexible, battery and staged strategies.",
  ],
  ["05", "Gate the claim", "Evidence class determines what can be displayed or operationalised."],
] as const;

function DataSourcesPage() {
  if (isFinderMvp()) return <FinderDataSourcesPage />;

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

function FinderDataSourcesPage() {
  return (
    <PublicLayout>
      <main id="main-content" className="section-page public-methodology-page finder-methodology">
        <PublicPageHero
          eyebrow="Data & Methodology"
          title="See how mapped evidence becomes a governed capacity decision."
          description="Follow the calculation from public geography through graph-selected contingencies, AC power flow and hourly flexibility—while keeping synthetic results separate from operator-confirmed capacity."
        >
          <Link to="/power-finder" className="public-button public-button-primary">
            Open Grid Workspace <ArrowRight aria-hidden="true" />
          </Link>
        </PublicPageHero>

        <div className="public-page-content finder-methodology-content">
          <section className="finder-methodology-value" aria-labelledby="finder-method-title">
            <div>
              <p className="context-label">What Powers the Shortlist</p>
              <h2 id="finder-method-title">
                A practical screening layer over fragmented evidence.
              </h2>
              <p>
                Power Finder narrows a broad search area into comparable candidate connection
                points. It uses evidence that can be inspected and keeps unknown capacity unknown.
              </p>
            </div>
            <div className="finder-methodology-cards">
              <article>
                <Map aria-hidden="true" />
                <h3>Geographic context</h3>
                <p>Mapped nodes, corridors, industrial land and registered assets.</p>
              </article>
              <article>
                <Calculator aria-hidden="true" />
                <h3>Candidate comparison</h3>
                <p>Proximity, voltage alignment, operator context and evidence quality.</p>
              </article>
              <article>
                <ShieldCheck aria-hidden="true" />
                <h3>Governed capacity</h3>
                <p>Node-specific MW only when an accepted model and completed study support it.</p>
              </article>
            </div>
          </section>

          <section className="calculation-evidence" aria-labelledby="calculation-evidence-title">
            <div className="calculation-evidence-heading">
              <div>
                <p className="context-label">Calculation Evidence</p>
                <h2 id="calculation-evidence-title">The current public calculation stack.</h2>
              </div>
              <p>
                These figures summarize completed repository benchmarks. They validate the method;
                they do not establish capacity at an operator-owned node.
              </p>
            </div>
            <div className="calculation-evidence-metrics">
              {calculationEvidence.map((item) => (
                <article key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.detail}</p>
                  <small>{item.status}</small>
                </article>
              ))}
            </div>
            <ol className="calculation-pipeline">
              {benchmarkSteps.map(([number, title, detail]) => (
                <li key={number}>
                  <span>{number}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="calculation-boundary-strip">
              <Network aria-hidden="true" />
              <p>
                <strong>Authority boundary:</strong> graph analysis selects and explains study
                pathways; the electrical solver remains authoritative for MW; the network operator
                remains authoritative for connection capacity.
              </p>
            </div>
          </section>

          <section className="finder-methodology-flow" aria-labelledby="finder-flow-title">
            <p className="context-label">How a Result Is Built</p>
            <h2 id="finder-flow-title">From project requirement to an evidence-ready shortlist.</h2>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <h3>Define the project</h3>
                  <p>Set location, required power, distance and voltage preference.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Screen the map</h3>
                  <p>Find nearby infrastructure and rank candidate connection points.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Compare candidates</h3>
                  <p>Review fit, evidence and any governed capacity results available.</p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <h3>Prepare technical review</h3>
                  <p>
                    Take the strongest candidates and unresolved questions to the responsible
                    operator.
                  </p>
                </div>
              </li>
            </ol>
          </section>

          <section className="finder-methodology-boundary" aria-labelledby="finder-boundary-title">
            <div>
              <p className="context-label">Decision Boundary</p>
              <h2 id="finder-boundary-title">
                Useful for prioritisation. Honest about confirmation.
              </h2>
            </div>
            <div>
              <article>
                <Check aria-hidden="true" />
                <h3>GridPulse supports</h3>
                <ul>
                  <li>Location and infrastructure discovery</li>
                  <li>Consistent candidate comparison</li>
                  <li>Source-aware shortlisting</li>
                  <li>Reviewed capacity display when governed results exist</li>
                </ul>
              </article>
              <article>
                <AlertTriangle aria-hidden="true" />
                <h3>Operator confirmation controls</h3>
                <ul>
                  <li>Connection feasibility and final connection point</li>
                  <li>Available or reserved capacity</li>
                  <li>Reinforcement, cost and contractual terms</li>
                  <li>Approval and energisation timing</li>
                </ul>
              </article>
            </div>
          </section>

          <section className="finder-methodology-sources" aria-labelledby="finder-sources-title">
            <div>
              <p className="context-label">Primary Source Families</p>
              <h2 id="finder-sources-title">Public context with visible provenance.</h2>
            </div>
            <div>
              <article>
                <strong>OpenStreetMap</strong>
                <span>Mapped grid and land context</span>
              </article>
              <article>
                <strong>MaStR</strong>
                <span>Registered generation and storage</span>
              </article>
              <article>
                <strong>Bundesnetzagentur</strong>
                <span>Regulatory and market context</span>
              </article>
              <article>
                <strong>Network operators</strong>
                <span>Technical requirements and confirmation</span>
              </article>
            </div>
          </section>

          <section className="finder-methodology-value" aria-labelledby="finder-release2-title">
            <div>
              <p className="context-label">Release 2 Governance</p>
              <h2 id="finder-release2-title">
                AI prioritises studies. Physics remains authoritative.
              </h2>
              <p>
                Release 2 uses a private surrogate to route uncertain and boundary cases into the
                solver faster. Mandatory N-1 cases cannot be skipped, and promotion requires full
                physics coverage of the selected batch.
              </p>
            </div>
            <div className="finder-methodology-cards">
              <article>
                <Network aria-hidden="true" />
                <h3>Routing only</h3>
                <p>Surrogate predictions are never published or displayed as grid capacity.</p>
              </article>
              <article>
                <ShieldCheck aria-hidden="true" />
                <h3>Fail-closed gates</h3>
                <p>Missing contingencies or incomplete physics verification block promotion.</p>
              </article>
              <article>
                <Calculator aria-hidden="true" />
                <h3>Berlin boundary</h3>
                <p>
                  The public Berlin colours remain Release 1 physics results; Release 2 does not
                  alter them.
                </p>
              </article>
            </div>
          </section>
        </div>

        <PublicCTA
          eyebrow="Start With the Map"
          title="Build a focused connection shortlist."
          description="Explore the Germany-wide screening map and compare candidate connection points."
        />
      </main>
    </PublicLayout>
  );
}

function LegacyFinderDataSourcesPage() {
  return (
    <PublicLayout>
      <main id="main-content" className="section-page public-methodology-page">
        <PublicPageHero
          eyebrow="Power Finder Data & Methodology"
          title="See what the map supports—and what it cannot establish."
          description="Power Finder combines accepted public mapping with transparent screening rules. Representative electrical and hourly benchmarks validate the methodology separately; they are never presented as results for a named map node."
        >
          <Link to="/power-finder" className="public-button public-button-primary">
            Open Power Finder <ArrowRight aria-hidden="true" />
          </Link>
        </PublicPageHero>

        <div className="public-page-content">
          <section className="methodology-outcomes" aria-labelledby="finder-method-title">
            <p className="context-label">What The MVP Delivers</p>
            <h2 id="finder-method-title">
              Transparent evidence for deciding where to investigate.
            </h2>
            <div>
              <article>
                <Map aria-hidden="true" />
                <h3>Mapped infrastructure</h3>
                <p>
                  Accepted regional releases show mapped nodes, corridors, industrial sites, and
                  registered assets.
                </p>
              </article>
              <article>
                <Calculator aria-hidden="true" />
                <h3>Comparable screening context</h3>
                <p>
                  Distance, mapped voltage, operator context, and evidence completeness help compare
                  starting points.
                </p>
              </article>
              <article>
                <Database aria-hidden="true" />
                <h3>Traceable sources</h3>
                <p>
                  Source, licence, retrieval date, and evidence limitations remain visible with the
                  mapped data.
                </p>
              </article>
              <article>
                <Calculator aria-hidden="true" />
                <h3>Public Data Confidence</h3>
                <p>
                  Field-level statuses distinguish confirmed, corroborated, mapped, inferred and
                  unknown evidence without presenting data completeness as a probability.
                </p>
              </article>
              <article id="electrical-models">
                <Network aria-hidden="true" />
                <h3>Electrical model boundary</h3>
                <p>
                  SimBench validates solver workflows on representative German networks. A named
                  node receives electrical results only after a reviewed operator model is linked.
                </p>
              </article>
              <article id="hourly-scenarios">
                <Calculator aria-hidden="true" />
                <h3>Hourly scenario boundary</h3>
                <p>
                  SMARD, DWD and MaStR can inform benchmark operating cases. They do not establish
                  an hourly connection envelope for a mapped substation without operator data.
                </p>
              </article>
            </div>
          </section>

          <section className="methodology-boundary" aria-labelledby="activation-method-title">
            <div>
              <p className="context-label">Finder To Activation</p>
              <h2 id="activation-method-title">One journey, with explicit study modes.</h2>
              <p>
                A selected Power Finder candidate can open an Activation Study without leaving the
                map. The map remains public geographic context; electrical and hourly conclusions
                retain the model and evidence class that produced them.
              </p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mode</th>
                    <th>Supports</th>
                    <th>Does not support</th>
                    <th>Next gate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Public screening</td>
                    <td>Evidence, voltage and proximity investigation priority</td>
                    <td>Capacity, feasibility, cost or timing</td>
                    <td>Select and save a candidate</td>
                  </tr>
                  <tr>
                    <td>Synthetic demonstration</td>
                    <td>Representative firm, flexible, BESS and staged comparisons</td>
                    <td>Capacity at the mapped node</td>
                    <td>Obtain a licensed operator model and project evidence</td>
                  </tr>
                  <tr>
                    <td>Operator model — unvalidated</td>
                    <td>Scoped model calculation and reconciliation work</td>
                    <td>Operator-approved capacity</td>
                    <td>Reconcile topology, parameters and observations</td>
                  </tr>
                  <tr>
                    <td>Operator reviewed</td>
                    <td>Reviewed results within the declared study scope</td>
                    <td>A connection offer or reservation unless separately evidenced</td>
                    <td>Capture the written operator decision</td>
                  </tr>
                  <tr>
                    <td>Operator confirmed</td>
                    <td>Claims explicitly supported by the confirmed scope</td>
                    <td>Claims outside its validity period and conditions</td>
                    <td>Operate and monitor the agreed envelope</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="methodology-outcomes" aria-labelledby="activation-calculation-title">
            <p className="context-label">Activation Benchmark</p>
            <h2 id="activation-calculation-title">
              The public benchmark reuses governed GridPulse methods.
            </h2>
            <div>
              <article>
                <Calculator aria-hidden="true" />
                <h3>Annual operating profile</h3>
                <p>
                  Release 1 evaluates 27 deterministic operating cases across three weather years,
                  demand cases and renewable-coincidence cases: 236,520 modeled hours per bus.
                </p>
              </article>
              <article>
                <Network aria-hidden="true" />
                <h3>Reference-network security</h3>
                <p>
                  Release B compares base, high-load, outage and target-year sensitivities on an
                  explicitly synthetic bounded network.
                </p>
              </article>
              <article>
                <Calculator aria-hidden="true" />
                <h3>Shared option engine</h3>
                <p>
                  Firm, reduced-firm, staged, static-flexible, dynamic-flexible and
                  storage-supported options reuse the same FCA calculation engine used in private
                  assessments.
                </p>
              </article>
              <article>
                <Database aria-hidden="true" />
                <h3>Registered studies</h3>
                <p>
                  C1, C2 and C3 registries distinguish benchmark artifacts from model-linked node
                  studies and preserve validation metadata.
                </p>
              </article>
              <article>
                <Calculator aria-hidden="true" />
                <h3>Constraint-led comparison</h3>
                <p>
                  Every public strategy is tested against one central case and a versioned 27-case
                  operating ensemble. Firm, reduced, staged, flexible and storage-supported
                  strategies differ only through their declared connection envelope and
                  customer-side response.
                </p>
              </article>
              <article>
                <Calculator aria-hidden="true" />
                <h3>Recommendation method</h3>
                <p>
                  A representative pathway is recommended only when it meets the declared minimum
                  and has the inputs required for analysis. When all options fail, GridPulse shows
                  the strongest investigation hypothesis without calling it a recommendation.
                  Synthetic calculations never alter the public evidence-based candidate rank.
                </p>
              </article>
              <article>
                <Database aria-hidden="true" />
                <h3>Commercial sensitivity</h3>
                <p>
                  GridPulse supplies no default business case. A user must explicitly enter value,
                  acceleration, flexibility and battery-cost assumptions before a sensitivity is
                  calculated. Failed or stale technical strategies cannot support a positive value
                  result.
                </p>
              </article>
              <article>
                <ShieldCheck aria-hidden="true" />
                <h3>Validation ladder</h3>
                <p>
                  Public evidence and customer declarations support the benchmark. A linked,
                  reconciled and reviewed operator model is required before results become
                  node-specific, and written confirmation still controls connection terms.
                </p>
              </article>
              <article>
                <Network aria-hidden="true" />
                <h3>Release 2 AI prioritisation</h3>
                <p>
                  A private gradient-boosting surrogate ranks uncertain, boundary and
                  out-of-distribution cases for active learning. Mandatory contingencies bypass
                  ranking, every selected result is recalculated by Pandapower, and false-safe,
                  label-diversity, complete selected-batch physics coverage and mandatory N-1
                  coverage gates control promotion. This routing engine is validated on a separate
                  synthetic fixture and is not applied to Berlin map values. Surrogate predictions
                  are never displayed as capacity.
                </p>
              </article>
              <article>
                <ShieldCheck aria-hidden="true" />
                <h3>Release 3 shadow governance</h3>
                <p>
                  Challenger predictions run beside authoritative physics to measure error,
                  false-safe outcomes, out-of-distribution states, binding accuracy and feature
                  drift. Internal champion status additionally requires an accepted operator model,
                  signed training permission and operator review. It still cannot create a capacity
                  claim.
                </p>
              </article>
              <article>
                <Network aria-hidden="true" />
                <h3>Release 4 operator-pilot gate</h3>
                <p>
                  The complete synthetic package rehearses operator-model replacement, Neo4j study
                  prioritisation, solver replay, SCADA reconciliation and evidence lineage. Public
                  capacity remains disabled until real operator network, ratings, measurements and
                  security criteria pass reconciliation and signed data-use and capacity-display
                  permission are recorded.
                </p>
              </article>
              <article>
                <FileCheck2 aria-hidden="true" />
                <h3>Release 5 operator evidence control</h3>
                <p>
                  Operator correspondence can be machine-highlighted for review, but extracted
                  values remain linked to the source and never overwrite customer declarations.
                  Conflicts stay visible, authenticated grid-expert approval is required, and
                  restriction events are non-operational rehearsals. They neither dispatch equipment
                  nor establish mapped capacity.
                </p>
              </article>
            </div>
          </section>

          <section className="methodology-boundary" aria-labelledby="graph-method-title">
            <div>
              <p className="context-label">Private Topology Intelligence</p>
              <h2 id="graph-method-title">Neo4j organises pathways and study evidence—not MW.</h2>
              <p>
                Inside an authorised operator workspace, GridPulse projects a versioned electrical
                model into Neo4j to inspect connectivity, alternative pathways, bridge assets,
                shared upstream dependencies and scenario relevance. The graph proposes and explains
                the study space; a verified electrical solver remains authoritative.
              </p>
            </div>
            <div className="methodology-boundary-grid">
              <article>
                <h3>Graph-derived evidence supports</h3>
                <ul>
                  <li>Reviewed candidate-to-model-bus reconciliation</li>
                  <li>Bounded alternative topology pathways</li>
                  <li>Bridge, articulation and radial-exposure investigation</li>
                  <li>Mandatory-contingency-preserving scenario prioritisation</li>
                  <li>Shared upstream exposure across a candidate portfolio</li>
                  <li>Version lineage, invalidation and stale-result detection</li>
                </ul>
              </article>
              <article>
                <h3>Graph-derived evidence does not establish</h3>
                <ul>
                  <li>Available, reserved or connectable capacity</li>
                  <li>Connection probability or queue position</li>
                  <li>Voltage, thermal or contingency feasibility without physics</li>
                  <li>Operator-approved switching or restoration actions</li>
                  <li>Connection cost, offer or delivery date</li>
                  <li>Operator confirmation without the governed review gate</li>
                </ul>
              </article>
            </div>
          </section>

          <section className="methodology-boundary" aria-labelledby="calculated-map-title">
            <div>
              <p className="context-label">Calculated Capacity Map</p>
              <h2 id="calculated-map-title">
                MW appears only after topology reconciliation and an electrical solve.
              </h2>
              <p>
                Power Finder keeps the geographic map visible and adds governed private capacity
                through the Capacity Opportunities control. Required power and capacity-basis
                controls classify, filter and reorder existing governed results; they do not run a
                new electrical calculation or create missing MW. Its separate reference lab runs
                Pandapower on the open SimBench network and uses the configured topology
                provider—Neo4j GDS when configured, with the deterministic graph fallback for
                reproducible public builds—to expose traceable pathways; its results stay in a
                labelled inset and never colour OpenStreetMap infrastructure. The private source
                reuses Power Finder geography. An accepted candidate-to-model-bus link supplies
                graph context; a versioned electrical engine then calculates firm, flexible,
                BESS-assisted and staged results. AI explains and compares those governed outputs
                but does not invent or calculate MW independently.
              </p>
            </div>
            <div className="methodology-boundary-grid">
              <article>
                <h3>Required result lineage</h3>
                <ul>
                  <li>
                    Reference: SimBench model/version, ODbL attribution, graph projection hash and
                    solver hash
                  </li>
                  <li>
                    Activatable capacity: 27 deterministic synthetic operating cases (236,520 hours)
                    bounded by each reference bus&apos;s solved Pandapower N-0 ceiling
                  </li>
                  <li>
                    P10/P50/P90 describes spread across mocked operating scenarios, not statistical
                    operator confidence; the fixture and field-level evidence classes are hashed
                  </li>
                  <li>
                    Operating commitments: restricted hours and energy, maximum reduction, event
                    duration, and battery state-of-charge constraints
                  </li>
                  <li>Accepted private model and candidate-to-bus reconciliation</li>
                  <li>Scenario, equipment ratings, operating snapshot and security criterion</li>
                  <li>Completed solver run with engine, input and dependency hashes</li>
                  <li>Binding constraint, restricted hours and result validation state</li>
                  <li>Operator review and validity period where claimed</li>
                </ul>
              </article>
              <article>
                <h3>Map safeguards</h3>
                <ul>
                  <li>Unknown nodes remain grey; unknown never means zero</li>
                  <li>
                    The required-power threshold compares results; it is not a capacity calculation
                  </li>
                  <li>Synthetic benchmarks never colour public infrastructure</li>
                  <li>
                    Reference MW is shown only against anonymous buses in the separate Reference
                    Capacity Lab
                  </li>
                  <li>Stale results remain visible but cannot support recommendations</li>
                  <li>Private results remain workspace-scoped and access-controlled</li>
                  <li>Calculated capacity is not a connection offer or reservation</li>
                </ul>
              </article>
            </div>
          </section>

          <section className="methodology-boundary" aria-labelledby="finder-boundary-title">
            <div>
              <p className="context-label">Decision Boundary</p>
              <h2 id="finder-boundary-title">Screen with the map. Confirm with the operator.</h2>
            </div>
            <div className="methodology-boundary-grid">
              <article>
                <h3>Power Finder shows</h3>
                <ul>
                  <li>Published and mapped infrastructure context</li>
                  <li>
                    Private node-specific calculated capacity when a governed study is available
                  </li>
                  <li>Indicative proximity and voltage context</li>
                  <li>Registered-asset context where accepted</li>
                  <li>Source provenance and known evidence gaps</li>
                  <li>Field-level public data confidence with visible evidence classes</li>
                  <li>Investigation priority based on evidence, voltage context and proximity</li>
                  <li>Applicable German rule families and operator-confirmation questions</li>
                </ul>
              </article>
              <article>
                <h3>Power Finder does not confirm</h3>
                <ul>
                  <li>Public or synthetic capacity at uncalculated nodes</li>
                  <li>Technical or commercial feasibility</li>
                  <li>AC/DC power flow, voltage, fault level, protection or N-1 results</li>
                  <li>Reinforcement cost or connection terms</li>
                  <li>Approval or energisation timing</li>
                  <li>Actual equipment ratings, loading, N-1 security or connection queue</li>
                </ul>
              </article>
            </div>
          </section>

          <section className="authority-section" aria-labelledby="finder-sources-title">
            <p className="context-label">Source Classes</p>
            <h2 id="finder-sources-title">Public evidence has limits.</h2>
            <div className="authority-grid">
              {authorityGroups.slice(0, 4).map(({ icon: Icon, ...item }) => (
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
        </div>

        <PublicCTA
          eyebrow="Power Finder MVP"
          title="Explore the current screening release."
          description="Review mapped infrastructure and evidence for Brandenburg."
        />
      </main>
    </PublicLayout>
  );
}
