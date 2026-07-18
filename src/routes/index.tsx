import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, FileText, MapPin, Network, ShieldCheck } from "lucide-react";
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

function EvidenceRoute() {
  const inputs = [
    "Fragmented evidence",
    "Operator requirements",
    "Network constraints",
    "Project constraints",
  ];
  return (
    <div
      className="cine-evidence-route"
      aria-label="Evidence is assembled into an engagement route"
    >
      <div className="cine-evidence-inputs">
        {inputs.map((item, index) => (
          <div key={item} style={{ "--route-delay": `${index * 120}ms` } as React.CSSProperties}>
            <span>{item}</span>
            <i>
              <FileText />
            </i>
            <i />
            <i />
          </div>
        ))}
      </div>
      <svg viewBox="0 0 300 320" aria-hidden="true">
        <path d="M0 38 C112 38 142 158 288 158" />
        <path d="M0 116 C112 116 142 158 288 158" />
        <path d="M0 204 C112 204 142 158 288 158" />
        <path d="M0 282 C112 282 142 158 288 158" />
      </svg>
      <div className="cine-route-output">
        <MapPin />
        <b>Credible route forward</b>
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
