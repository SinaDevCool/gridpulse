import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleDot,
  ExternalLink,
  FileText,
  MapPin,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/product/AppShell";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "GridPulse Demo | German Grid Connection Assessment" },
      {
        name: "description",
        content:
          "Explore an illustrative GridPulse assessment for German BESS, data-centre and large-load grid connection decisions.",
      },
      { property: "og:title", content: "GridPulse Demo | German Grid Connection Assessment" },
      { property: "og:url", content: "https://gridpulseinsights.com/demo" },
    ],
    links: [{ rel: "canonical", href: "https://gridpulseinsights.com/demo" }],
  }),
  component: AssessmentWorkspace,
});

type EvidenceKind =
  | "Official source"
  | "Customer input"
  | "Assumption"
  | "Calculation"
  | "Validation required";
const kindClass: Record<EvidenceKind, string> = {
  "Official source": "evidence evidence-official",
  "Customer input": "evidence evidence-input",
  Assumption: "evidence evidence-assumption",
  Calculation: "evidence evidence-calculation",
  "Validation required": "evidence evidence-required",
};

const evidence: {
  item: string;
  source: string;
  kind: EvidenceKind;
  status: "Collected" | "Missing";
}[] = [
  {
    item: "Substation proximity",
    source: "OpenGridMap / verify",
    kind: "Official source",
    status: "Collected",
  },
  {
    item: "Administrative grid area",
    source: "BNetzA map portal",
    kind: "Official source",
    status: "Collected",
  },
  {
    item: "Requested import and export",
    source: "Project brief",
    kind: "Customer input",
    status: "Collected",
  },
  {
    item: "BESS technical configuration",
    source: "Technical datasheet",
    kind: "Customer input",
    status: "Collected",
  },
  {
    item: "Responsible network operator",
    source: "Boundary screening",
    kind: "Assumption",
    status: "Collected",
  },
  {
    item: "Available network capacity",
    source: "Network operator",
    kind: "Validation required",
    status: "Missing",
  },
  {
    item: "FCA operating schedule",
    source: "Connection offer",
    kind: "Validation required",
    status: "Missing",
  },
];

function AssessmentWorkspace() {
  return (
    <AppShell>
      <main className="workspace">
        <div className="workspace-heading">
          <div>
            <p className="context-label">Connection assessment / GP-DE-001</p>
            <h1>Berlin-Brandenburg BESS + AI Load</h1>
          </div>
          <span className="demo-badge">Illustrative workspace</span>
        </div>
        <div className="workflow" aria-label="Assessment progress">
          <div className="workflow-step done">
            <Check />
            <span>
              <b>Site inputs</b>
              <small>Completed</small>
            </span>
          </div>
          <div className="workflow-step current">
            <CircleDot />
            <span>
              <b>Operator screening</b>
              <small>In review</small>
            </span>
          </div>
          <div className="workflow-step">
            <span className="step-number">3</span>
            <span>
              <b>Connection envelope</b>
              <small>Draft</small>
            </span>
          </div>
          <div className="workflow-step">
            <span className="step-number">4</span>
            <span>
              <b>Evidence</b>
              <small>5 of 7 collected</small>
            </span>
          </div>
          <div className="workflow-step warning">
            <AlertTriangle />
            <span>
              <b>Operator validation</b>
              <small>Required</small>
            </span>
          </div>
        </div>
        <div className="dashboard-grid">
          <section className="dashboard-main">
            <div className="panel map-panel">
              <div className="panel-heading">
                <div>
                  <h2>Site and network context</h2>
                  <p>Public context only — not evidence of available capacity.</p>
                </div>
                <button className="quiet-button">Layers</button>
              </div>
              <div className="map-canvas">
                <div className="map-legend">
                  <span>
                    <i className="dot cyan" />
                    Site · customer input
                  </span>
                  <span>
                    <i className="dot green" />
                    Substation · public source
                  </span>
                  <span>
                    <i className="dot amber" />
                    Substation · unverified
                  </span>
                </div>
                <div className="zone-label z1">
                  50Hertz
                  <br />
                  Nord
                </div>
                <div className="zone-label z2">
                  50Hertz
                  <br />
                  Berlin
                </div>
                <div className="zone-label z3">E.DIS Netz</div>
                <div className="map-site">
                  <MapPin />
                  <b>Proposed site</b>
                  <small>110 kV target</small>
                </div>
                <div className="substation s1">
                  <i />
                  Neuenhagen <small>110/20 kV</small>
                </div>
                <div className="substation s2">
                  <i />
                  Ludwigsfelde <small>110/20 kV</small>
                </div>
                <div className="substation s3 unverified">
                  <i />
                  Fürstenwalde <small>unverified</small>
                </div>
              </div>
              <div className="panel-note">
                <ShieldCheck size={15} /> Map layers support early screening. Confirm ownership,
                voltage and capacity with the network operator.
              </div>
            </div>
            <div id="scenarios" className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Connection scenarios</h2>
                  <p>Limits are inputs or unknowns; GridPulse does not infer grid headroom.</p>
                </div>
                <span className="evidence evidence-calculation">Indicative</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Scenario</th>
                      <th>Import limit</th>
                      <th>Export limit</th>
                      <th>Dispatch impact</th>
                      <th>Commercial model</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <b>Unrestricted</b>
                      </td>
                      <td>
                        60 MW <Tag kind="Customer input" />
                      </td>
                      <td>
                        40 MW <Tag kind="Customer input" />
                      </td>
                      <td>Baseline only</td>
                      <td>Needs market data</td>
                      <td>
                        <span className="status warning-text">Insufficient</span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <b>Static FCA</b>
                      </td>
                      <td>Enter operator limit</td>
                      <td>Enter operator limit</td>
                      <td>Not calculated</td>
                      <td>Needs restriction data</td>
                      <td>
                        <span className="status warning-text">Validation required</span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <b>Dynamic FCA</b>
                      </td>
                      <td>Requires schedule</td>
                      <td>Requires schedule</td>
                      <td>Not calculated</td>
                      <td>Needs interval data</td>
                      <td>
                        <span className="status warning-text">Validation required</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
          <aside className="dashboard-side">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Connection envelope</h2>
                  <p>Declared project requirements</p>
                </div>
                <Zap size={18} />
              </div>
              <dl className="metric-list">
                <Metric label="Requested import" value="60 MW" />
                <Metric label="Requested export" value="40 MW" />
                <Metric label="BESS" value="40 MW / 80 MWh" />
                <Metric label="Target voltage" value="110 kV" />
                <Metric label="Likely operator" value="Confirm with DSO" kind="Assumption" />
              </dl>
              <div className="panel-note">
                <AlertTriangle size={15} /> This is not a connection offer or capacity confirmation.
              </div>
            </div>
            <div id="evidence" className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Evidence ledger</h2>
                  <p>5 of 7 items collected</p>
                </div>
                <span className="missing-count">2 missing</span>
              </div>
              <div className="evidence-list">
                {evidence.map((row) => (
                  <div className="evidence-row" key={row.item}>
                    <div>
                      <b>{row.item}</b>
                      <small>
                        {row.source} {row.kind === "Official source" && <ExternalLink size={10} />}
                      </small>
                    </div>
                    <Tag kind={row.kind} />
                    <span className={row.status === "Missing" ? "missing" : "collected"}>
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel readiness">
              <div className="panel-heading">
                <div>
                  <h2>Assessment readiness</h2>
                  <p>Required evidence is incomplete</p>
                </div>
                <span className="status warning-text">Not ready</span>
              </div>
              <ul>
                <li className="ok">
                  <Check />
                  Site and technical inputs recorded
                </li>
                <li className="ok">
                  <Check />
                  Initial public context collected
                </li>
                <li>
                  <AlertTriangle />
                  Operator validation items missing (2)
                </li>
              </ul>
              <button disabled className="report-button">
                <FileText size={16} /> Generate pre-feasibility report
              </button>
              <small>Enabled only when required evidence is supplied.</small>
            </div>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

function Tag({ kind }: { kind: EvidenceKind }) {
  return <span className={kindClass[kind]}>{kind}</span>;
}
function Metric({
  label,
  value,
  kind = "Customer input",
}: {
  label: string;
  value: string;
  kind?: EvidenceKind;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
      <Tag kind={kind} />
    </div>
  );
}
