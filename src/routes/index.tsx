import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  MapPinned,
  Menu,
  Network,
  RadioTower,
  Route as RouteIcon,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import "../landing.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GridPulse | Build a Credible Route to Power in Germany" },
      {
        name: "description",
        content:
          "Qualify German project sites, compare firm and flexible grid-connection approaches, and prepare an operator-ready connection strategy with GridPulse.",
      },
      {
        property: "og:title",
        content: "Build a Credible Route to Power in Germany",
      },
      {
        property: "og:description",
        content:
          "Grid-connection discovery, strategy, and operator preparation for German data centres, battery projects, and large industrial loads.",
      },
      { property: "og:url", content: "https://gridpulseinsights.com/" },
      { name: "twitter:title", content: "GridPulse | Build a Credible Route to Power in Germany" },
    ],
    links: [
      { rel: "canonical", href: "https://gridpulseinsights.com/" },
      { rel: "preload", href: "/landing/german-grid-hero.webp", as: "image" },
    ],
  }),
  component: LandingPage,
});

const processSteps = [
  {
    number: "01",
    icon: MapPinned,
    title: "Discover the route",
    description:
      "Screen candidate sites, power requirements, likely network responsibility, and missing information.",
    output: "Site-screening brief",
  },
  {
    number: "02",
    icon: RouteIcon,
    title: "Design the connection strategy",
    description:
      "Compare firm, reduced, staged, and flexible approaches against the project’s operating constraints.",
    output: "Connection-strategy comparison",
  },
  {
    number: "03",
    icon: ClipboardCheck,
    title: "Prepare for activation",
    description:
      "Assemble the technical inputs, evidence package, and operator questions required to progress the connection.",
    output: "Operator-engagement package",
  },
] as const;

const regionRows = [
  {
    region: "Berlin",
    context: "50Hertz transmission context",
    responsibility: "Local operator confirmation required",
  },
  {
    region: "Brandenburg",
    context: "50Hertz transmission context",
    responsibility: "Site-level DSO confirmation required",
  },
  {
    region: "Hesse",
    context: "Amprion / TenneT context",
    responsibility: "Exact location and voltage required",
  },
  {
    region: "North Rhine-Westphalia",
    context: "Primarily Amprion context",
    responsibility: "Site-level DSO confirmation required",
  },
] as const;

const outcomes = [
  {
    icon: Network,
    title: "Qualify sites with less uncertainty",
    description:
      "Identify missing evidence, likely responsibility, and project-specific blockers before committing further development effort.",
  },
  {
    icon: RouteIcon,
    title: "Keep more connection options open",
    description:
      "Compare firm, staged, and flexible approaches before treating network reinforcement as the only route.",
  },
  {
    icon: FileCheck2,
    title: "Engage the operator with a stronger case",
    description:
      "Bring structured technical inputs, evidence, and specific connection questions to the responsible operator.",
  },
] as const;

function Brand() {
  return (
    <Link to="/" className="landing-brand" aria-label="GridPulse home" translate="no">
      <span>GRID</span>PULSE
    </Link>
  );
}

function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="landing-page">
      <header className="landing-header">
        <Brand />
        <nav className={menuOpen ? "is-open" : undefined} aria-label="Primary navigation">
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
            How It Works
          </a>
          <a href="#product" onClick={() => setMenuOpen(false)}>
            Product
          </a>
          <a href="#direction" onClick={() => setMenuOpen(false)}>
            Product Direction
          </a>
          <a href="#pilot" onClick={() => setMenuOpen(false)}>
            Pilot
          </a>
          <Link to="/auth" onClick={() => setMenuOpen(false)}>
            Sign In
          </Link>
          <Link to="/service" className="landing-header-cta" onClick={() => setMenuOpen(false)}>
            Start an Assessment
          </Link>
        </nav>
        <button
          className="landing-menu-button"
          type="button"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </header>

      <main id="main-content">
        <section className="landing-hero" aria-labelledby="hero-title">
          <img
            className="landing-hero-image"
            src="/landing/german-grid-hero.webp"
            width="1942"
            height="809"
            alt="German electrical substation and industrial infrastructure at blue hour"
            fetchPriority="high"
            decoding="async"
          />
          <div className="landing-hero-overlay" />
          <div className="landing-container landing-hero-content">
            <p className="landing-eyebrow">German Grid-Connection Decision Support</p>
            <h1 id="hero-title">Build a credible route to power in Germany.</h1>
            <p className="landing-hero-lead">
              GridPulse helps data centres, battery projects, and large industrial loads qualify
              sites, compare firm and flexible connection approaches, and prepare for
              network-operator engagement.
            </p>
            <div className="landing-actions">
              <Link to="/service" className="landing-button landing-button-primary">
                Start a Site Assessment <ArrowRight aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="landing-button landing-button-secondary">
                See How It Works
              </a>
            </div>
            <p className="landing-audience">
              Built for German projects where location, power requirements, and operational
              flexibility shape the connection strategy.
            </p>
          </div>
        </section>

        <section className="landing-section landing-region" aria-labelledby="region-title">
          <div className="landing-container">
            <div className="landing-section-heading landing-section-heading-split">
              <div>
                <p className="landing-eyebrow">Discover the Route</p>
                <h2 id="region-title">Start with the site and its network context.</h2>
              </div>
              <p>
                Location shapes the likely network responsibility, technical requirements, and
                connection options. Review indicative regional context before beginning a
                project-specific assessment.
              </p>
            </div>

            <div className="landing-region-panel">
              <div className="landing-table-wrap">
                <table>
                  <caption className="sr-only">Indicative German regional grid context</caption>
                  <thead>
                    <tr>
                      <th scope="col">Example region</th>
                      <th scope="col">Indicative context</th>
                      <th scope="col">What still needs confirmation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regionRows.map((row) => (
                      <tr key={row.region}>
                        <th scope="row">{row.region}</th>
                        <td>{row.context}</td>
                        <td>
                          <span className="landing-status-dot" aria-hidden="true" />
                          {row.responsibility}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <aside className="landing-region-aside">
                <MapPinned aria-hidden="true" />
                <h3>Regional context starts the investigation.</h3>
                <p>
                  Public information can guide an early screen, but it cannot confirm available
                  capacity, a connection point, or the responsible distribution operator for a
                  specific project.
                </p>
                <Link to="/service" className="landing-text-link">
                  Assess a Site <ArrowRight aria-hidden="true" />
                </Link>
              </aside>
            </div>
          </div>
        </section>

        <section
          className="landing-section landing-process"
          id="how-it-works"
          aria-labelledby="process-title"
        >
          <div className="landing-container">
            <div className="landing-section-heading landing-section-heading-centered">
              <p className="landing-eyebrow">The GridPulse Connection Journey</p>
              <h2 id="process-title">From an uncertain site to an operator-ready strategy.</h2>
              <p>
                Discover the route, design credible connection options, and prepare the evidence
                needed to progress the project.
              </p>
            </div>
            <ol className="landing-process-grid">
              {processSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <li key={step.number}>
                    <div className="landing-step-visual" aria-hidden="true">
                      <span>{step.number}</span>
                      <Icon />
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    <div className="landing-step-output">
                      <Check aria-hidden="true" />
                      <span>
                        <small>Result</small>
                        <strong>{step.output}</strong>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="landing-centered-action">
              <Link to="/demo" className="landing-text-link">
                Explore the Connection Workflow <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section
          className="landing-section landing-product"
          id="product"
          aria-labelledby="product-title"
        >
          <div className="landing-container landing-product-layout">
            <div className="landing-product-copy">
              <p className="landing-eyebrow">One Case. One Decision Record.</p>
              <h2 id="product-title">
                Keep the connection strategy, evidence, and next actions connected.
              </h2>
              <p>
                GridPulse brings site requirements, connection options, operator evidence, and
                unresolved decisions into one traceable project record.
              </p>
              <ul>
                <li>
                  <Check aria-hidden="true" /> Compare candidate-site readiness
                </li>
                <li>
                  <Check aria-hidden="true" /> Test firm, staged, and flexible approaches
                </li>
                <li>
                  <Check aria-hidden="true" /> Track operator evidence and activation dependencies
                </li>
              </ul>
              <Link to="/demo" className="landing-button landing-button-secondary">
                View the Working Product <ArrowRight aria-hidden="true" />
              </Link>
            </div>

            <div
              className="landing-product-window"
              aria-label="Illustrative GridPulse connection case"
            >
              <header>
                <div>
                  <span className="landing-window-mark" aria-hidden="true" />
                  <span>Connection Case</span>
                </div>
                <small>Illustrative assessment</small>
              </header>
              <div className="landing-product-case">
                <div className="landing-case-title">
                  <div>
                    <small>GP-DE-001</small>
                    <strong>Berlin–Brandenburg Energy Project</strong>
                  </div>
                  <span>Review in progress</span>
                </div>
                <div className="landing-case-metrics">
                  <div>
                    <small>Requested capacity</small>
                    <strong>60 MW requested</strong>
                  </div>
                  <div>
                    <small>Likely responsibility</small>
                    <strong>Confirmation required</strong>
                  </div>
                  <div>
                    <small>Evidence recorded</small>
                    <strong>5 of 7 items</strong>
                  </div>
                </div>
                <div className="landing-case-action">
                  <span>
                    <ClipboardCheck aria-hidden="true" />
                  </span>
                  <div>
                    <small>Recommended next action</small>
                    <strong>Confirm operator responsibility and request capacity evidence.</strong>
                  </div>
                  <ChevronRight aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section landing-outcomes" aria-labelledby="outcomes-title">
          <div className="landing-container">
            <div className="landing-section-heading landing-section-heading-centered">
              <p className="landing-eyebrow">What You Leave With</p>
              <h2 id="outcomes-title">
                A stronger connection decision before operator confirmation.
              </h2>
            </div>
            <div className="landing-outcomes-grid">
              {outcomes.map((outcome) => {
                const Icon = outcome.icon;
                return (
                  <article key={outcome.title}>
                    <Icon aria-hidden="true" />
                    <h3>{outcome.title}</h3>
                    <p>{outcome.description}</p>
                  </article>
                );
              })}
            </div>
            <aside className="landing-trust-note">
              <ShieldCheck aria-hidden="true" />
              <p>
                <strong>Decision support, not a connection offer.</strong> GridPulse supports
                customer-side discovery, connection-strategy design, and operator preparation.
                Available capacity, connection point, restrictions, works, timing, and final terms
                remain subject to confirmation by the responsible network operator.
              </p>
            </aside>
          </div>
        </section>

        <section
          className="landing-section landing-direction"
          id="direction"
          aria-labelledby="direction-title"
        >
          <div className="landing-container">
            <div className="landing-direction-heading">
              <div>
                <p className="landing-eyebrow">Product Direction</p>
                <h2 id="direction-title">From connection preparation to flexible operation.</h2>
              </div>
              <p>
                GridPulse is being developed toward operator-evidenced operating envelopes,
                constraint monitoring, and flexible-connection compliance.
              </p>
            </div>

            <div className="landing-direction-grid">
              <article className="is-current">
                <header>
                  <span>Available now</span>
                  <ClipboardCheck aria-hidden="true" />
                </header>
                <h3>Operator-ready decision support</h3>
                <p>
                  Site screening, connection-option comparison, evidence management, and
                  operator-engagement preparation.
                </p>
              </article>
              <article className="is-development">
                <header>
                  <span>Design-partner development</span>
                  <BarChart3 aria-hidden="true" />
                </header>
                <h3>Flexibility economics</h3>
                <p>
                  Compare agreed limits, operating restrictions, energy impacts, and the commercial
                  implications of flexible connection structures.
                </p>
              </article>
              <article className="is-future">
                <header>
                  <span>Future direction</span>
                  <RadioTower aria-hidden="true" />
                </header>
                <h3>Flexible operation</h3>
                <p>
                  Monitor operator-approved envelopes, constraints, instructions, and compliance
                  through future customer and utility integrations.
                </p>
              </article>
            </div>

            <div className="landing-direction-action">
              <Link to="/pilot" className="landing-text-link">
                Discuss a Design Partnership <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section className="landing-section landing-pilot" id="pilot" aria-labelledby="pilot-title">
          <div className="landing-container landing-pilot-layout">
            <div className="landing-pilot-copy">
              <p className="landing-eyebrow">Start With One Real Connection Decision</p>
              <h2 id="pilot-title">Test a credible route to power for your project.</h2>
              <p>
                Bring 1 project and up to 3 candidate locations. GridPulse will structure the
                evidence, compare credible connection approaches, and prepare the unresolved
                questions for operator engagement.
              </p>
              <div className="landing-actions">
                <Link to="/pilot" className="landing-button landing-button-primary">
                  Start a Pilot <ArrowRight aria-hidden="true" />
                </Link>
                <Link to="/pilot" className="landing-text-link">
                  Discuss Your Project
                </Link>
              </div>
            </div>
            <div className="landing-pilot-brief">
              <div>
                <h3>You provide</h3>
                <ul>
                  <li>
                    <MapPinned aria-hidden="true" /> Candidate locations
                  </li>
                  <li>
                    <Building2 aria-hidden="true" /> Requested and minimum viable MW
                  </li>
                  <li>
                    <FileCheck2 aria-hidden="true" /> Available technical and operator information
                  </li>
                </ul>
              </div>
              <div>
                <h3>You receive</h3>
                <ul>
                  <li>
                    <Check aria-hidden="true" /> Candidate-site readiness comparison
                  </li>
                  <li>
                    <Check aria-hidden="true" /> Firm, staged, and flexible connection review
                  </li>
                  <li>
                    <Check aria-hidden="true" /> Operator-engagement package and decision memo
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-content">
          <div>
            <Brand />
            <p>Grid-connection decision support for German infrastructure projects.</p>
          </div>
          <nav aria-label="Footer navigation">
            <a href="#how-it-works">How It Works</a>
            <a href="#product">Product</a>
            <a href="#direction">Product Direction</a>
            <Link to="/data-sources">Sources</Link>
            <Link to="/auth">Sign In</Link>
          </nav>
        </div>
        <div className="landing-container landing-footer-legal">
          <span>© 2026 GridPulse</span>
          <span>Preliminary decision support only.</span>
        </div>
      </footer>
    </div>
  );
}
