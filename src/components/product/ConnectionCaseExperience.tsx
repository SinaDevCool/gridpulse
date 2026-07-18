import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleDot,
  Clock3,
  FileCheck2,
  FileText,
  MapPin,
  Network,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  caseStages,
  connectionCase,
  evidenceRows,
  executionRows,
  scenarioRows,
  type CaseStageId,
} from "@/lib/demo-case";

type ExperienceMode = "preview" | "workspace";

const stageIcons = {
  site: MapPin,
  scenarios: Zap,
  evidence: FileCheck2,
  execution: Network,
  decision: ShieldCheck,
} as const;

export function ConnectionCaseExperience({
  mode = "workspace",
  initialStage = "site",
}: {
  mode?: ExperienceMode;
  initialStage?: CaseStageId;
}) {
  const [activeStage, setActiveStage] = useState<CaseStageId>(initialStage);
  const activeIndex = caseStages.findIndex((stage) => stage.id === activeStage);

  return (
    <section
      className={`case-experience is-${mode}`}
      aria-label="Illustrative German connection case"
    >
      <header className="case-command-bar">
        <div>
          <span className="case-id">{connectionCase.id}</span>
          <strong>{connectionCase.name}</strong>
        </div>
        <div className="case-command-status">
          <i /> Illustrative · operator validation required
        </div>
      </header>

      <nav className="case-stage-nav" aria-label="Connection case stages" role="tablist">
        {caseStages.map((stage, index) => {
          const Icon = stageIcons[stage.id];
          return (
            <button
              aria-controls={`case-panel-${stage.id}`}
              aria-selected={activeStage === stage.id}
              className={index < activeIndex ? "is-complete" : ""}
              key={stage.id}
              onClick={() => setActiveStage(stage.id)}
              role="tab"
              type="button"
            >
              <Icon />
              <span>
                <b>{stage.label}</b>
                <small>{stage.status}</small>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="case-stage-progress" aria-hidden="true">
        <i style={{ width: `${(activeIndex / (caseStages.length - 1)) * 100}%` }} />
      </div>

      <div className="case-stage-panel" id={`case-panel-${activeStage}`} role="tabpanel">
        <StageView stage={activeStage} mode={mode} />
      </div>

      {mode === "preview" ? (
        <footer className="case-preview-footer">
          <span>Select each stage to inspect the same case.</span>
          <Link to="/demo">
            Open full demonstration <ArrowRight />
          </Link>
        </footer>
      ) : null}
    </section>
  );
}

function StageView({ stage, mode }: { stage: CaseStageId; mode: ExperienceMode }) {
  if (stage === "site") return <SiteContext mode={mode} />;
  if (stage === "scenarios") return <ScenarioScreen mode={mode} />;
  if (stage === "evidence") return <EvidenceScreen mode={mode} />;
  if (stage === "execution") return <ExecutionScreen mode={mode} />;
  return <DecisionScreen mode={mode} />;
}

function StageHeading({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <div className="case-stage-heading">
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
    </div>
  );
}

function SiteContext({ mode }: { mode: ExperienceMode }) {
  return (
    <div className="case-site-layout">
      <div className="case-map">
        <div className="case-map-grid" />
        <svg
          viewBox="0 0 700 390"
          aria-label="Illustrative route between proposed site and network context"
        >
          <path d="M52 334 C176 254 228 298 328 194 S506 148 645 48" />
          <circle cx="328" cy="194" r="9" />
          <circle cx="645" cy="48" r="9" />
        </svg>
        <span className="case-map-label is-site">
          <MapPin /> Proposed site
        </span>
        <span className="case-map-label is-operator">
          <Network /> Likely DSO area
        </span>
        <div className="case-map-disclaimer">Public context · not available-capacity evidence</div>
      </div>
      <div className="case-context-panel">
        <StageHeading
          number="01"
          title="Site context"
          copy="Declare the project requirement and screen likely responsibility."
        />
        <dl>
          <CaseMetric label="Region" value={connectionCase.region} />
          <CaseMetric label="Power requirement" value={connectionCase.requirement} />
          <CaseMetric label="Configuration" value={connectionCase.configuration} />
          <CaseMetric label="Target voltage" value={connectionCase.voltage} />
          <CaseMetric label="Likely operator" value={connectionCase.likelyOperator} warning />
        </dl>
        {mode === "workspace" ? (
          <Safeguard>
            Confirm ownership, voltage and capacity with the responsible network operator.
          </Safeguard>
        ) : null}
      </div>
    </div>
  );
}

function ScenarioScreen({ mode }: { mode: ExperienceMode }) {
  const [selected, setSelected] = useState(1);
  const scenario = scenarioRows[selected];
  return (
    <div className="case-split-layout">
      <div className="case-list-region">
        <StageHeading
          number="02"
          title="Connection scenarios"
          copy="Compare routes without inferring grid headroom."
        />
        <div className="case-scenario-list">
          {scenarioRows.map((row, index) => (
            <button
              aria-pressed={selected === index}
              key={row.name}
              onClick={() => setSelected(index)}
              type="button"
            >
              <span>0{index + 1}</span>
              <b>{row.name}</b>
              <small>{row.status}</small>
              <ArrowRight />
            </button>
          ))}
        </div>
      </div>
      <div className="case-inspector">
        <span className="case-inspector-label">Selected route · indicative</span>
        <h3>{scenario.name}</h3>
        <p>{scenario.detail}</p>
        <dl>
          <CaseMetric label="Import condition" value={scenario.import} />
          <CaseMetric label="Export condition" value={scenario.export} />
          <CaseMetric label="Dispatch impact" value={scenario.impact} />
        </dl>
        <Safeguard>
          {mode === "preview"
            ? "Operator limits still required."
            : "No scenario becomes actionable until the operator provides controlling limits."}
        </Safeguard>
      </div>
    </div>
  );
}

function EvidenceScreen({ mode }: { mode: ExperienceMode }) {
  const [selected, setSelected] = useState(5);
  const row = evidenceRows[selected];
  return (
    <div className="case-split-layout is-evidence">
      <div className="case-list-region">
        <StageHeading
          number="03"
          title="Evidence ledger"
          copy="Keep every conclusion connected to its source and status."
        />
        <div className="case-evidence-list">
          {evidenceRows.map((item, index) => (
            <button
              aria-pressed={selected === index}
              key={item.item}
              onClick={() => setSelected(index)}
              type="button"
            >
              <span className={`case-state is-${item.status.toLowerCase()}`}>{item.status}</span>
              <span>
                <b>{item.item}</b>
                <small>{item.source}</small>
              </span>
              <em>{item.provenance}</em>
            </button>
          ))}
        </div>
      </div>
      <div className="case-inspector">
        <span className="case-inspector-label">Evidence detail</span>
        <h3>{row.item}</h3>
        <p>
          Source: {row.source}. Provenance: {row.provenance}.
        </p>
        <div className="case-document-stack" aria-hidden="true">
          <FileText />
          <FileText />
          <FileCheck2 />
        </div>
        <Safeguard>
          {row.status === "Missing"
            ? "Required before a decision memo can be released."
            : "Recorded with its source and current validation state."}
        </Safeguard>
        {mode === "workspace" ? (
          <small className="case-audit-line">
            <Clock3 /> Last reviewed in this illustrative case · 18 July 2026
          </small>
        ) : null}
      </div>
    </div>
  );
}

function ExecutionScreen({ mode }: { mode: ExperienceMode }) {
  const [selected, setSelected] = useState(2);
  return (
    <div className="case-execution-layout">
      <StageHeading
        number="04"
        title="Execution room"
        copy="Coordinate workstreams, owners and operator-facing milestones."
      />
      <div
        className="case-execution-table"
        role="table"
        aria-label="Illustrative execution workstreams"
      >
        <div className="case-table-head" role="row">
          <span>Workstream</span>
          <span>Owner</span>
          <span>Status</span>
          <span>Next milestone</span>
        </div>
        {executionRows.map((row, index) => (
          <button
            aria-pressed={selected === index}
            key={row.workstream}
            onClick={() => setSelected(index)}
            role="row"
            type="button"
          >
            <b>{row.workstream}</b>
            <span>{row.owner}</span>
            <span className={`case-work-state is-${row.state.toLowerCase().replaceAll(" ", "-")}`}>
              {row.state}
            </span>
            <span>{row.milestone}</span>
          </button>
        ))}
      </div>
      <div className="case-execution-note">
        <CircleDot />
        <span>
          <small>Selected workstream</small>
          <b>{executionRows[selected].workstream}</b>
        </span>
        <p>
          {mode === "preview"
            ? executionRows[selected].milestone
            : "Next: " +
              executionRows[selected].milestone +
              ". Preserve the request, response and decision record in one timeline."}
        </p>
      </div>
    </div>
  );
}

function DecisionScreen({ mode }: { mode: ExperienceMode }) {
  return (
    <div className="case-decision-layout">
      <div className="case-memo-visual" aria-hidden="true">
        <FileText />
        <span />
        <span />
      </div>
      <div className="case-memo-copy">
        <StageHeading
          number="05"
          title="Decision memo"
          copy="Turn the current evidence state into a controlled recommendation."
        />
        <div className="case-decision-status">
          <AlertTriangle />
          <span>
            <small>Readiness</small>
            <b>Blocked by two operator evidence items</b>
          </span>
        </div>
        <section>
          <h3>Current recommendation</h3>
          <p>
            Proceed with operator engagement and technical-package preparation. Do not represent
            connection capacity as confirmed.
          </p>
        </section>
        <section>
          <h3>Controlling next actions</h3>
          <ul>
            <li>
              <Check /> Confirm responsible network operator
            </li>
            <li>
              <Check /> Request capacity and FCA operating evidence
            </li>
          </ul>
        </section>
        {mode === "workspace" ? (
          <Link to="/pilot" className="case-primary-action">
            Bring this case to a pilot <ArrowRight />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function CaseMetric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className={warning ? "is-warning" : ""}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Safeguard({ children }: { children: string }) {
  return (
    <div className="case-safeguard">
      <AlertTriangle />
      <span>{children}</span>
    </div>
  );
}
