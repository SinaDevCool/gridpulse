import {
  Activity,
  ArrowDownRight,
  BatteryCharging,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Gauge,
  ShieldCheck,
  TrendingDown,
  Zap,
} from "lucide-react";

type ShowcaseKind = "activation" | "operations" | "reports";

const copy = {
  activation: {
    eyebrow: "Illustrative connection strategy",
    title: "Bremen Edge Campus · 200 MW request",
    description:
      "See how a screened site becomes a staged, flexibility-backed operator enquiry.",
    metrics: [
      ["Initial firm envelope", "120 MW", "Entered scenario—not available capacity"],
      ["Unresolved gap", "80 MW", "Before flexibility and phasing"],
      ["Flexible response", "35 MW", "Illustrative 15-minute activation"],
      ["Stage 1 target", "155 MW", "Subject to operator confirmation"],
    ],
  },
  operations: {
    eyebrow: "Illustrative shadow operation",
    title: "Delivery rehearsal · Event GP-024",
    description:
      "Compare the approved plan with simulated telemetry without sending equipment commands.",
    metrics: [
      ["Requested response", "30 MW", "14:00–16:00"],
      ["Delivered response", "29.2 MW", "97.3% simulated delivery"],
      ["Response time", "6 min", "Within 15-minute scenario"],
      ["Recovery", "42 min", "No SLA breach in simulation"],
    ],
  },
  reports: {
    eyebrow: "Illustrative decision package",
    title: "Operator enquiry · Bremen Edge Campus",
    description:
      "Preview the concise evidence package a project team can review before formal submission.",
    metrics: [
      ["Artifacts", "7", "Capacity, facility, flexibility, replay"],
      ["Evidence coverage", "82%", "2 operator inputs remain open"],
      ["Claims", "0", "No operator-confirmed capacity claims"],
      ["Reproduction", "Ready", "Manifest and fingerprints included"],
    ],
  },
} as const;

export function WorkflowShowcase({ kind }: { kind: ShowcaseKind }) {
  const content = copy[kind];
  return (
    <section className={`workflow-showcase workflow-showcase--${kind}`} aria-labelledby={`${kind}-showcase-title`}>
      <header>
        <div>
          <span className="demo-badge">Illustrative demo · not a live project</span>
          <p>{content.eyebrow}</p>
          <h2 id={`${kind}-showcase-title`}>{content.title}</h2>
          <small>{content.description}</small>
        </div>
        <ShieldCheck aria-hidden="true" />
      </header>
      <div className="workflow-showcase-metrics">
        {content.metrics.map(([label, value, note]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </div>
      {kind === "activation" ? <ActivationPreview /> : null}
      {kind === "operations" ? <OperationsPreview /> : null}
      {kind === "reports" ? <ReportsPreview /> : null}
    </section>
  );
}

function ActivationPreview() {
  return (
    <div className="workflow-showcase-grid">
      <article className="showcase-panel">
        <h3><Zap aria-hidden="true" /> Recommended pathway</h3>
        <ol className="showcase-timeline">
          <li><b>Now</b><span>Validate 120 MW firm scenario with the responsible operator</span></li>
          <li><b>Stage 1</b><span>Add 35 MW governed flexible load with explicit recovery terms</span></li>
          <li><b>Stage 2</b><span>Gate the remaining 45 MW behind reinforcement or a revised offer</span></li>
        </ol>
      </article>
      <article className="showcase-panel">
        <h3><BatteryCharging aria-hidden="true" /> Mitigation stack</h3>
        <div className="showcase-stack" aria-label="Illustrative 80 megawatt mitigation stack">
          <i style={{ width: "44%" }}>35 MW flexible load</i>
          <i style={{ width: "25%" }}>20 MW battery</i>
          <i style={{ width: "31%" }}>25 MW staged</i>
        </div>
        <p><CheckCircle2 aria-hidden="true" /> Decision: prepare a staged enquiry; do not claim 200 MW availability.</p>
      </article>
    </div>
  );
}

function OperationsPreview() {
  return (
    <div className="workflow-showcase-grid">
      <article className="showcase-panel">
        <h3><Activity aria-hidden="true" /> Planned vs observed</h3>
        <div className="showcase-chart" aria-label="Illustrative delivery profile">
          {[18, 30, 68, 82, 78, 75, 38, 20].map((value, index) => (
            <i key={index} style={{ height: `${value}%` }}><span>{index + 13}:00</span></i>
          ))}
        </div>
        <div className="showcase-legend"><span>Plan 30 MW</span><span>Simulated telemetry</span></div>
      </article>
      <article className="showcase-panel">
        <h3><Gauge aria-hidden="true" /> Delivery checks</h3>
        <ul className="showcase-checks">
          <li><CheckCircle2 aria-hidden="true" /> Baseline quality <b>Passed</b></li>
          <li><CheckCircle2 aria-hidden="true" /> Sustained delivery <b>Passed</b></li>
          <li><Clock3 aria-hidden="true" /> SOC recovery <b>42 min</b></li>
          <li><ArrowDownRight aria-hidden="true" /> Rebound peak <b>4.1 MW</b></li>
        </ul>
        <p className="showcase-safe"><ShieldCheck aria-hidden="true" /> Read only · simulated commands · no dispatch transport</p>
      </article>
    </div>
  );
}

function ReportsPreview() {
  return (
    <div className="workflow-showcase-grid">
      <article className="showcase-panel">
        <h3><FileCheck2 aria-hidden="true" /> Executive decision</h3>
        <p className="showcase-decision">Proceed to an operator enquiry for a staged 155 MW connection strategy.</p>
        <ul className="showcase-checks">
          <li><CheckCircle2 aria-hidden="true" /> Site & demand brief <b>Complete</b></li>
          <li><CheckCircle2 aria-hidden="true" /> Constraint exposure <b>Indicative</b></li>
          <li><TrendingDown aria-hidden="true" /> Flexibility strategy <b>35 MW</b></li>
        </ul>
      </article>
      <article className="showcase-panel">
        <h3><ShieldCheck aria-hidden="true" /> Evidence boundary</h3>
        <dl className="showcase-manifest">
          <div><dt>Operator confirmation</dt><dd>Required</dd></div>
          <div><dt>Public evidence</dt><dd>Referenced</dd></div>
          <div><dt>Assumptions</dt><dd>7 identified</dd></div>
          <div><dt>Package fingerprint</dt><dd><code>7d42…a910</code></dd></div>
        </dl>
      </article>
    </div>
  );
}
