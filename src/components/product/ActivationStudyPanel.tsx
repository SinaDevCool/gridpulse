import {
  Activity,
  ArrowLeft,
  BarChart3,
  GitBranch,
  MapPinned,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import {
  activationStatusLabel,
  activationStudySnapshot,
  calculateRepresentativeCommercialValue,
  createActivationStudyContext,
  defaultRepresentativeCommercialAssumptions,
  type ActivationStudyContext,
  type RepresentativeCommercialAssumptions,
} from "@/features/power-finder/activation-study";
import type { C1StudyPayload } from "@/features/power-finder/c1-study";
import type { CandidateOpportunity } from "@/features/power-finder/candidate-intelligence";
import type { FinderProject } from "@/features/power-finder/finder-project";
import { validationClassLabel } from "@/features/power-finder/validation-class";

export type ActivationStudyTab =
  | "overview"
  | "topology"
  | "hourly"
  | "options"
  | "commercial"
  | "evidence";

type Props = {
  project: FinderProject;
  candidate: CandidateOpportunity;
  registeredStudy: C1StudyPayload | null;
  tab: ActivationStudyTab;
  onTabChange: (tab: ActivationStudyTab) => void;
  onClose: () => void;
  onStartAssessment?: (input: {
    selectedOptionKind: string | null;
    commercialAssumptions: RepresentativeCommercialAssumptions;
  }) => void;
};

type SelectedOption = NonNullable<ActivationStudyContext["recommendedOption"]>;

export function StudyEvidenceBadge({ context }: { context: ActivationStudyContext }) {
  return (
    <span className={`activation-validation activation-validation--${context.mode}`}>
      <ShieldCheck aria-hidden="true" />
      {validationClassLabel(context.validationClass)}
    </span>
  );
}

function OverviewView({ context }: { context: ActivationStudyContext }) {
  const option = context.recommendedOption;
  return (
    <div className="activation-view">
      <section className="activation-callout">
        <MapPinned aria-hidden="true" />
        <div>
          <h3>Activation decision overview</h3>
          <p>
            {option
              ? `Investigate ${option.title.toLowerCase()} as the leading representative pathway. The visible map remains public geographic evidence, not available capacity.`
              : "Complete the project requirement to compare representative activation pathways."}
          </p>
        </div>
      </section>
      <dl className="activation-facts">
        <div>
          <dt>Candidate</dt>
          <dd>{context.candidate.nodeName}</dd>
        </div>
        <div>
          <dt>Requested / minimum viable</dt>
          <dd>
            {context.project.importMw} / {context.project.minimumFirmMw} MW
          </dd>
        </div>
        <div>
          <dt>Leading strategy</dt>
          <dd>{option?.title ?? "Not established"}</dd>
        </div>
        <div>
          <dt>Initial / eventual benchmark</dt>
          <dd>
            {option
              ? `${option.initialImportMw.toFixed(1)} / ${option.eventualImportMw.toFixed(1)} MW`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Restricted hours</dt>
          <dd>
            {option?.analysis ? `${option.analysis.restrictedHours} h/year` : "Needs profile"}
          </dd>
        </div>
        <div>
          <dt>Residual energy</dt>
          <dd>{option?.analysis ? `${option.analysis.residualUnservedMwh} MWh` : "—"}</dd>
        </div>
        <div>
          <dt>Public investigation priority</dt>
          <dd>{context.candidate.screeningRank}/100</dd>
        </div>
        <div>
          <dt>Likely operator</dt>
          <dd>{context.candidate.operator ?? "Requires confirmation"}</dd>
        </div>
      </dl>
      <section className="activation-next-action">
        <strong>Recommended next action</strong>
        <p>{option?.nextAction ?? "Complete the declared project requirement."}</p>
      </section>
    </div>
  );
}

function TopologyView({ context }: { context: ActivationStudyContext }) {
  const network = context.networkScenario;
  const branches = network?.branches ?? [];
  const bindingIndex =
    network?.bindingConstraint === "transformer"
      ? 0
      : network?.bindingConstraint === "upstream_branch"
        ? 1
        : 2;
  return (
    <div className="activation-view">
      <section className="activation-callout">
        <GitBranch aria-hidden="true" />
        <div>
          <h3>
            {branches.length ? "Constraint-led reference pathway" : "No public topology model"}
          </h3>
          <p>
            {branches.length
              ? "The highlighted pathway explains representative benchmark mechanics. It is not the topology or loading behind the mapped node."
              : "A private accepted model is required before node-specific electrical pathways can be shown."}
          </p>
        </div>
      </section>
      {branches.length > 0 && (
        <div
          className="activation-topology"
          role="img"
          aria-label="Representative reference-network branches"
        >
          {branches.map((branch, index) => (
            <div
              className={`activation-branch ${bindingIndex === index ? "is-binding" : ""}`}
              key={branch.id}
            >
              <span className="activation-bus">{index === 0 ? "SOURCE" : `BUS ${index}`}</span>
              <span className="activation-line">
                <i />
                <small>
                  {branch.voltageKv} kV · representative rating {branch.syntheticRatingMw} MW
                </small>
              </span>
              {index === branches.length - 1 && <span className="activation-bus">PROJECT</span>}
            </div>
          ))}
        </div>
      )}
      {network && (
        <dl className="activation-facts">
          <div>
            <dt>N-0 benchmark</dt>
            <dd>{network.n0TransferLimitMw} MW</dd>
          </div>
          <div>
            <dt>N-1 benchmark</dt>
            <dd>{network.n1TransferLimitMw} MW</dd>
          </div>
          <div>
            <dt>Binding proxy</dt>
            <dd>{network.bindingConstraint.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt>Constraint category</dt>
            <dd>{context.capacityScenario?.limitingComponent.replaceAll("_", " ") ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Model status</dt>
            <dd>Unvalidated reference model</dd>
          </div>
          <div>
            <dt>Replacement evidence</dt>
            <dd>Accepted ratings, seasonal cases and contingencies</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function HourlyView({
  context,
  option,
}: {
  context: ActivationStudyContext;
  option: SelectedOption | null;
}) {
  const analysis = option?.analysis;
  const timeline = analysis?.timeline ?? [];
  const sample = timeline
    .filter((_, index) => index % Math.max(1, Math.floor(timeline.length / 168)) === 0)
    .slice(0, 168);
  const maximum = Math.max(
    1,
    ...sample.map((point) => Math.max(point.baselineImportMw, point.connectionLimitMw)),
  );
  const monthly = Array.from({ length: 12 }, (_, month) => {
    const start = Math.floor((month / 12) * timeline.length);
    const end = Math.floor(((month + 1) / 12) * timeline.length);
    return timeline
      .slice(start, end)
      .filter((point) => point.baselineImportMw > point.connectionLimitMw).length;
  });
  const maxMonthly = Math.max(1, ...monthly);
  const downloadTimeline = () => {
    if (!analysis) return;
    const rows = [
      "timestamp,baseline_import_mw,connection_limit_mw,workload_response_mw,battery_response_mw,residual_shortfall_mw,battery_soc_mwh",
      ...analysis.timeline.map((point) =>
        [
          point.timestamp,
          point.baselineImportMw,
          point.connectionLimitMw,
          point.workloadResponseMw,
          point.batteryResponseMw,
          point.residualShortfallMw,
          point.batterySocMwh,
        ].join(","),
      ),
    ];
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `gridpulse-${option?.kind ?? "activation"}-representative-hourly.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="activation-view">
      <section className="activation-callout">
        <Activity aria-hidden="true" />
        <div>
          <h3>Representative annual operating envelope</h3>
          <p>
            The shared FCA engine evaluates 8,760 deterministic hours for{" "}
            {option?.title ?? "the selected strategy"}. This is not a forecast of the mapped node.
          </p>
        </div>
      </section>
      <dl className="activation-facts activation-facts--metrics">
        <div>
          <dt>Requested import</dt>
          <dd>{context.project.importMw} MW</dd>
        </div>
        <div>
          <dt>Restricted hours</dt>
          <dd>{analysis?.restrictedHours ?? "—"} h/year</dd>
        </div>
        <div>
          <dt>Residual energy</dt>
          <dd>{analysis?.residualUnservedMwh ?? "—"} MWh</dd>
        </div>
        <div>
          <dt>Longest event</dt>
          <dd>{analysis?.longestRestrictionHours ?? "—"} h</dd>
        </div>
        <div>
          <dt>Maximum shortfall</dt>
          <dd>{analysis?.maximumShortfallMw ?? "—"} MW</dd>
        </div>
        <div>
          <dt>Battery contribution</dt>
          <dd>{analysis?.batteryDischargeMwh ?? "—"} MWh</dd>
        </div>
      </dl>
      {sample.length > 0 && (
        <>
          <section className="activation-hourly-chart">
            <header>
              <strong>Demand and connection envelope</strong>
              <span>168 sampled points from the annual result</span>
            </header>
            <svg
              viewBox="0 0 840 230"
              role="img"
              aria-label="Baseline demand, connection limit and residual shortfall"
            >
              <polyline
                className="activation-chart-limit"
                points={sample
                  .map(
                    (point, index) =>
                      `${index * 5},${210 - (point.connectionLimitMw / maximum) * 190}`,
                  )
                  .join(" ")}
              />
              <polyline
                className="activation-chart-demand"
                points={sample
                  .map(
                    (point, index) =>
                      `${index * 5},${210 - (point.baselineImportMw / maximum) * 190}`,
                  )
                  .join(" ")}
              />
              {sample.map((point, index) =>
                point.residualShortfallMw > 0 ? (
                  <line
                    key={point.timestamp}
                    className="activation-chart-shortfall"
                    x1={index * 5}
                    x2={index * 5}
                    y1={210 - (point.baselineImportMw / maximum) * 190}
                    y2={210 - (point.connectionLimitMw / maximum) * 190}
                  />
                ) : null,
              )}
            </svg>
            <div className="activation-chart-legend">
              <span data-series="demand">Demand</span>
              <span data-series="limit">Envelope</span>
              <span data-series="shortfall">Residual</span>
            </div>
          </section>
          <section className="activation-heatmap">
            <strong>Annual restriction pattern</strong>
            <div>
              {monthly.map((value, month) => (
                <span
                  key={month}
                  style={{ "--intensity": value / maxMonthly } as CSSProperties}
                  title={`${value} representative restricted intervals`}
                >
                  {new Date(2026, month).toLocaleString("en", { month: "short" })}
                </span>
              ))}
            </div>
          </section>
          <button type="button" className="secondary-button" onClick={downloadTimeline}>
            Download representative hourly CSV
          </button>
        </>
      )}
    </div>
  );
}

function OptionsView({
  context,
  selectedKind,
  onSelect,
}: {
  context: ActivationStudyContext;
  selectedKind: string | null;
  onSelect: (kind: string) => void;
}) {
  const recommended = context.recommendedOption;
  return (
    <div className="activation-view">
      <section className="activation-callout">
        <Zap aria-hidden="true" />
        <div>
          <h3>Connection strategies to investigate</h3>
          <p>
            All alternatives reuse the shared FCA engine. Results remain representative customer
            hypotheses until supported by operator evidence.
          </p>
        </div>
      </section>
      {recommended && (
        <section className="activation-recommendation">
          <span>Leading representative pathway</span>
          <h3>{recommended.title}</h3>
          <p>
            {activationStatusLabel(recommended.operationalStatus)}. {recommended.nextAction}
          </p>
        </section>
      )}
      <div className="activation-options" role="list">
        {context.decisionMatrix.map((option) => (
          <article key={option.kind} className={selectedKind === option.kind ? "is-selected" : ""}>
            <header>
              <span>{option.evidenceStatus.replaceAll("_", " ")}</span>
              <h3>{option.title}</h3>
            </header>
            <strong>{activationStatusLabel(option.operationalStatus)}</strong>
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
              <div>
                <dt>Demand served</dt>
                <dd>{option.analysis ? `${option.analysis.demandServedPercent}%` : "—"}</dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>{option.evidenceReadiness}%</dd>
              </div>
            </dl>
            <button
              type="button"
              className="secondary-button"
              onClick={() => onSelect(option.kind)}
              aria-pressed={selectedKind === option.kind}
            >
              Analyse this strategy
            </button>
            <details>
              <summary>Commitments and operator questions</summary>
              <b>Customer commitments</b>
              <ul>
                {option.customerCommitments.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <b>Operator questions</b>
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

function CommercialView({
  context,
  option,
  assumptions,
  onChange,
}: {
  context: ActivationStudyContext;
  option: SelectedOption | null;
  assumptions: RepresentativeCommercialAssumptions;
  onChange: (next: RepresentativeCommercialAssumptions) => void;
}) {
  const value = calculateRepresentativeCommercialValue(context, assumptions, option);
  const update = (key: keyof RepresentativeCommercialAssumptions, raw: string) =>
    onChange({ ...assumptions, [key]: Math.max(0, Number(raw) || 0) });
  return (
    <div className="activation-view">
      <section className="activation-callout">
        <BarChart3 aria-hidden="true" />
        <div>
          <h3>Representative commercial comparison</h3>
          <p>
            Explore customer-declared time-to-power sensitivity. Unknown operator dates, costs and
            capacity remain unknown.
          </p>
        </div>
      </section>
      <form className="activation-commercial-form" onSubmit={(event) => event.preventDefault()}>
        <label>
          Value per energized MW/month (€)
          <input
            type="number"
            min="0"
            value={assumptions.valuePerEnergizedMwMonthEur}
            onChange={(event) => update("valuePerEnergizedMwMonthEur", event.target.value)}
          />
        </label>
        <label>
          Representative months accelerated
          <input
            type="number"
            min="0"
            value={assumptions.monthsAccelerated}
            onChange={(event) => update("monthsAccelerated", event.target.value)}
          />
        </label>
        <label>
          Flexibility enablement cost (€)
          <input
            type="number"
            min="0"
            value={assumptions.flexibilityEnablementCostEur}
            onChange={(event) => update("flexibilityEnablementCostEur", event.target.value)}
          />
        </label>
        <label>
          Battery capital cost (€/MWh)
          <input
            type="number"
            min="0"
            value={assumptions.batteryCapitalCostEurMwh}
            onChange={(event) => update("batteryCapitalCostEurMwh", event.target.value)}
          />
        </label>
      </form>
      <dl className="activation-facts activation-commercial-results">
        <div>
          <dt>MW potentially energized earlier</dt>
          <dd>{value.earlierMw.toFixed(1)} MW</dd>
        </div>
        <div>
          <dt>Gross acceleration value</dt>
          <dd>€{Math.round(value.grossAccelerationValueEur).toLocaleString("en-GB")}</dd>
        </div>
        <div>
          <dt>Operating exposure</dt>
          <dd>€{Math.round(value.operatingExposureEur).toLocaleString("en-GB")}</dd>
        </div>
        <div>
          <dt>Strategy enablement cost</dt>
          <dd>
            €{Math.round(value.batteryCostEur + value.flexibilityCostEur).toLocaleString("en-GB")}
          </dd>
        </div>
        <div>
          <dt>Low indicative value</dt>
          <dd>€{Math.round(value.lowIndicativeValueEur).toLocaleString("en-GB")}</dd>
        </div>
        <div>
          <dt>Base indicative value</dt>
          <dd>€{Math.round(value.netIndicativeValueEur).toLocaleString("en-GB")}</dd>
        </div>
        <div>
          <dt>High indicative value</dt>
          <dd>€{Math.round(value.highIndicativeValueEur).toLocaleString("en-GB")}</dd>
        </div>
      </dl>
      <p className="activation-boundary">{value.boundary}</p>
    </div>
  );
}

function EvidenceView({ context }: { context: ActivationStudyContext }) {
  const checklist = [
    "Confirm the responsible operator and candidate connection point.",
    "Obtain accepted equipment ratings and seasonal operating cases.",
    "Obtain the applicable contingency and security criteria.",
    "Confirm reinforcement milestones and indication validity period.",
    "Confirm static or dynamic flexibility, telemetry and control requirements.",
    "Confirm import, export, protection and power-quality conditions.",
  ];
  return (
    <div className="activation-view">
      <section className="activation-callout">
        <ShieldCheck aria-hidden="true" />
        <div>
          <h3>Evidence and validation roadmap</h3>
          <p>Every result retains its source, version and permitted interpretation.</p>
        </div>
      </section>
      <ol className="activation-evidence-ladder">
        <li className="complete">Public geographic evidence</li>
        <li className="complete">Customer-declared project requirement</li>
        <li className="current">Representative activation benchmark</li>
        <li>Linked and reconciled network model</li>
        <li>Operator-reviewed or confirmed result</li>
      </ol>
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
      <h3>Required validation actions</h3>
      <ul>
        {checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
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
  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [commercialAssumptions, setCommercialAssumptions] = useState(
    defaultRepresentativeCommercialAssumptions,
  );
  const selectedOption =
    context.decisionMatrix.find((option) => option.kind === selectedKind) ??
    context.recommendedOption;
  const downloadBrief = () => {
    const value = calculateRepresentativeCommercialValue(
      context,
      commercialAssumptions,
      selectedOption,
    );
    const brief = {
      title: "GridPulse representative activation brief",
      candidate: {
        id: context.candidate.id,
        name: context.candidate.nodeName,
        publicInvestigationPriority: context.candidate.screeningRank,
      },
      project: context.project,
      selectedOption: selectedOption
        ? {
            ...selectedOption,
            analysis: selectedOption.analysis
              ? Object.fromEntries(
                  Object.entries(selectedOption.analysis).filter(([key]) => key !== "timeline"),
                )
              : null,
          }
        : null,
      commercialSensitivity: value,
      snapshot: activationStudySnapshot(context, {
        selectedOptionKind: selectedOption?.kind ?? null,
        commercialAssumptions,
      }),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(brief, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "gridpulse-representative-activation-brief.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const tabs: Array<{ id: ActivationStudyTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "topology", label: "Constraint" },
    { id: "hourly", label: "Hourly" },
    { id: "options", label: "Strategies" },
    { id: "commercial", label: "Value" },
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
        {props.tab === "overview" && <OverviewView context={context} />}
        {props.tab === "topology" && <TopologyView context={context} />}
        {props.tab === "hourly" && <HourlyView context={context} option={selectedOption} />}
        {props.tab === "options" && (
          <OptionsView
            context={context}
            selectedKind={selectedOption?.kind ?? null}
            onSelect={setSelectedKind}
          />
        )}
        {props.tab === "commercial" && (
          <CommercialView
            context={context}
            option={selectedOption}
            assumptions={commercialAssumptions}
            onChange={setCommercialAssumptions}
          />
        )}
        {props.tab === "evidence" && <EvidenceView context={context} />}
      </div>
      <footer className="activation-study-actions">
        <button type="button" className="secondary-button" onClick={props.onClose}>
          Compare another candidate
        </button>
        <button type="button" className="secondary-button" onClick={downloadBrief}>
          Download activation brief
        </button>
        {props.onStartAssessment && (
          <button
            type="button"
            className="primary-button"
            onClick={() =>
              props.onStartAssessment?.({
                selectedOptionKind: selectedOption?.kind ?? null,
                commercialAssumptions,
              })
            }
          >
            Continue in private assessment
          </button>
        )}
        <small>
          Save the selected candidate, benchmark versions and evidence boundary before continuing.
        </small>
      </footer>
    </aside>
  );
}
