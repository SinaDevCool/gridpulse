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
      { title: "GridPulse — German grid-connection decision support" },
      {
        name: "description",
        content:
          "Structure German grid-connection evidence, compare flexible connection options, and quantify operational impact.",
      },
    ],
  }),
  component: LandingPage,
});

const pilotHref =
  "mailto:sina.khedmati@outlook.de?subject=GridPulse%20design-partner%20pilot&body=Hello%20Sina%2C%0A%0AI%20would%20like%20to%20discuss%20a%20GridPulse%20pilot.%0A%0ACompany%3A%0AProject%20type%3A%0ALocation%3A%0ARequested%20capacity%3A%0A";

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
          <a href="#how-it-works">How it works</a>
          <a href="#for-developers">For developers</a>
          <a href="#methodology">Methodology</a>
        </nav>
        <div className="landing-header-actions">
          <Link to={workspacePath}>{user ? "Open workspace" : "Sign in"}</Link>
          <a href={pilotHref} className="landing-button primary">
            Request a pilot
          </a>
        </div>
      </header>
      <main>
        <section className="landing-hero" id="product">
          <div className="landing-hero-copy">
            <h1>Reach a bankable grid-connection decision sooner.</h1>
            <p>
              GridPulse structures German connection evidence, compares flexible connection options,
              and quantifies operational impact—without presenting assumptions as grid capacity.
            </p>
            <div className="landing-actions">
              <a href={pilotHref} className="landing-button primary">
                Request a pilot
              </a>
              <Link to="/demo" className="landing-button secondary">
                Explore the demo
              </Link>
            </div>
          </div>
          <ProductFrame />
        </section>
        <section className="landing-audience-band" id="for-developers">
          <h2>Built for developers of BESS, data centres and large loads</h2>
          <div>
            <AudienceMini icon={BatteryCharging} title="BESS developers">
              Compare connection constraints before investment decisions.
            </AudienceMini>
            <AudienceMini icon={Server} title="Data-centre developers">
              Structure power requirements and flexible-load options.
            </AudienceMini>
            <AudienceMini icon={FileCheck2} title="Grid advisers">
              Deliver consistent, traceable assessments.
            </AudienceMini>
          </div>
        </section>
        <section className="landing-section workflow-section" id="how-it-works">
          <h2>From project brief to decision-ready assessment.</h2>
          <div className="landing-workflow">
            <WorkflowStep number="1" icon={FileText} title="Structure the case">
              Capture project requirements, location and operator evidence.
            </WorkflowStep>
            <WorkflowStep number="2" icon={SlidersHorizontal} title="Compare connection options">
              Model unrestricted, static and dynamic FCA scenarios from traceable inputs.
            </WorkflowStep>
            <WorkflowStep number="3" icon={ChartNoAxesCombined} title="Quantify the impact">
              Calculate constrained energy, restricted hours and indicative commercial exposure.
            </WorkflowStep>
          </div>
        </section>
        <section className="landing-section decision-section">
          <div className="decision-copy">
            <h2>Built for decisions before capital is committed.</h2>
            <Audience
              icon={BatteryCharging}
              title="BESS developers"
              text="De-risk connection strategy and strengthen investment cases."
            />
            <Audience
              icon={Server}
              title="Data-centre developers"
              text="Understand connection restrictions and commercial implications."
            />
            <Audience
              icon={UserRoundCheck}
              title="Grid advisers"
              text="Deliver independent, defensible advice with visible assumptions."
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
            <h2>Pre-feasibility report preview</h2>
            <p>Every assessment is delivered as an open, evidence-led report—not a verdict.</p>
            {[
              "Project requirement",
              "Evidence ledger",
              "Operating profile",
              "Connection scenarios",
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
            <h2>Bring one German connection case. We’ll structure the decision.</h2>
            <p>
              We are opening a small number of design-partner pilots for BESS, data-centre and
              large-load developers.
            </p>
          </div>
          <a href={pilotHref} className="landing-button primary">
            Request a pilot
          </a>
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
    ["Unrestricted", "Direct connection at requested import and export", "Insufficient"],
    ["Static FCA", "Fixed import and export limits", "Validation required"],
    ["Dynamic FCA", "Time-varying flexible limits", "Validation required"],
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
      <h2>Connection options comparison</h2>
      <div className="comparison-table">
        <header>
          <span>Scenario</span>
          <span>Connection option</span>
          <span>Evidence status</span>
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
        <span>Pre-feasibility report</span>
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
          <b>Connection scenarios</b>
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
