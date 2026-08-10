import {
  Activity,
  ArrowLeft,
  BarChart3,
  GitBranch,
  MapPinned,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import type { ReferenceCapacityResult } from "@/features/power-finder/calculated-capacity";
import { validationClassLabel } from "@/features/power-finder/validation-class";
import {
  activationEvidenceLabels,
  type ActivationEvidenceOrigin,
} from "@/features/power-finder/activation-evidence";

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
  referenceCapacity?: ReferenceCapacityResult | null;
  tab: ActivationStudyTab;
  onTabChange: (tab: ActivationStudyTab) => void;
  onClose: () => void;
  onStartAssessment?: (input: {
    selectedOptionKind: string | null;
    commercialAssumptions: RepresentativeCommercialAssumptions;
  }) => void;
};

type SelectedOption = NonNullable<ActivationStudyContext["recommendedOption"]>;
type StrategyAnalysisView = "comparison" | "constraint" | "hourly" | "value";

function EvidenceTag({ origin }: { origin: ActivationEvidenceOrigin }) {
  return (
    <small className={`activation-evidence-tag origin-${origin}`}>
      {activationEvidenceLabels[origin]}
    </small>
  );
}

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
  const displayed = option ?? context.bestInvestigativeHypothesis;
  const reference = context.referenceCapacity?.activation;
  const ensemble = context.referenceCapacity?.ensemble;
  return (
    <div className="activation-view">
      <section className="activation-callout">
        <MapPinned aria-hidden="true" />
        <div>
          <h3>Activation decision overview</h3>
          <p>
            {reference
              ? `${reference.activatable_capacity_mw.toFixed(2)} MW is activatable in the representative annual envelope, ${reference.additional_unlocked_mw.toFixed(2)} MW above the demonstrated conventional firm baseline.`
              : option
                ? `Investigate ${option.title.toLowerCase()} as a viable representative pathway. The visible map remains public geographic evidence, not available capacity.`
                : displayed
                  ? `No representative pathway meets the declared minimum. ${displayed.title} is the strongest investigation hypothesis, not a recommendation.`
                  : "Complete the project requirement to compare representative activation pathways."}
          </p>
        </div>
      </section>
      <dl className="activation-facts">
        {reference && (
          <>
            <div>
              <dt>Activatable / additional unlocked</dt>
              <dd>
                {reference.activatable_capacity_mw.toFixed(2)} /{" "}
                {reference.additional_unlocked_mw.toFixed(2)} MW
              </dd>
              <EvidenceTag origin="physics_verified" />
            </div>
            <div>
              <dt>Representative operating commitment</dt>
              <dd>
                {reference.flexible.restricted_hours} h/year ·{" "}
                {reference.flexible.restricted_energy_mwh.toFixed(1)} MWh
              </dd>
              <EvidenceTag origin="synthetic_assumption" />
            </div>
            {ensemble && (
              <div>
                <dt>Operating scenario range (P10 / P50 / P90)</dt>
                <dd>
                  {ensemble.confidence.p10_mw.toFixed(2)} / {ensemble.confidence.p50_mw.toFixed(2)}{" "}
                  / {ensemble.confidence.p90_mw.toFixed(2)} MW
                </dd>
                <EvidenceTag origin="synthetic_assumption" />
              </div>
            )}
            {ensemble && (
              <div>
                <dt>Scenario coverage</dt>
                <dd>
                  {ensemble.scenario_count} cases · {ensemble.hours_evaluated.toLocaleString()} h
                </dd>
                <EvidenceTag origin="synthetic_assumption" />
              </div>
            )}
          </>
        )}
        <div>
          <dt>Candidate</dt>
          <dd>{context.candidate.nodeName}</dd>
          <EvidenceTag origin="public_mapped" />
        </div>
        <div>
          <dt>Requested / minimum viable</dt>
          <dd>
            {context.project.importMw} / {context.project.minimumFirmMw} MW
          </dd>
          <EvidenceTag origin="customer_declared" />
        </div>
        <div>
          <dt>{option ? "Viable representative strategy" : "Decision status"}</dt>
          <dd>{option?.title ?? "No pathway meets the minimum"}</dd>
          <EvidenceTag origin="synthetic_assumption" />
        </div>
        <div>
          <dt>Initial / eventual benchmark</dt>
          <dd>
            {displayed
              ? `${displayed.initialImportMw.toFixed(1)} / ${displayed.eventualImportMw.toFixed(1)} MW`
              : "—"}
          </dd>
          <EvidenceTag origin="synthetic_assumption" />
        </div>
        <div>
          <dt>Restricted hours</dt>
          <dd>
            {displayed?.analysis ? `${displayed.analysis.restrictedHours} h/year` : "Needs profile"}
          </dd>
          <EvidenceTag origin="synthetic_assumption" />
        </div>
        <div>
          <dt>Residual energy</dt>
          <dd>{displayed?.analysis ? `${displayed.analysis.residualUnservedMwh} MWh` : "—"}</dd>
          <EvidenceTag origin="synthetic_assumption" />
        </div>
        <div>
          <dt>Public investigation priority</dt>
          <dd>{context.candidate.screeningRank}/100</dd>
          <EvidenceTag origin="public_mapped" />
        </div>
        <div>
          <dt>Likely operator</dt>
          <dd>{context.candidate.operator ?? "Requires confirmation"}</dd>
          <EvidenceTag origin="public_mapped" />
        </div>
      </dl>
      <section className="activation-next-action">
        <strong>Recommended next action</strong>
        <p>
          {option?.nextAction ??
            displayed?.nextAction ??
            "Complete the declared project requirement."}
        </p>
      </section>
    </div>
  );
}

function TopologyView({ context }: { context: ActivationStudyContext }) {
  const network = context.networkScenario;
  const reference = context.referenceCapacity;
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
      {reference && (
        <dl className="activation-facts">
          <div>
            <dt>N-0 calculated ceiling</dt>
            <dd>{reference.n0_capacity_mw} MW</dd>
          </div>
          <div>
            <dt>N-1 firm</dt>
            <dd>{reference.n1_capacity_mw} MW</dd>
          </div>
          <div>
            <dt>Binding case</dt>
            <dd>{reference.binding_case ?? "None"}</dd>
          </div>
          <div>
            <dt>Binding constraint</dt>
            <dd>{reference.binding_constraint?.replaceAll("_", " ") ?? "None"}</dd>
          </div>
          <div>
            <dt>Graph pathway</dt>
            <dd>{reference.graph_pathway_available ? "Traceable" : "Unavailable"}</dd>
          </div>
          <div>
            <dt>Model status</dt>
            <dd>Calculated reference network</dd>
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
  const criticalIndex = timeline.reduce(
    (best, point, index) =>
      point.residualShortfallMw > (timeline[best]?.residualShortfallMw ?? -1) ? index : best,
    0,
  );
  const criticalStart = Math.max(0, Math.min(timeline.length - 168, criticalIndex - 84));
  const sample = timeline.slice(criticalStart, criticalStart + 168);
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
              <span>Contiguous critical week from the annual result</span>
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
      {recommended ? (
        <section className="activation-recommendation">
          <span>Leading representative pathway</span>
          <h3>{recommended.title}</h3>
          <p>
            {activationStatusLabel(recommended.operationalStatus)}. {recommended.nextAction}
          </p>
        </section>
      ) : (
        <section className="activation-recommendation is-blocked" role="status">
          <span>No viable representative pathway</span>
          <h3>The declared minimum is not met</h3>
          <p>
            Review the minimum operable load, add a real flexibility profile, or obtain operator
            evidence before selecting a strategy.
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
  enabled,
  onEnable,
}: {
  context: ActivationStudyContext;
  option: SelectedOption | null;
  assumptions: RepresentativeCommercialAssumptions;
  onChange: (next: RepresentativeCommercialAssumptions) => void;
  enabled: boolean;
  onEnable: () => void;
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
      {!enabled && (
        <section className="activation-commercial-empty">
          <h3>Add your business assumptions</h3>
          <p>
            GridPulse does not supply default revenue, acceleration, flexibility, or battery-cost
            assumptions. Enter project-owned values to create a sensitivity.
          </p>
          <button type="button" className="primary-button" onClick={onEnable}>
            Add business assumptions
          </button>
        </section>
      )}
      {enabled && (
        <>
          {!value.eligible && (
            <section className="activation-recommendation is-blocked" role="alert">
              <h3>Business sensitivity unavailable</h3>
              <p>
                The selected strategy does not meet the declared minimum or lacks the required
                technical analysis.
              </p>
            </section>
          )}
          <form className="activation-commercial-form" onSubmit={(event) => event.preventDefault()}>
            <label>
              Value per energized MW/month (€)
              <input
                type="number"
                name="value_per_energized_mw_month_eur"
                inputMode="decimal"
                min="0"
                value={assumptions.valuePerEnergizedMwMonthEur}
                onChange={(event) => update("valuePerEnergizedMwMonthEur", event.target.value)}
              />
            </label>
            <label>
              Representative months accelerated
              <input
                type="number"
                name="months_accelerated"
                inputMode="numeric"
                min="0"
                value={assumptions.monthsAccelerated}
                onChange={(event) => update("monthsAccelerated", event.target.value)}
              />
            </label>
            <label>
              Flexibility enablement cost (€)
              <input
                type="number"
                name="flexibility_enablement_cost_eur"
                inputMode="decimal"
                min="0"
                value={assumptions.flexibilityEnablementCostEur}
                onChange={(event) => update("flexibilityEnablementCostEur", event.target.value)}
              />
            </label>
            <label>
              Battery capital cost (€/MWh)
              <input
                type="number"
                name="battery_capital_cost_eur_mwh"
                inputMode="decimal"
                min="0"
                value={assumptions.batteryCapitalCostEurMwh}
                onChange={(event) => update("batteryCapitalCostEurMwh", event.target.value)}
              />
            </label>
          </form>
          {value.eligible && (
            <>
              <dl className="activation-facts activation-commercial-results">
                <div>
                  <dt>Initial MW included in this sensitivity</dt>
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
                    €
                    {Math.round(value.batteryCostEur + value.flexibilityCostEur).toLocaleString(
                      "en-GB",
                    )}
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
            </>
          )}
        </>
      )}
    </div>
  );
}

function EvidenceView({ context }: { context: ActivationStudyContext }) {
  const ensemble = context.referenceCapacity?.ensemble;
  const release2 = context.referenceCapacity?.release2_governance;
  const release3 = context.referenceCapacity?.release3_governance;
  const release4 = context.referenceCapacity?.release4_governance;
  const release5 = context.referenceCapacity?.release5_governance;
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
      <dl className="activation-facts activation-evidence-summary">
        <div>
          <dt>Current Result</dt>
          <dd>{validationClassLabel(context.validationClass)}</dd>
        </div>
        <div>
          <dt>Network Model</dt>
          <dd>
            {context.registeredStudy?.node_study.model?.key ?? "Representative reference model"}
          </dd>
        </div>
        <div>
          <dt>Operator Review</dt>
          <dd>
            {context.mode === "operator_confirmed"
              ? "Confirmed within declared scope"
              : "Not reviewed"}
          </dd>
        </div>
        <div>
          <dt>Next Evidence Gate</dt>
          <dd>Reviewed candidate-to-model-bus match and accepted operating cases</dd>
        </div>
      </dl>
      <details className="activation-technical-audit">
        <summary>Technical Audit &amp; Model Governance</summary>
        <dl className="activation-facts">
          {release2 && (
            <div>
              <dt>Release 2 AI role</dt>
              <dd>
                {release2.active_learning.physics_verified_selected_count}/
                {release2.active_learning.physics_selected_count} selected cases verified by physics
              </dd>
            </div>
          )}
          {release2 && (
            <div>
              <dt>Safety gate</dt>
              <dd>
                {release2.promotion.decision} · false-safe rate{" "}
                {release2.model.false_safe_rate.toFixed(3)} · mandatory N-1 coverage{" "}
                {(release2.active_learning.mandatory_contingency_coverage * 100).toFixed(0)}%
              </dd>
            </div>
          )}
          {release2 && (
            <div>
              <dt>Public map boundary</dt>
              <dd>
                Surrogate routing is not applied to map capacity; Berlin values remain physics
                results from{" "}
                {release2.berlin_release1_boundary.release1_model_version ?? "Release 1"}
              </dd>
            </div>
          )}
          {release2 && (
            <div>
              <dt>Permitted use</dt>
              <dd>{release2.model.approved_use}</dd>
            </div>
          )}
          {release3 && (
            <div>
              <dt>Release 3 shadow validation</dt>
              <dd>
                {release3.shadow.verified_count}/{release3.shadow.scenario_count} physics verified ·{" "}
                {release3.shadow.drift_status.replaceAll("_", " ")}
              </dd>
            </div>
          )}
          {release4 && (
            <div>
              <dt>Release 4 operator-pilot readiness</dt>
              <dd>
                {release4.repository_acceptance.passed_gate_count}/
                {release4.repository_acceptance.total_gate_count} repository gates passed · operator
                inputs {release4.operator_replacement.operator_field_count}/
                {release4.operator_replacement.required_field_count}
              </dd>
            </div>
          )}
          {release5 && (
            <div>
              <dt>Release 5 operator evidence control</dt>
              <dd>
                {Object.values(release5.gates).filter(Boolean).length}/
                {Object.keys(release5.gates).length} gates passed · reviewed extraction and conflict
                preservation
              </dd>
            </div>
          )}
          {release5 && (
            <div>
              <dt>Restriction rehearsal</dt>
              <dd>
                {release5.benchmark.restriction_rehearsal.delivered_reduction_mw.toFixed(1)} MW of{" "}
                {release5.benchmark.restriction_rehearsal.required_reduction_mw.toFixed(1)} MW ·
                residual {release5.benchmark.restriction_rehearsal.residual_mw.toFixed(1)} MW
              </dd>
            </div>
          )}
          {release5 && (
            <div>
              <dt>Control authority</dt>
              <dd>No automatic dispatch · no operator confirmation · no mapped capacity claim</dd>
            </div>
          )}
          {release4 && (
            <div>
              <dt>Neo4j and physics boundary</dt>
              <dd>
                {release4.graph_and_physics.selected_case_count}/
                {release4.graph_and_physics.full_case_count} graph-prioritised cases replayed ·
                false-safe {release4.graph_and_physics.false_safe_rate.toFixed(3)}
              </dd>
            </div>
          )}
          {release4 && (
            <div>
              <dt>Promotion state</dt>
              <dd>Not operator confirmed · synthetic results remain hidden from mapped capacity</dd>
            </div>
          )}
          {release4 && (
            <div>
              <dt>Release 4 map authority</dt>
              <dd>
                Graph results remain private and do not colour public capacity · operator inputs 0/
                {release4.operator_replacement.required_field_count}
              </dd>
            </div>
          )}
          {release3 && (
            <div>
              <dt>Shadow safety</dt>
              <dd>
                MAE {release3.shadow.mae_mw.toFixed(3)} MW · false-safe{" "}
                {release3.shadow.false_safe_rate.toFixed(3)} · OOD{" "}
                {release3.shadow.out_of_distribution_rate.toFixed(3)}
              </dd>
            </div>
          )}
          {release3 && (
            <div>
              <dt>Lifecycle decision</dt>
              <dd>
                {release3.champion_decision.decision.replaceAll("_", " ")} · operator gates required
              </dd>
            </div>
          )}
          {release3 && (
            <div>
              <dt>Release 3 map authority</dt>
              <dd>
                Shadow predictions are private and never colour the map · displayed values remain
                physics results
              </dd>
            </div>
          )}
          {ensemble && (
            <div>
              <dt>Operating scenario set</dt>
              <dd>
                {ensemble.scenario_count} mocked cases / {ensemble.hours_evaluated.toLocaleString()}{" "}
                evaluated hours
              </dd>
            </div>
          )}
          {ensemble && (
            <div>
              <dt>Scenario-specific physics replays</dt>
              <dd>
                {ensemble.scenario_specific_physics_replays}; the shared ceiling is
                physics-calculated
              </dd>
            </div>
          )}
          {ensemble && (
            <div>
              <dt>Dominant uncertainty</dt>
              <dd>{ensemble.dominant_uncertainty}</dd>
            </div>
          )}
          {ensemble && (
            <div>
              <dt>Scenario evidence hash</dt>
              <dd>{ensemble.scenario_set_sha256.slice(0, 16)}…</dd>
            </div>
          )}
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
      </details>
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

function StrategiesWorkspace({
  context,
  selectedKind,
  onSelect,
  initialView,
  commercialAssumptions,
  onCommercialChange,
  commercialEnabled,
  onCommercialEnable,
}: {
  context: ActivationStudyContext;
  selectedKind: string | null;
  onSelect: (kind: string) => void;
  initialView: StrategyAnalysisView;
  commercialAssumptions: RepresentativeCommercialAssumptions;
  onCommercialChange: (value: RepresentativeCommercialAssumptions) => void;
  commercialEnabled: boolean;
  onCommercialEnable: () => void;
}) {
  const selected =
    context.decisionMatrix.find((option) => option.kind === selectedKind) ??
    context.recommendedOption ??
    context.bestInvestigativeHypothesis;
  return (
    <div className="activation-strategy-workspace">
      <OptionsView context={context} selectedKind={selected?.kind ?? null} onSelect={onSelect} />
      <details className="activation-analysis-section" open={initialView === "constraint"}>
        <summary>Constraint &amp; Network Path</summary>
        <TopologyView context={context} />
      </details>
      <details className="activation-analysis-section" open={initialView === "hourly"}>
        <summary>Hourly Operating Envelope</summary>
        <HourlyView context={context} option={selected} />
      </details>
      <details className="activation-analysis-section" open={initialView === "value"}>
        <summary>Add Business Assumptions</summary>
        <CommercialView
          context={context}
          option={selected}
          assumptions={commercialAssumptions}
          onChange={onCommercialChange}
          enabled={commercialEnabled}
          onEnable={onCommercialEnable}
        />
      </details>
    </div>
  );
}

export function ActivationStudyPanel(props: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const context = useMemo(
    () =>
      createActivationStudyContext({
        project: props.project,
        candidate: props.candidate,
        registeredStudy: props.registeredStudy,
        referenceCapacity: props.referenceCapacity,
      }),
    [props.project, props.candidate, props.referenceCapacity, props.registeredStudy],
  );
  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [commercialAssumptions, setCommercialAssumptions] = useState(
    defaultRepresentativeCommercialAssumptions,
  );
  const [commercialEnabled, setCommercialEnabled] = useState(false);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    panel?.addEventListener("keydown", trapFocus);
    return () => {
      panel?.removeEventListener("keydown", trapFocus);
      previousFocus?.focus();
    };
  }, []);
  const selectedOption =
    context.decisionMatrix.find((option) => option.kind === selectedKind) ??
    context.recommendedOption ??
    context.bestInvestigativeHypothesis;
  const downloadBrief = () => {
    const value = commercialEnabled
      ? calculateRepresentativeCommercialValue(context, commercialAssumptions, selectedOption)
      : null;
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
        selectedOptionKind: selectedKind ?? context.recommendedOption?.kind ?? null,
        commercialAssumptions: commercialEnabled ? commercialAssumptions : null,
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
    { id: "overview", label: "Summary" },
    { id: "options", label: "Options" },
    { id: "evidence", label: "Evidence" },
  ];
  const primaryTab = ["topology", "hourly", "commercial", "options"].includes(props.tab)
    ? "options"
    : props.tab;
  const initialStrategyView: StrategyAnalysisView =
    props.tab === "topology"
      ? "constraint"
      : props.tab === "hourly"
        ? "hourly"
        : props.tab === "commercial"
          ? "value"
          : "comparison";
  return (
    <aside
      ref={panelRef}
      className="activation-study-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="activation-study-title"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") props.onClose();
      }}
    >
      <header className="activation-study-header">
        <button type="button" onClick={props.onClose}>
          <ArrowLeft aria-hidden="true" /> Back to map
        </button>
        <div>
          <span className="eyebrow">Selected candidate · Activation Study</span>
          <h2 id="activation-study-title">{context.candidate.nodeName}</h2>
        </div>
        <StudyEvidenceBadge context={context} />
        {context.mode === "synthetic_demonstration" && (
          <p className="activation-boundary">
            Representative benchmark—not calculated capacity at this mapped node.
          </p>
        )}
      </header>
      <nav className="activation-study-tabs" aria-label="Activation Study views" role="tablist">
        {tabs.map((item) => (
          <button
            type="button"
            key={item.id}
            className={primaryTab === item.id ? "active" : ""}
            role="tab"
            aria-selected={primaryTab === item.id}
            onClick={() => props.onTabChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div
        className="activation-study-body"
        role="tabpanel"
        tabIndex={0}
        aria-label="Activation Study content"
      >
        {primaryTab === "overview" && <OverviewView context={context} />}
        {primaryTab === "options" && (
          <StrategiesWorkspace
            context={context}
            selectedKind={selectedOption?.kind ?? null}
            onSelect={setSelectedKind}
            initialView={initialStrategyView}
            commercialAssumptions={commercialAssumptions}
            onCommercialChange={setCommercialAssumptions}
            commercialEnabled={commercialEnabled}
            onCommercialEnable={() => setCommercialEnabled(true)}
          />
        )}
        {primaryTab === "evidence" && <EvidenceView context={context} />}
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
                selectedOptionKind: selectedKind ?? context.recommendedOption?.kind ?? null,
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
