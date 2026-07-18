import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BatteryCharging,
  Building2,
  ChartNoAxesCombined,
  Check,
  CircleSlash2,
  Database,
  FileCheck2,
  FileText,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  UserRoundCheck,
} from "lucide-react";
import { useAuth } from "@/context/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GridPulse | Power Acceleration for German Infrastructure" },
      {
        name: "description",
        content:
          "Accelerate power delivery for data centres, BESS and large loads in Germany with evidence-led site screening, flexible connection design and operational readiness.",
      },
      { property: "og:title", content: "GridPulse | Power Acceleration for Germany" },
      { property: "og:url", content: "https://gridpulseinsights.com/" },
      { name: "twitter:title", content: "GridPulse | Power Acceleration for Germany" },
    ],
    links: [{ rel: "canonical", href: "https://gridpulseinsights.com/" }],
  }),
  component: LandingPage,
});

function Brand() {
  return (
    <Link to="/" className="landing-brand" aria-label="GridPulse home">
      <span>GRID</span>
      <strong>PULSE</strong>
    </Link>
  );
}

function LandingPage() {
  const { user } = useAuth();
  const workspacePath = user ? "/portfolio" : "/auth";
  return (
    <div className="landing-page">
      <header className="landing-header">
        <Brand />
        <nav aria-label="Landing page">
          <a href="#product">Product</a>
          <a href="#platform">Platform</a>
          <a href="#for-developers">For developers</a>
          <a href="#methodology">Methodology</a>
        </nav>
        <div className="landing-header-actions">
          <Link to={workspacePath}>{user ? "Open workspace" : "Sign in"}</Link>
          <Link to="/pilot" className="landing-button primary">
            Request a pilot
          </Link>
        </div>
      </header>
      <main>
        <section className="landing-hero" id="product">
          <div className="landing-hero-copy">
            <span className="landing-kicker">Power acceleration for Germany</span>
            <h1>Bring power-intensive infrastructure online sooner.</h1>
            <p>
              GridPulse builds an operator-ready path from site screening to flexible connection and
              operations for data centres, BESS and large loads—without presenting assumptions as
              available grid capacity.
            </p>
            <div className="landing-actions">
              <Link to="/pilot" className="landing-button primary">
                Request a pilot
              </Link>
              <Link to="/demo" className="landing-button secondary">
                Explore the demo
              </Link>
            </div>
          </div>
          <ProductFrame />
        </section>
        <section className="landing-audience-band" id="for-developers">
          <h2>Built for power-constrained infrastructure projects</h2>
          <div>
            <AudienceMini icon={Server} title="Data-centre developers">
              De-risk site selection and define a credible route to energized capacity.
            </AudienceMini>
            <AudienceMini icon={BatteryCharging} title="BESS developers">
              Design storage as a connection and flexibility asset.
            </AudienceMini>
            <AudienceMini icon={FileCheck2} title="Grid advisers">
              Deliver consistent, traceable assessments.
            </AudienceMini>
          </div>
        </section>
        <section className="landing-section workflow-section" id="platform">
          <span className="section-kicker">The GridPulse platform</span>
          <h2>One path from power search to flexible operation.</h2>
          <div className="landing-workflow">
            <WorkflowStep number="1" icon={FileText} title="Power discovery">
              Screen candidate locations, responsible operators and the evidence required to qualify
              a site.
            </WorkflowStep>
            <WorkflowStep number="2" icon={SlidersHorizontal} title="Connection activation">
              Build operator-ready unrestricted, static and dynamic FCA cases from traceable inputs.
            </WorkflowStep>
            <WorkflowStep number="3" icon={ChartNoAxesCombined} title="Flexible operations">
              Translate connection limits into dispatch rules, restricted hours and commercial
              impact.
            </WorkflowStep>
          </div>
        </section>
        <section className="landing-section decision-section">
          <div className="decision-copy">
            <span className="section-kicker">Business outcomes</span>
            <h2>Make power a development strategy—not a late-stage constraint.</h2>
            <Audience
              icon={BatteryCharging}
              title="BESS developers"
              text="Use storage and co-location flexibility to support faster, more efficient connections."
            />
            <Audience
              icon={Server}
              title="Data-centre developers"
              text="Compare sites and flexibility options before committing development capital."
            />
            <Audience
              icon={UserRoundCheck}
              title="Grid advisers"
              text="Turn fragmented operator evidence into a defensible activation plan."
            />
          </div>
          <EvidenceFrame />
        </section>
        <section className="landing-section methodology-section" id="methodology">
          <h2>Decision support with the uncertainty left visible.</h2>
          <p>Four principles keep evidence and assumptions explicit.</p>
          <div className="principle-grid">
            <Principle icon={CircleSlash2} title="No inferred grid capacity">
              We model only what is provided and traceable.
            </Principle>
            <Principle icon={Tag} title="Every assumption is labelled">
              Assumptions stay explicit and reviewable.
            </Principle>
            <Principle icon={UserRoundCheck} title="Operator evidence remains controlling">
              Operator sources take precedence over public or third-party information.
            </Principle>
            <Principle icon={Database} title="Calculations retain their version and inputs">
              Every calculation links to defined inputs and methodology.
            </Principle>
          </div>
        </section>
        <section className="landing-section report-section">
          <div>
            <h2>Power-readiness plan preview</h2>
            <p>
              Every project receives an evidence-led route from connection request to operation.
            </p>
            {[
              "Project requirement",
              "Evidence ledger",
              "Operating profile",
              "Activation scenarios",
              "Flexibility requirements",
              "Limitations",
            ].map((item) => (
              <span key={item}>
                <Check />
                {item}
              </span>
            ))}
          </div>
          <ReportFrame />
        </section>
        <section className="pilot-band">
          <ShieldCheck />
          <div>
            <h2>Bring one German power-constrained project. We’ll build the activation path.</h2>
            <p>
              We are opening design-partner pilots for data-centre, BESS and large-load developers
              that need an evidence-led route to power.
            </p>
          </div>
          <Link to="/pilot" className="landing-button primary">
            Request a pilot
          </Link>
          <Link to={workspacePath} className="landing-button secondary">
            {user ? "Open workspace" : "Sign in to GridPulse"}
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <nav>
          <a href="#product">Product</a>
          <Link to="/demo">Demo</Link>
          <a href="#methodology">Methodology</a>
          <Link to="/auth">Sign in</Link>
        </nav>
        <p>
          Preliminary decision support only.
          <br />
          Validate connection conclusions with the network operator.
        </p>
      </footer>
    </div>
  );
}

function ProductFrame() {
  const rows = [
    ["Power discovery", "Candidate site and operator screening", "In review"],
    ["Connection activation", "Static and dynamic FCA design", "Evidence required"],
    ["Flexible operations", "Dispatch and restriction readiness", "Planned"],
  ];
  return (
    <div className="hero-product-frame">
      <div className="frame-progress">
        <span className="done">
          <Check />
          Site & network
        </span>
        <span className="active">2</span>
        <span>Connection options</span>
        <span>3</span>
        <span>Evidence</span>
      </div>
      <h2>Power activation plan</h2>
      <div className="comparison-table">
        <header>
          <span>Stage</span>
          <span>Decision output</span>
          <span>Status</span>
        </header>
        {rows.map(([name, option, status]) => (
          <div key={name}>
            <b>{name}</b>
            <span>{option}</span>
            <small>{status}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
function WorkflowStep({
  number,
  icon: Icon,
  title,
  children,
}: {
  number: string;
  icon: typeof FileText;
  title: string;
  children: string;
}) {
  return (
    <article>
      <Icon />
      <span>{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </article>
  );
}
function AudienceMini({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof FileText;
  title: string;
  children: string;
}) {
  return (
    <span>
      <Icon />
      <b>{title}</b>
      <small>{children}</small>
    </span>
  );
}
function Audience({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof FileText;
  title: string;
  text: string;
}) {
  return (
    <article className="audience-row">
      <Icon />
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <ArrowRight />
    </article>
  );
}
function EvidenceFrame() {
  const items = [
    [Building2, "Official source", "Verified publications and regulatory sources."],
    [UserRoundCheck, "Customer input", "Information provided by your project team."],
    [ChartNoAxesCombined, "Calculation", "Derived using a defined methodology."],
    [
      ShieldCheck,
      "Operator validation required",
      "Subject to confirmation by the network operator.",
    ],
  ] as const;
  return (
    <div className="evidence-frame">
      <h2>Evidence classifications</h2>
      <p>Every input is labelled for source and confidence.</p>
      {items.map(([Icon, title, text]) => (
        <div key={title}>
          <Icon />
          <span>
            <b>{title}</b>
            <small>{text}</small>
          </span>
        </div>
      ))}
    </div>
  );
}
function Principle({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof FileText;
  title: string;
  children: string;
}) {
  return (
    <article>
      <Icon />
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </article>
  );
}
function ReportFrame() {
  return (
    <div className="report-frame">
      <header>
        <Brand />
        <span>Power-readiness plan</span>
      </header>
      <div className="report-frame-grid">
        <section>
          <b>Project requirement</b>
          <span>
            Project type <strong>BESS</strong>
          </span>
          <span>
            Location <strong>Germany</strong>
          </span>
          <span>
            Requested capacity <strong>Customer input</strong>
          </span>
        </section>
        <section>
          <b>Evidence ledger</b>
          <span>
            Official source <strong>Collected</strong>
          </span>
          <span>
            Operating profile <strong>Collected</strong>
          </span>
          <span>
            Operator response <strong>Required</strong>
          </span>
        </section>
        <section>
          <b>Activation scenarios</b>
          <span>
            Unrestricted <strong>Baseline</strong>
          </span>
          <span>
            Static FCA <strong>Calculated</strong>
          </span>
          <span>
            Dynamic FCA <strong>Calculated</strong>
          </span>
        </section>
        <section>
          <b>Limitations</b>
          <p>Data gaps and operator validations remain visible.</p>
        </section>
      </div>
    </div>
  );
}
