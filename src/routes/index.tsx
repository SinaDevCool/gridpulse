import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileCheck2, MapPin, ShieldCheck, Zap } from "lucide-react";
import { ConnectionCaseExperience } from "@/components/product/ConnectionCaseExperience";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GridPulse | German Grid Connection Intelligence" },
      {
        name: "description",
        content:
          "GridPulse helps data centres, battery projects and industrial loads screen, prepare and execute evidence-based grid-connection strategies in Germany.",
      },
      { property: "og:title", content: "GridPulse | Find a credible path to power" },
      {
        property: "og:description",
        content:
          "Evidence-led German grid-connection strategy for data centres, BESS and industrial loads.",
      },
      { property: "og:url", content: "https://gridpulseinsights.com/" },
      { name: "twitter:title", content: "GridPulse | German Grid Connection Intelligence" },
    ],
    links: [
      { rel: "canonical", href: "https://gridpulseinsights.com/" },
      { rel: "preload", href: "/landing/german-grid-hero.webp", as: "image" },
    ],
  }),
  component: CinematicLandingPage,
});

function Brand() {
  return (
    <Link to="/" className="cine-brand" aria-label="GridPulse home" translate="no">
      <span>GRID</span>PULSE
    </Link>
  );
}

const connectionPathways = [
  {
    pathway: "Full firm",
    capacity: "Requested load available without routine restriction",
    flexibility: "None required",
    evidence: "Operator study required",
    evidenceTone: "required",
    implication: "Reference case; reinforcement may be required",
    next: "Request the formal grid study",
  },
  {
    pathway: "Reduced firm",
    capacity: "Lower guaranteed import or export limit",
    flexibility: "Low",
    evidence: "Operator limit required",
    evidenceTone: "required",
    implication: "Earlier partial energisation may be possible",
    next: "Confirm the minimum viable capacity",
  },
  {
    pathway: "Staged capacity",
    capacity: "Defined ramp aligned with network works",
    flexibility: "Planned",
    evidence: "Planning scenario",
    evidenceTone: "assumption",
    implication: "Phases project delivery and investment",
    next: "Model the load-ramp milestones",
  },
  {
    pathway: "Static flexible",
    capacity: "Fixed limits for specified periods",
    flexibility: "Conditional",
    evidence: "Operator terms required",
    evidenceTone: "required",
    implication: "Can bridge constrained operating periods",
    next: "Request limits and restriction windows",
  },
  {
    pathway: "Dynamic flexible",
    capacity: "Limits change with network conditions",
    flexibility: "Active",
    evidence: "Operator schedule required",
    evidenceTone: "required",
    implication: "Requires controls and commercial tolerance",
    next: "Define signals, controls, and liability",
  },
] as const;

const pilotInputs = [
  "1–3 customer-selected candidate locations",
  "Requested, minimum viable, and phased MW",
  "Available technical and operator evidence",
] as const;

const pilotOutputs = [
  "Candidate-site readiness comparison",
  "Firm, reduced, staged, and flexible pathway review",
  "Operator question register and engagement package",
  "Management decision memo with assumptions and next actions",
] as const;

const transmissionOperators = ["50Hertz", "Amprion", "TenneT Germany", "TransnetBW"] as const;

const germanResponsibilityLayers = [
  {
    number: "01",
    label: "Transmission context",
    title: "Frame the wider system",
    description:
      "Record the relevant transmission context without treating a national control area as proof of connection responsibility.",
    status: "Public context",
  },
  {
    number: "02",
    label: "Distribution responsibility",
    title: "Confirm the responsible operator",
    description:
      "Identify the likely distribution network operator, then mark responsibility as unresolved until project-level confirmation is obtained.",
    status: "Confirmation required",
  },
  {
    number: "03",
    label: "Project requirements",
    title: "Assemble the operator-specific case",
    description:
      "Structure the site, load, voltage, technical configuration, land status, milestones, and evidence requested for the project.",
    status: "Project evidence",
  },
  {
    number: "04",
    label: "Formal validation",
    title: "Keep the decision boundary explicit",
    description:
      "Treat connection point, available capacity, required works, restrictions, timing, and final terms as operator-controlled conclusions.",
    status: "Operator controlled",
  },
] as const;

const businessOutcomes = [
  {
    number: "01",
    title: "Discover blockers earlier",
    description:
      "Identify missing operator evidence and unresolved technical requirements before a formal submission is assembled.",
    artifact: "Evidence-gap register",
    measure: "Gaps identified before submission",
  },
  {
    number: "02",
    title: "Prepare stronger engagement",
    description:
      "Give project teams a structured package of site data, technical requirements, evidence, assumptions, and specific operator questions.",
    artifact: "Operator-engagement package",
    measure: "Package completeness and open questions",
  },
  {
    number: "03",
    title: "Preserve the decision record",
    description:
      "Keep every source, change, response, dependency, and conclusion connected to the selected connection strategy.",
    artifact: "Versioned decision memo",
    measure: "Material conclusions with traceable evidence",
  },
  {
    number: "04",
    title: "Coordinate execution",
    description:
      "Track documents, owners, deadlines, operator responses, and decision gates through one project record.",
    artifact: "Action and decision log",
    measure: "Open actions, overdue items, and gate status",
  },
] as const;

function CinematicLandingPage() {
  return (
    <div className="cine-page">
      <header className="cine-header">
        <Brand />
        <nav aria-label="Primary navigation">
          <a href="#platform">Platform</a>
          <a href="#constraint">Capabilities</a>
          <Link to="/service">Connection Assessment</Link>
          <a href="#method">How it works</a>
          <a href="#methodology">German Process</a>
        </nav>
        <div className="cine-header-actions">
          <Link to="/portfolio">Open workspace</Link>
          <Link to="/pilot" className="cine-cta cine-cta-solid">
            Start a Pilot
          </Link>
        </div>
      </header>

      <main id="main-content">
        <section className="cine-hero" id="platform">
          <img
            className="cine-hero-image"
            src="/landing/german-grid-hero.webp"
            width="1942"
            height="809"
            alt="German electrical substation and industrial infrastructure at blue hour"
            fetchPriority="high"
            decoding="async"
          />
          <svg className="cine-power-route" viewBox="0 0 900 540" aria-hidden="true">
            <path d="M470 468 C570 430 565 350 670 324 S735 214 862 174" />
          </svg>
          <div className="cine-hero-shade" />
          <div className="cine-hero-copy">
            <p className="cine-hero-eyebrow">German Grid-Connection Decision Support</p>
            <h1>Find the fastest credible path to power.</h1>
            <p>
              GridPulse turns grid evidence, operator requirements and project constraints into an
              actionable connection strategy for German infrastructure.
            </p>
            <div className="cine-actions">
              <Link to="/pilot" className="cine-cta cine-cta-solid">
                Start a Pilot <ArrowRight aria-hidden="true" />
              </Link>
              <Link to="/demo" className="cine-cta cine-cta-line">
                Explore the Platform <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <ul className="cine-hero-provenance" aria-label="Data provenance and validation status">
              <li>Public context</li>
              <li>Customer inputs</li>
              <li className="is-warning">Operator confirmation required</li>
            </ul>
          </div>
          <a
            className="cine-scroll"
            href="#constraint"
            aria-label="Continue to the connection problem"
          >
            <span /> Scroll to trace the route
          </a>
        </section>

        <section className="cine-capabilities" id="constraint">
          <div className="cine-capabilities-heading">
            <div>
              <span>Three connected capabilities</span>
              <h2>Move from a possible site to an executable connection pathway.</h2>
            </div>
            <p>
              GridPulse structures the decisions before, during and after network-operator
              engagement. Public context guides screening; operator evidence remains controlling.
            </p>
          </div>

          <div className="cine-capability-grid">
            <article className="cine-capability-card is-finder">
              <CapabilityCardHeader
                icon={<MapPin aria-hidden="true" />}
                index="01"
                title="Connection Finder"
                status="Screening"
              />
              <FinderDiagram />
              <div className="cine-capability-copy">
                <p>
                  Screen the project location, requested power and likely network responsibility
                  before starting formal engagement.
                </p>
                <ul>
                  <li>Site and voltage context</li>
                  <li>Likely operator responsibility</li>
                  <li>Evidence gaps and next actions</li>
                </ul>
                <Link to="/service">
                  Start a connection assessment <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </article>

            <article className="cine-capability-card is-activation">
              <CapabilityCardHeader
                icon={<Zap aria-hidden="true" />}
                index="02"
                title="Activation Planning"
                status="Scenario design"
              />
              <ActivationDiagram />
              <div className="cine-capability-copy">
                <p>
                  Compare firm, staged and flexible connection approaches against declared project
                  constraints and required operator evidence.
                </p>
                <ul>
                  <li>Import and export envelopes</li>
                  <li>Static and dynamic FCA options</li>
                  <li>Assumptions separated from evidence</li>
                </ul>
                <Link to="/demo">
                  Explore the planning workflow <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </article>

            <article className="cine-capability-card is-delivery">
              <CapabilityCardHeader
                icon={<FileCheck2 aria-hidden="true" />}
                index="03"
                title="Delivery Workspace"
                status="Execution"
              />
              <DeliveryDiagram />
              <div className="cine-capability-copy">
                <p>
                  Keep documents, validations, actions and decision outputs connected to one
                  traceable project record.
                </p>
                <ul>
                  <li>Evidence ledger and provenance</li>
                  <li>Review gates and responsibilities</li>
                  <li>Submission and decision packages</li>
                </ul>
                <Link to="/portfolio">
                  Open the delivery workspace <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </article>
          </div>

          <div className="cine-capability-truth" role="note">
            <ShieldCheck aria-hidden="true" />
            <p>
              <strong>Decision support, with an explicit validation boundary.</strong> GridPulse can
              screen, compare and prepare. The responsible network operator confirms capacity,
              connection terms and operating restrictions.
            </p>
          </div>
        </section>

        <section className="cine-method" id="method">
          <div className="cine-method-intro">
            <span>The GridPulse method</span>
            <h2>Screen. Prepare. Execute.</h2>
            <p>
              Move one connection case from first review to operator engagement without losing the
              evidence, assumptions, or reasoning behind the route.
            </p>
            <div className="cine-method-boundary" role="note">
              <ShieldCheck aria-hidden="true" />
              <span>GridPulse structures the case. The network operator validates capacity.</span>
            </div>
          </div>
          <div
            className="cine-method-route"
            aria-label="GridPulse method: Screen, Prepare, Execute"
          >
            <MethodStep
              number="01"
              title="Screen"
              action="Expose what is known—and what still controls the route."
              activities={[
                "Establish site and load context",
                "Identify likely network responsibility",
                "Record public evidence",
                "Expose unknowns and validation gates",
              ]}
              output="Screening brief and evidence-gap register"
            />
            <MethodStep
              number="02"
              title="Prepare"
              action="Turn fragmented inputs into a credible operator package."
              activities={[
                "Structure technical requirements",
                "Assemble the evidence package",
                "Compare viable connection approaches",
                "Prepare operator questions and submissions",
              ]}
              output="Operator-engagement package and pathway comparison"
            />
            <MethodStep
              number="03"
              title="Execute"
              action="Keep the project moving on one auditable record."
              activities={[
                "Track documents and responses",
                "Coordinate owners and deadlines",
                "Record decisions and dependencies",
                "Preserve the reasoning behind the selected route",
              ]}
              output="Decision record with owners, gates, and next actions"
            />
          </div>
        </section>

        <section className="cine-product" id="product-demo" aria-labelledby="product-demo-title">
          <div className="cine-product-copy">
            <span>Working product</span>
            <h2 id="product-demo-title">Inspect one connection case across 5 working views.</h2>
            <p>
              This illustrative Berlin–Brandenburg assessment keeps the project requirement,
              evidence state, connection hypotheses, execution work, and decision logic connected.
            </p>

            <dl className="cine-product-summary">
              <div>
                <dt>Requested capacity</dt>
                <dd>60 MW import · 40 MW export</dd>
              </div>
              <div>
                <dt>Likely responsibility</dt>
                <dd>E.DIS Netz · confirmation required</dd>
              </div>
              <div>
                <dt>Target connection</dt>
                <dd>110 kV · 40 MW / 80 MWh BESS</dd>
              </div>
            </dl>

            <div className="cine-product-readiness" role="note">
              <span>Current evidence state</span>
              <strong>5 of 7 items recorded</strong>
              <p>2 operator-controlled items still block the decision memo.</p>
            </div>

            <div className="cine-product-next">
              <span>Recommended next action</span>
              <p>
                Confirm operator responsibility and request capacity and FCA operating evidence.
              </p>
            </div>

            <Link to="/demo" className="cine-text-link">
              Open the Complete Demonstration <ArrowRight aria-hidden="true" />
            </Link>
          </div>

          <div className="cine-product-demo">
            <header>
              <span>Live product walkthrough</span>
              <b>Berlin–Brandenburg BESS + AI Load</b>
              <em>Illustrative assessment</em>
            </header>
            <ConnectionCaseExperience mode="preview" initialStage="site" />
          </div>
        </section>

        <section className="cine-decision-matrix" id="pathways">
          <div className="cine-matrix-heading">
            <div>
              <span>Connection pathway comparison</span>
              <h2>Compare the route—not an invented capacity number.</h2>
            </div>
            <p>
              GridPulse keeps commercial options visible while distinguishing customer hypotheses
              from the evidence only the responsible network operator can provide.
            </p>
          </div>
          <div className="cine-matrix-shell">
            <table>
              <thead>
                <tr>
                  <th scope="col">Pathway</th>
                  <th scope="col">Capacity approach</th>
                  <th scope="col">Flexibility</th>
                  <th scope="col">Evidence status</th>
                  <th scope="col">Commercial implication</th>
                  <th scope="col">Controlling next step</th>
                </tr>
              </thead>
              <tbody>
                {connectionPathways.map((item) => (
                  <tr key={item.pathway}>
                    <th scope="row">{item.pathway}</th>
                    <td>{item.capacity}</td>
                    <td>{item.flexibility}</td>
                    <td>
                      <span className={`cine-evidence-chip is-${item.evidenceTone}`}>
                        {item.evidence}
                      </span>
                    </td>
                    <td>{item.implication}</td>
                    <td>{item.next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="cine-matrix-note">
            These are comparison structures, not connection offers. Feasibility, capacity,
            restrictions, timing, and liability remain subject to operator review and agreement.
          </p>
        </section>

        <section className="cine-germany" id="german-market" aria-labelledby="german-market-title">
          <div className="cine-germany-copy">
            <span>German operator context</span>
            <h2 id="german-market-title">One geography. Project-specific responsibility.</h2>
            <p>
              GridPulse structures the connection case around the responsible German operator and
              the evidence required for that specific project.
            </p>
            <p className="cine-germany-caveat">
              It does not infer available capacity or replace the operator&apos;s formal assessment.
            </p>
            <div className="cine-germany-sources" aria-label="German market sources">
              <a href="https://www.netztransparenz.de/" target="_blank" rel="noreferrer">
                German TSO context <ArrowRight aria-hidden="true" />
              </a>
              <a
                href="https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/Netzanschluss/artikel.html"
                target="_blank"
                rel="noreferrer"
              >
                Connection framework <ArrowRight aria-hidden="true" />
              </a>
            </div>
          </div>

          <figure className="cine-germany-figure">
            <div
              className="cine-germany-map"
              role="img"
              aria-label="Geographically accurate national outline of Germany without transmission or distribution boundaries"
            >
              <div className="cine-germany-outline" aria-hidden="true" />
              <div className="cine-germany-coordinate" aria-hidden="true">
                <i />
                <span>Project location</span>
              </div>
              <div className="cine-map-status">
                <i aria-hidden="true" />
                National outline · no inferred network boundary
              </div>
            </div>
            <figcaption>
              <span>Transmission context—not connection responsibility</span>
              <ul aria-label="German transmission system operators">
                {transmissionOperators.map((operator) => (
                  <li key={operator} translate="no">
                    {operator}
                  </li>
                ))}
              </ul>
              <small>
                The responsible distribution or transmission operator must be confirmed for the
                specific site, voltage level, and requested connection.
              </small>
            </figcaption>
          </figure>

          <ol className="cine-germany-list" aria-label="German connection responsibility model">
            {germanResponsibilityLayers.map((layer) => (
              <li key={layer.number}>
                <b>{layer.number}</b>
                <div>
                  <span>{layer.label}</span>
                  <strong>{layer.title}</strong>
                  <small>{layer.description}</small>
                  <em>{layer.status}</em>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="cine-methodology" id="methodology">
          <div className="cine-methodology-intro">
            <span>Built for German connection decisions</span>
            <h2>Three validation boundaries keep the analysis credible.</h2>
          </div>
          <div className="cine-methodology-grid">
            <article>
              <b>01</b>
              <span>Public context</span>
              <h3>Useful for screening</h3>
              <p>
                Geographic, regulatory, and published operator information helps frame the case. It
                does not establish deliverable node capacity.
              </p>
            </article>
            <article>
              <b>02</b>
              <span>Project evidence</span>
              <h3>Required for maturity</h3>
              <p>
                Land, load, technical configuration, milestones, and application documents support a
                credible and reviewable request.
              </p>
            </article>
            <article>
              <b>03</b>
              <span>Operator evidence</span>
              <h3>Controls the conclusion</h3>
              <p>
                Capacity, connection point, works, schedule, flexible limits, and final conditions
                require confirmation by the responsible operator.
              </p>
            </article>
          </div>
          <div className="cine-methodology-footer">
            <span>Source-aware by design</span>
            <p>
              Each material output is labelled as customer-declared, public context, assumption,
              calculation, reviewed evidence, or operator-confirmed.
            </p>
            <Link to="/data-sources">
              Review the source register <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="cine-outcomes" id="outcomes" aria-labelledby="outcomes-heading">
          <div className="cine-outcomes-heading">
            <div>
              <span>Operational value</span>
              <h2 id="outcomes-heading">Reduce avoidable friction before operator validation.</h2>
            </div>
            <div className="cine-outcomes-intro">
              <p>
                GridPulse makes the customer-side connection process more complete, reviewable, and
                executable. Each outcome produces a concrete project artifact and a pilot
                measure—not an unsupported capacity or connection-speed claim.
              </p>
              <Link to="/pilot">
                Define a Measurable Pilot <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>

          <ol className="cine-outcomes-grid" aria-label="GridPulse operational outcomes">
            {businessOutcomes.map((outcome) => (
              <li key={outcome.number}>
                <article>
                  <header>
                    <b>{outcome.number}</b>
                    <span>Customer-side outcome</span>
                  </header>
                  <h3>{outcome.title}</h3>
                  <p>{outcome.description}</p>
                  <dl>
                    <div>
                      <dt>Project artifact</dt>
                      <dd>{outcome.artifact}</dd>
                    </div>
                    <div>
                      <dt>Pilot measure</dt>
                      <dd>{outcome.measure}</dd>
                    </div>
                  </dl>
                </article>
              </li>
            ))}
          </ol>

          <aside className="cine-outcomes-boundary" aria-label="Outcome validation boundary">
            <ShieldCheck aria-hidden="true" />
            <div>
              <strong>
                Measure process improvement first. Attribute grid outcomes only with evidence.
              </strong>
              <p>
                Pilot baselines are recorded at kickoff. GridPulse does not claim reduced connection
                time, accelerated energisation, or activated megawatts unless a real project and the
                responsible operator provide evidence for that outcome.
              </p>
            </div>
          </aside>
        </section>

        <section className="cine-pilot" id="pilot">
          <img
            src="/landing/german-grid-hero.webp"
            width="1942"
            height="809"
            alt=""
            loading="lazy"
          />
          <div className="cine-pilot-shade" />
          <div className="cine-pilot-layout">
            <div className="cine-pilot-copy">
              <span>German connection-options pilot</span>
              <h2>Bring one real connection decision into focus.</h2>
              <p>
                GridPulse structures the evidence, compares credible pathways, and prepares the
                unresolved questions for network-operator engagement.
              </p>
              <div className="cine-actions">
                <Link to="/pilot" className="cine-cta cine-cta-solid">
                  Submit a Pilot Case <ArrowRight aria-hidden="true" />
                </Link>
                <Link to="/demo" className="cine-cta cine-cta-line">
                  Explore the Working Product <ArrowRight aria-hidden="true" />
                </Link>
              </div>
              <p className="cine-pilot-boundary">
                GridPulse does not provide a connection offer, capacity reservation, power-flow
                study, or operator approval.
              </p>
            </div>

            <div className="cine-pilot-brief">
              <header>
                <span>Pilot brief</span>
                <b>1 decision · up to 3 locations</b>
              </header>
              <div className="cine-pilot-columns">
                <div>
                  <span>You provide</span>
                  <ul>
                    {pilotInputs.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span>You receive</span>
                  <ul>
                    {pilotOutputs.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <footer>
                <span>Completion gate</span>
                <p>
                  Every conclusion retains its evidence class, limitation, owner, and next action.
                </p>
              </footer>
            </div>
          </div>
        </section>

        <section className="cine-roadmap" aria-labelledby="roadmap-heading">
          <div className="cine-roadmap-heading">
            <span>Product boundary</span>
            <h2 id="roadmap-heading">
              Useful now. Operator-integrated by evidence, not assertion.
            </h2>
          </div>
          <div className="cine-roadmap-grid">
            <article>
              <span>Available now</span>
              <h3>Decision-support workspace</h3>
              <p>
                Screen sites, classify evidence, compare connection hypotheses, coordinate reviews,
                and export an operator-engagement package.
              </p>
              <Link to="/demo">
                Inspect the current workflow <ArrowRight aria-hidden="true" />
              </Link>
            </article>
            <article className="is-future">
              <span>Partner-dependent roadmap</span>
              <h3>Operator-integrated activation</h3>
              <p>
                Validated network models, operating envelopes, telemetry, and control interfaces
                require utility and customer-system partnerships.
              </p>
              <Link to="/pilot">
                Discuss a design partnership <ArrowRight aria-hidden="true" />
              </Link>
            </article>
          </div>
        </section>
      </main>

      <footer className="cine-footer">
        <div className="cine-footer-brand">
          <Brand />
          <p>Evidence-led grid-connection decision support for German infrastructure projects.</p>
        </div>
        <nav aria-label="Product">
          <span>Product</span>
          <a href="#constraint">Capabilities</a>
          <Link to="/service">Connection Assessment</Link>
          <Link to="/demo">Working Product</Link>
          <Link to="/portfolio">Workspace</Link>
        </nav>
        <nav aria-label="Methodology">
          <span>Methodology</span>
          <a href="#pathways">Connection Pathways</a>
          <a href="#methodology">Validation Boundaries</a>
          <Link to="/data-sources">Source Register</Link>
          <Link to="/reports">Reports</Link>
        </nav>
        <nav aria-label="Engage">
          <span>Engage</span>
          <Link to="/pilot">Submit a Pilot Case</Link>
          <Link to="/auth">Sign In</Link>
          <a href="#platform">Back to Top</a>
        </nav>
        <div className="cine-footer-legal">
          <p>© 2026 GridPulse. Preliminary decision support only.</p>
          <p>
            Capacity, connection points, dates, limits, and final conditions require confirmation by
            the responsible network operator.
          </p>
        </div>
      </footer>
    </div>
  );
}

function CapabilityCardHeader({
  icon,
  index,
  title,
  status,
}: {
  icon: React.ReactNode;
  index: string;
  title: string;
  status: string;
}) {
  return (
    <header className="cine-capability-header">
      <span className="cine-capability-icon">{icon}</span>
      <div>
        <small>{index}</small>
        <h3>{title}</h3>
      </div>
      <em>{status}</em>
    </header>
  );
}

function FinderDiagram() {
  return (
    <div className="cine-capability-visual cine-finder-visual" aria-hidden="true">
      <span className="cine-map-label is-north">Transmission context</span>
      <span className="cine-map-label is-west">Distribution area</span>
      <span className="cine-map-label is-east">Likely operator</span>
      <i className="cine-map-line is-one" />
      <i className="cine-map-line is-two" />
      <i className="cine-map-node is-site" />
      <i className="cine-map-node is-operator" />
      <b>Proposed site</b>
      <strong>Responsibility to confirm</strong>
    </div>
  );
}

function ActivationDiagram() {
  return (
    <div className="cine-capability-visual cine-activation-visual" aria-hidden="true">
      <div className="cine-chart-legend">
        <span>Requested import</span>
        <span>Conditional envelope</span>
      </div>
      <div className="cine-capacity-bars">
        {[42, 58, 52, 70, 64, 82, 76, 90].map((height, index) => (
          <i key={height + index} style={{ height: `${height}%` }} />
        ))}
      </div>
      <svg viewBox="0 0 400 150" preserveAspectRatio="none">
        <path d="M0 104 C70 96 92 66 146 76 S226 114 276 62 S344 54 400 22" />
      </svg>
      <b>Operator evidence required</b>
    </div>
  );
}

function DeliveryDiagram() {
  return (
    <div className="cine-capability-visual cine-delivery-visual" aria-hidden="true">
      <div className="cine-delivery-nav">
        <span className="is-active">Evidence</span>
        <span>Actions</span>
        <span>Decision</span>
      </div>
      <div className="cine-delivery-rows">
        <span>
          <i className="is-complete" /> Technical inputs <b>Recorded</b>
        </span>
        <span>
          <i className="is-complete" /> Operator responsibility <b>Screened</b>
        </span>
        <span>
          <i className="is-required" /> Capacity statement <b>Required</b>
        </span>
      </div>
      <div className="cine-delivery-progress">
        <span />
        <span />
        <span className="is-open" />
        <span className="is-open" />
      </div>
    </div>
  );
}

function MethodStep({
  number,
  title,
  action,
  activities,
  output,
}: {
  number: string;
  title: string;
  action: string;
  activities: string[];
  output: string;
}) {
  return (
    <article className="cine-method-step">
      <div className="cine-method-step-heading">
        <b>{number}</b>
        <span aria-hidden="true" />
        <h3>{title}</h3>
      </div>
      <p className="cine-method-action">{action}</p>
      <ul>
        {activities.map((activity) => (
          <li key={activity}>{activity}</li>
        ))}
      </ul>
      <div className="cine-method-output">
        <span>Concrete output</span>
        <strong>{output}</strong>
        <ArrowRight aria-hidden="true" />
      </div>
    </article>
  );
}
