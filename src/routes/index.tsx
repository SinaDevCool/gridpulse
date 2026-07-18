import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  FileCheck2,
  FileText,
  MapPin,
  Network,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useAuth } from "@/context/useAuth";

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

const productTabs = [
  "Site context",
  "Connection scenarios",
  "Evidence ledger",
  "Execution room",
  "Decision memo",
] as const;

function Brand() {
  return (
    <Link to="/" className="cine-brand" aria-label="GridPulse home">
      <span>GRID</span>PULSE
    </Link>
  );
}

function CinematicLandingPage() {
  const { user } = useAuth();
  const workspacePath = user ? "/portfolio" : "/auth";

  return (
    <div className="cine-page">
      <header className="cine-header">
        <Brand />
        <nav aria-label="Primary navigation">
          <a href="#platform">Platform</a>
          <a href="#method">How it works</a>
          <a href="#developers">For developers</a>
          <a href="#methodology">Methodology</a>
        </nav>
        <div className="cine-header-actions">
          <Link to={workspacePath}>{user ? "Open workspace" : "Sign in"}</Link>
          <Link to="/pilot" className="cine-cta cine-cta-solid">
            Bring us a project
          </Link>
        </div>
      </header>

      <main>
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
            <h1>Find the fastest credible path to power.</h1>
            <p>
              GridPulse turns grid evidence, operator requirements and project constraints into an
              actionable connection strategy for German infrastructure.
            </p>
            <div className="cine-actions">
              <Link to="/pilot" className="cine-cta cine-cta-solid">
                Bring us a project <ArrowRight />
              </Link>
              <Link to="/demo" className="cine-cta cine-cta-line">
                Explore the platform <ArrowRight />
              </Link>
            </div>
          </div>
          <a
            className="cine-scroll"
            href="#constraint"
            aria-label="Continue to the connection problem"
          >
            <span /> Scroll to trace the route
          </a>
        </section>

        <section className="cine-constraint" id="constraint">
          <div className="cine-section-copy">
            <h2>A site is not power-ready because it appears close to the grid.</h2>
            <p>
              Connection outcomes depend on fragmented evidence, operator requirements and competing
              constraints. GridPulse brings them together without presenting assumptions as
              capacity.
            </p>
          </div>
          <EvidenceRoute />
        </section>

        <section className="cine-transformation" id="developers">
          <div className="cine-section-heading">
            <span>Transformation story</span>
            <h2>From fragmented evidence to a connection decision.</h2>
            <p>
              One illustrative German case moves from declared requirements to an evidence-backed
              operator-engagement plan.
            </p>
          </div>
          <TransformationRail />
        </section>

        <section className="cine-method" id="method">
          <div className="cine-method-intro">
            <span>The GridPulse method</span>
            <h2>A practical route from first review to operator engagement.</h2>
            <p>Clarity, structure and traceability at every step.</p>
          </div>
          <MethodStep number="01" title="Screen">
            Map project context, likely operator responsibility and evidence gaps.
          </MethodStep>
          <MethodStep number="02" title="Prepare">
            Organise technical inputs and assemble the operator engagement package.
          </MethodStep>
          <MethodStep number="03" title="Execute">
            Coordinate decisions, documents and deadlines in one traceable workspace.
          </MethodStep>
        </section>

        <section className="cine-product" aria-labelledby="product-title">
          <div className="cine-product-copy">
            <span>Working product</span>
            <h2 id="product-title">See the connection case, not another presentation.</h2>
            <p>
              Explore the same assessment structure used for site context, scenarios, evidence,
              execution and decision reporting.
            </p>
            <Link to="/demo" className="cine-text-link">
              Open the complete demonstration <ArrowRight />
            </Link>
          </div>
          <ProductExperience />
        </section>

        <section className="cine-germany" id="methodology">
          <div className="cine-germany-copy">
            <span>The German market</span>
            <h2>Built around the way German connection projects actually move.</h2>
            <p>
              GridPulse aligns evidence and engagement with operator responsibility,
              project-specific requirements and formal validation.
            </p>
          </div>
          <GermanyMap />
          <ol className="cine-germany-list">
            <li>
              <b>01</b>
              <span>Distribution and transmission responsibility</span>
            </li>
            <li>
              <b>02</b>
              <span>Project-specific application evidence</span>
            </li>
            <li>
              <b>03</b>
              <span>BESS, data centres and industrial loads</span>
            </li>
            <li>
              <b>04</b>
              <span>Operator validation remains controlling</span>
            </li>
          </ol>
        </section>

        <section className="cine-outcomes">
          <h2>Make uncertainty actionable.</h2>
          <div>
            <Outcome index="01" title="Expose evidence gaps">
              See what is missing before operator engagement begins.
            </Outcome>
            <Outcome index="02" title="Preserve decision traceability">
              Keep inputs, assumptions and sources connected to every conclusion.
            </Outcome>
            <Outcome index="03" title="Coordinate the execution path">
              Give project teams one record for documents, milestones and decisions.
            </Outcome>
          </div>
        </section>

        <section className="cine-pilot">
          <img
            src="/landing/german-grid-hero.webp"
            width="1942"
            height="809"
            alt=""
            loading="lazy"
          />
          <div className="cine-pilot-shade" />
          <div className="cine-pilot-copy">
            <h2>Bring us one real connection case.</h2>
            <p>
              We’ll structure the evidence, identify the unresolved gates and prepare an
              operator-engagement pathway with your team.
            </p>
            <div className="cine-actions">
              <Link to="/pilot" className="cine-cta cine-cta-solid">
                Request a German pilot <ArrowRight />
              </Link>
              <Link to="/demo" className="cine-cta cine-cta-line">
                Explore the demonstration <ArrowRight />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="cine-footer">
        <Brand />
        <nav>
          <a href="#platform">Platform</a>
          <a href="#method">How it works</a>
          <Link to="/demo">Demonstration</Link>
          <Link to="/pilot">Pilot</Link>
        </nav>
        <p>
          Preliminary decision support only.
          <br />
          Validate all connection conclusions with the responsible network operator.
        </p>
      </footer>
    </div>
  );
}

const evidencePackages = [
  {
    eyebrow: "Project declaration",
    title: "Site and power requirement",
    source: "Customer input",
    status: "Recorded",
    tone: "complete",
    next: "Use as the declared basis for screening.",
    artifacts: ["Site coordinates", "60 MW import", "40 MW export"],
  },
  {
    eyebrow: "Technical configuration",
    title: "BESS, load and target voltage",
    source: "Technical schedule",
    status: "Recorded",
    tone: "complete",
    next: "Reconcile equipment data with the application package.",
    artifacts: ["40 MW / 80 MWh", "110 kV target", "Single-line draft"],
  },
  {
    eyebrow: "Operator responsibility",
    title: "Likely boundary and responsible DSO",
    source: "Public context",
    status: "Screened",
    tone: "screened",
    next: "Confirm responsibility directly with the network operator.",
    artifacts: ["Grid area", "Nearby assets", "Boundary screen"],
  },
  {
    eyebrow: "Connection evidence",
    title: "Capacity and operating conditions",
    source: "Operator evidence",
    status: "Required",
    tone: "required",
    next: "Request a capacity statement and any FCA operating schedule.",
    artifacts: ["Capacity statement", "FCA schedule", "Connection terms"],
  },
] as const;

function EvidenceRoute() {
  const routeRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(3);
  const selected = evidencePackages[selectedIndex];

  useEffect(() => {
    const route = routeRef.current;
    if (!route) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          route.classList.add("is-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.28 },
    );
    observer.observe(route);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={routeRef}
      className="cine-evidence-route"
      aria-label="Evidence is assembled into an engagement route"
    >
      <div className="cine-evidence-inputs" aria-label="Evidence packages">
        {evidencePackages.map((item, index) => (
          <button
            aria-pressed={selectedIndex === index}
            className={selectedIndex === index ? "is-selected" : ""}
            key={item.eyebrow}
            onClick={() => setSelectedIndex(index)}
            style={{ "--route-delay": `${index * 110}ms` } as React.CSSProperties}
            type="button"
          >
            <span className="cine-evidence-index">0{index + 1}</span>
            <span className="cine-evidence-copy">
              <small>{item.eyebrow}</small>
              <b>{item.title}</b>
              <em>{item.source}</em>
            </span>
            <span className={`cine-evidence-status is-${item.tone}`}>{item.status}</span>
            <span className="cine-artifact-stack" aria-hidden="true">
              {item.artifacts.map((artifact, artifactIndex) => (
                <i
                  key={artifact}
                  title={artifact}
                  style={{ "--artifact": artifactIndex } as React.CSSProperties}
                >
                  {artifactIndex === 0 ? (
                    <FileText />
                  ) : artifactIndex === 1 ? (
                    <FileCheck2 />
                  ) : (
                    <Zap />
                  )}
                </i>
              ))}
            </span>
          </button>
        ))}
      </div>
      <div className="cine-validation-path" aria-hidden="true">
        <svg viewBox="0 0 240 390" preserveAspectRatio="none">
          <path d="M0 49 C86 49 82 195 224 195" />
          <path d="M0 146 C92 146 96 195 224 195" />
          <path d="M0 244 C92 244 96 195 224 195" />
          <path d="M0 341 C86 341 82 195 224 195" />
        </svg>
        <span className="cine-gate cine-gate-one">Screen</span>
        <span className="cine-gate cine-gate-two">Validate</span>
        <i className="cine-route-node" />
      </div>
      <div className="cine-route-output">
        <div className="cine-output-heading">
          <MapPin />
          <span>
            <small>Decision workspace</small>
            <b>Credible route forward</b>
          </span>
          <em>No capacity claim</em>
        </div>
        <div className="cine-route-mini" aria-hidden="true">
          <span />
          <i />
          <i />
          <i />
        </div>
        <div className="cine-output-checks">
          <span>
            <Check /> Evidence gaps visible
          </span>
          <span>
            <Check /> Responsibility screened
          </span>
          <span>
            <Check /> Validation gates explicit
          </span>
        </div>
        <div className="cine-evidence-inspector" aria-live="polite">
          <span className={`cine-evidence-status is-${selected.tone}`}>{selected.status}</span>
          <div>
            <small>Selected evidence · {selected.source}</small>
            <b>{selected.title}</b>
            <p>{selected.next}</p>
          </div>
        </div>
        <div className="cine-output-action">
          <CircleAlert />
          <span>
            <small>Controlling next action</small>
            <b>Confirm operator and request missing connection evidence.</b>
          </span>
        </div>
      </div>
    </div>
  );
}

function TransformationRail() {
  return (
    <div className="cine-transform-rail">
      <article>
        <b>Declared</b>
        <span>Site and load enter</span>
        <MapPin />
      </article>
      <article>
        <b>Assemble</b>
        <span>Evidence and likely DSO responsibility take shape</span>
        <FileText />
      </article>
      <article>
        <b>Strategy</b>
        <span>Connection approach and plan align</span>
        <Network />
      </article>
      <article>
        <b>Decision</b>
        <span>Memo ready to act</span>
        <ShieldCheck />
      </article>
    </div>
  );
}

function MethodStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: string;
}) {
  return (
    <article className="cine-method-step">
      <b>{number}</b>
      <h3>{title}</h3>
      <p>{children}</p>
      <span className="cine-method-line">
        <ArrowRight />
      </span>
    </article>
  );
}

function ProductExperience() {
  const [activeTab, setActiveTab] = useState<(typeof productTabs)[number]>("Site context");
  return (
    <div className="cine-product-frame">
      <div className="cine-product-brand">
        <Brand />
        <span>Illustrative workspace</span>
      </div>
      <div className="cine-product-tabs" role="tablist" aria-label="Assessment views">
        {productTabs.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="cine-product-screen">
        <ProductScreen tab={activeTab} />
      </div>
    </div>
  );
}

function ProductScreen({ tab }: { tab: (typeof productTabs)[number] }) {
  const content = {
    "Site context": [
      "Proposed site",
      "Likely distribution operator",
      "Target voltage",
      "Public context only",
    ],
    "Connection scenarios": [
      "Unrestricted baseline",
      "Static flexible connection",
      "Dynamic flexible connection",
      "Operator limits required",
    ],
    "Evidence ledger": [
      "Site location",
      "Technical configuration",
      "Operator responsibility",
      "Capacity evidence missing",
    ],
    "Execution room": [
      "Confirm responsibility",
      "Complete technical pack",
      "Prepare operator request",
      "Track response deadline",
    ],
    "Decision memo": [
      "Executive summary",
      "Connection approach",
      "Evidence status",
      "Next actions",
    ],
  }[tab];
  return (
    <>
      <div className="cine-screen-map">
        <svg viewBox="0 0 500 280" aria-label="Illustrative connection context">
          <path d="M20 230 C110 170 158 214 232 136 S360 108 470 38" />
          <circle cx="232" cy="136" r="8" />
          <circle cx="470" cy="38" r="8" />
        </svg>
        <span>Berlin-Brandenburg BESS + AI Load</span>
      </div>
      <div className="cine-screen-ledger">
        <h3>{tab}</h3>
        {content.map((item, index) => (
          <span key={item}>
            <i className={index === 3 ? "warn" : ""} />
            {item}
            <small>{index === 3 ? "Validation required" : "Recorded"}</small>
          </span>
        ))}
      </div>
    </>
  );
}

function GermanyMap() {
  return (
    <div className="cine-germany-map" aria-label="Illustrative German grid responsibility context">
      <svg
        viewBox="0 0 480 560"
        role="img"
        aria-label="Abstract outline of Germany with four transmission regions"
      >
        <path
          className="country"
          d="M245 18 L292 48 330 44 354 82 398 98 387 142 431 180 405 214 426 260 397 294 408 337 370 356 374 403 330 417 306 461 265 449 226 506 186 473 142 476 126 431 92 408 104 365 66 330 86 292 54 254 83 217 72 173 112 148 118 104 164 94 180 48 218 58Z"
        />
        <path d="M116 148 C200 178 214 262 226 506" />
        <path d="M292 48 C258 158 292 260 374 403" />
        <path d="M83 217 C176 264 270 260 426 260" />
        <circle cx="286" cy="204" r="7" />
      </svg>
      <span className="zone zone-a">TenneT</span>
      <span className="zone zone-b">50Hertz</span>
      <span className="zone zone-c">Amprion</span>
      <span className="zone zone-d">TransnetBW</span>
    </div>
  );
}

function Outcome({ index, title, children }: { index: string; title: string; children: string }) {
  return (
    <article>
      <b>{index}</b>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}
