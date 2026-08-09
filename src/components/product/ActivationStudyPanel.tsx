import { Activity, ArrowLeft, GitBranch, MapPinned, ShieldCheck, Zap } from "lucide-react";
import { useMemo } from "react";
import {
  createActivationStudyContext,
  type ActivationStudyContext,
} from "@/features/power-finder/activation-study";
import type { C1StudyPayload } from "@/features/power-finder/c1-study";
import type { CandidateOpportunity } from "@/features/power-finder/candidate-intelligence";
import type { FinderProject } from "@/features/power-finder/finder-project";
import { validationClassLabel } from "@/features/power-finder/validation-class";

export type ActivationStudyTab = "geographic" | "topology" | "hourly" | "options" | "evidence";

type Props = {
  project: FinderProject;
  candidate: CandidateOpportunity;
  registeredStudy: C1StudyPayload | null;
  tab: ActivationStudyTab;
  onTabChange: (tab: ActivationStudyTab) => void;
  onClose: () => void;
  onStartAssessment?: () => void;
};

export function StudyEvidenceBadge({ context }: { context: ActivationStudyContext }) {
  return (
    <span className={`activation-validation activation-validation--${context.mode}`}>
      <ShieldCheck aria-hidden="true" />
      {validationClassLabel(context.validationClass)}
    </span>
  );
}

function GeographicView({ context }: { context: ActivationStudyContext }) {
  return (
    <div className="activation-view">
      <section className="activation-callout">
        <MapPinned aria-hidden="true" />
        <div>
          <h3>Geographic context remains on the Power Finder map</h3>
          <p>
            The map shows the declared project site, selected node, mapped corridors and public
            evidence. This study does not turn map appearance into available capacity.
          </p>
        </div>
      </section>
      <dl className="activation-facts">
        <div>
          <dt>Candidate</dt>
          <dd>{context.candidate.nodeName}</dd>
        </div>
        <div>
          <dt>Distance</dt>
          <dd>{context.candidate.distanceKm} km straight-line</dd>
        </div>
        <div>
          <dt>Mapped voltage</dt>
          <dd>{context.candidate.voltageKv.join(", ") || "Unknown"} kV</dd>
        </div>
        <div>
          <dt>Likely operator</dt>
          <dd>{context.candidate.operator ?? "Requires confirmation"}</dd>
        </div>
        <div>
          <dt>Public investigation priority</dt>
          <dd>{context.candidate.screeningRank}/100</dd>
        </div>
        <div>
          <dt>Evidence completeness</dt>
          <dd>{context.candidate.confidence}</dd>
        </div>
      </dl>
    </div>
  );
}

function TopologyView({ context }: { context: ActivationStudyContext }) {
  const branches = context.networkScenario?.branches ?? [];
  return (
    <div className="activation-view">
      <section className="activation-callout">
        <GitBranch aria-hidden="true" />
        <div>
          <h3>
            {branches.length ? "Representative electrical pathway" : "No public topology model"}
          </h3>
          <p>
            {branches.length
              ? "This bounded reference network explains the benchmark mechanics; it is not the topology behind the mapped node."
              : "A private accepted model is required before node-specific electrical pathways can be shown."}
          </p>
        </div>
      </section>
      {branches.length > 0 && (
        <div
          className="activation-topology"
          role="img"
          aria-label="Synthetic reference-network branches"
        >
          {branches.map((branch, index) => (
            <div className="activation-branch" key={branch.id}>
              <span className="activation-bus">{index === 0 ? "SOURCE" : `BUS ${index}`}</span>
              <span className="activation-line">
                <i />
                <small>
                  {branch.voltageKv} kV · synthetic rating {branch.syntheticRatingMw} MW
                </small>
              </span>
              {index === branches.length - 1 && <span className="activation-bus">PROJECT</span>}
            </div>
          ))}
        </div>
      )}
      {context.networkScenario && (
        <dl className="activation-facts">
          <div>
            <dt>N-0 benchmark</dt>
            <dd>{context.networkScenario.n0TransferLimitMw} MW</dd>
          </div>
          <div>
            <dt>N-1 benchmark</dt>
            <dd>{context.networkScenario.n1TransferLimitMw} MW</dd>
          </div>
          <div>
            <dt>Binding proxy</dt>
            <dd>{context.networkScenario.bindingConstraint.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt>Validation</dt>
            <dd>Unvalidated reference model</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function HourlyView({ context }: { context: ActivationStudyContext }) {
  const scenario = context.capacityScenario;
  const registered = context.registeredStudy?.c2?.node_envelope;
  return (
    <div className="activation-view">
      <section className="activation-callout">
        <Activity aria-hidden="true" />
        <div>
          <h3>
            {registered?.available
              ? "Model-linked hourly envelope"
              : "Representative annual profile"}
          </h3>
          <p>
            {registered?.available
              ? "The result is linked to the selected node and retains its model validation class."
              : "The synthetic engine evaluates 8,760 deterministic hours. It is not a forecast of this mapped node."}
          </p>
        </div>
      </section>
      <dl className="activation-facts activation-facts--metrics">
        <div>
          <dt>Requested import</dt>
          <dd>{scenario?.requestedImportMw ?? context.project.importMw} MW</dd>
        </div>
        <div>
          <dt>Restricted hours</dt>
          <dd>
            {registered?.summary?.constrained_hours ?? scenario?.constrainedHoursPerYear ?? "—"}{" "}
            h/year
          </dd>
        </div>
        <div>
          <dt>Energy affected</dt>
          <dd>
            {registered?.summary?.expected_curtailed_mwh ?? scenario?.curtailedEnergyMwh ?? "—"} MWh
          </dd>
        </div>
        <div>
          <dt>Longest interruption</dt>
          <dd>{scenario?.longestInterruptionHours ?? "—"} h</dd>
        </div>
        <div>
          <dt>Maximum reduction</dt>
          <dd>
            {registered?.summary?.maximum_curtailment_mw ?? scenario?.maximumReductionMw ?? "—"} MW
          </dd>
        </div>
        <div>
          <dt>Battery contribution</dt>
          <dd>{scenario?.batteryContributionMwh ?? "—"} MWh</dd>
        </div>
      </dl>
    </div>
  );
}

function OptionsView({ context }: { context: ActivationStudyContext }) {
  return (
    <div className="activation-view">
      <section className="activation-callout">
        <Zap aria-hidden="true" />
        <div>
          <h3>Connection strategies to investigate</h3>
          <p>
            Options reuse GridPulse’s shared FCA engine. Synthetic results remain customer
            hypotheses.
          </p>
        </div>
      </section>
      <div className="activation-options">
        {context.options.map((option) => (
          <article key={option.kind}>
            <header>
              <span>{option.evidenceStatus.replaceAll("_", " ")}</span>
              <h3>{option.title}</h3>
            </header>
            <strong>{option.operationalStatus.replaceAll("_", " ")}</strong>
            <dl>
              <div>
                <dt>Initial</dt>
                <dd>{option.initialImportMw.toFixed(1)} MW</dd>
              </div>
              <div>
                <dt>Eventual</dt>
                <dd>{option.eventualImportMw.toFixed(1)} MW</dd>
              </div>
              <div>
                <dt>Restricted</dt>
                <dd>
                  {option.analysis ? `${option.analysis.restrictedHours} h` : "Needs profile"}
                </dd>
              </div>
              <div>
                <dt>Residual</dt>
                <dd>{option.analysis ? `${option.analysis.residualUnservedMwh} MWh` : "—"}</dd>
              </div>
            </dl>
            <details>
              <summary>Operator questions</summary>
              <ul>
                {option.operatorQuestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          </article>
        ))}
      </div>
    </div>
  );
}

function EvidenceView({ context }: { context: ActivationStudyContext }) {
  return (
    <div className="activation-view">
      <section className="activation-callout">
        <ShieldCheck aria-hidden="true" />
        <div>
          <h3>Evidence and permitted interpretation</h3>
          <p>Every result retains its source and validation boundary.</p>
        </div>
      </section>
      <dl className="activation-facts">
        <div>
          <dt>Validation class</dt>
          <dd>{validationClassLabel(context.validationClass)}</dd>
        </div>
        <div>
          <dt>Public calculation</dt>
          <dd>{context.candidate.calculationVersion}</dd>
        </div>
        <div>
          <dt>Hourly scenario</dt>
          <dd>{context.capacityScenario?.scenarioVersion ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt>Reference network</dt>
          <dd>{context.networkScenario?.networkVersion ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt>Registered model</dt>
          <dd>{context.registeredStudy?.node_study.model?.key ?? "No node-linked model"}</dd>
        </div>
        <div>
          <dt>Operator confirmed</dt>
          <dd>{context.mode === "operator_confirmed" ? "Yes, within declared scope" : "No"}</dd>
        </div>
      </dl>
      <h3>Permitted</h3>
      <ul>
        {context.permittedClaims.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h3>Not permitted</h3>
      <ul>
        {context.prohibitedClaims.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function ActivationStudyPanel(props: Props) {
  const context = useMemo(
    () =>
      createActivationStudyContext({
        project: props.project,
        candidate: props.candidate,
        registeredStudy: props.registeredStudy,
      }),
    [props.project, props.candidate, props.registeredStudy],
  );
  const tabs: Array<{ id: ActivationStudyTab; label: string }> = [
    { id: "geographic", label: "Geographic" },
    { id: "topology", label: "Topology" },
    { id: "hourly", label: "Hourly" },
    { id: "options", label: "Options" },
    { id: "evidence", label: "Evidence" },
  ];
  return (
    <aside className="activation-study-panel" aria-label="Activation Study">
      <header className="activation-study-header">
        <button type="button" onClick={props.onClose}>
          <ArrowLeft aria-hidden="true" /> Back to map
        </button>
        <div>
          <span className="eyebrow">Selected candidate · Activation Study</span>
          <h2>{context.candidate.nodeName}</h2>
        </div>
        <StudyEvidenceBadge context={context} />
        {context.mode === "synthetic_demonstration" && (
          <p className="activation-boundary">
            Representative benchmark—not calculated capacity at this mapped node.
          </p>
        )}
      </header>
      <nav className="activation-study-tabs" aria-label="Activation Study views">
        {tabs.map((item) => (
          <button
            type="button"
            key={item.id}
            className={props.tab === item.id ? "active" : ""}
            aria-current={props.tab === item.id ? "page" : undefined}
            onClick={() => props.onTabChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="activation-study-body" tabIndex={0} aria-label="Activation Study content">
        {props.tab === "geographic" && <GeographicView context={context} />}
        {props.tab === "topology" && <TopologyView context={context} />}
        {props.tab === "hourly" && <HourlyView context={context} />}
        {props.tab === "options" && <OptionsView context={context} />}
        {props.tab === "evidence" && <EvidenceView context={context} />}
      </div>
      {props.onStartAssessment && (
        <footer>
          <button type="button" className="primary-button" onClick={props.onStartAssessment}>
            Continue in private assessment
          </button>
          <small>
            Save the candidate, benchmark versions and evidence boundary before continuing.
          </small>
        </footer>
      )}
    </aside>
  );
}
