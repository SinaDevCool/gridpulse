import { Activity,Bolt,Gauge,ShieldCheck,Zap } from "lucide-react";

import { type OperationsOverviewModel,type OperationsScenarioKind } from "../scenario-engine";

import { assessOperationsCompliance,authorizeDispatch } from "../operations-assurance";

import {
OperatingEnvelopeMap,
OperationsDecisionBrief,
OperationsEvidenceRail,
OperationsLifecycle,
ScenarioDecisionTable,
} from "../OperationsDecision";

import { integer,number,peakInterval } from "./presentation";

import { ImpactRow,MetricCard } from "./primitives";

import { DemandChart } from "./DemandChart";

export function OverviewView({
  model,
  selected,
  onSelect,
}: {
  model: OperationsOverviewModel;
  selected: OperationsScenarioKind;
  onSelect: (kind: OperationsScenarioKind) => void;
}) {
  const selectedSummary =
    model.summaries.find((item) => item.kind === selected) ?? model.summaries[2];
  const snapshot = peakInterval(model);
  const compliance = assessOperationsCompliance({
    facilityEnergyMwh: null,
    itEnergyMwh: null,
    renewableSharePercent: null,
    wasteHeatMwh: null,
    heatTemperatureC: null,
    measurementCoveragePercent: 0,
  });
  const dispatchGate = authorizeDispatch({
    mode: "scenario",
    evidenceReady: compliance.evidenceReady,
    connectorHealthy: false,
    agreementCurrent: false,
    approvalCount: 0,
    automaticDispatchEnabled: false,
  });
  return (
    <section className="operations-v2-view" aria-labelledby="operations-overview-title">
      <h2 id="operations-overview-title" className="sr-only">
        Operations Overview
      </h2>
      <OperationsDecisionBrief model={model} selected={selected} />
      <div className="operations-v2-kpis operations-v2-kpis--outcomes">
        <MetricCard
          icon={<Activity />}
          label="Peak import after response"
          metric={{ ...model.metrics.facilityDemand, value: selectedSummary.peakDemandMw }}
          note={`${selectedSummary.label} · maximum in selected window`}
        />
        <MetricCard
          icon={<Bolt />}
          label="Operational Limit"
          metric={model.metrics.operationalLimit}
          note="Configured facility limit"
        />
        <MetricCard
          icon={<Gauge />}
          label="Minimum target headroom"
          metric={{
            ...model.metrics.remainingMargin,
            value:
              model.scenario.importLimitMw -
              model.scenario.safetyReserveMw -
              selectedSummary.peakDemandMw,
          }}
          note="Safety target minus selected peak import"
        />
      </div>

      <div className="operations-v2-overview-grid">
        <DemandChart model={model} selected={selected} />
        <article id="operations-response" className="operations-v2-recommendation">
          <header>
            <Zap aria-hidden="true" />
            <div>
              <p className="context-label">Selected response</p>
              <h3>{selectedSummary.label}</h3>
            </div>
          </header>
          <p className="operations-v2-recommendation-copy">
            Test up to{" "}
            <strong>
              {number.format(
                selected === "baseline" || selected === "workload"
                  ? 0
                  : model.recommendation.batteryMw,
              )}
              &nbsp;MW
            </strong>{" "}
            of battery response and shift{" "}
            <strong>
              {number.format(
                selected === "battery_workload"
                  ? model.recommendation.workloadMwh
                  : selected === "workload"
                    ? model.intervals.reduce(
                        (sum, point) => sum + point.workloadOnlyShiftMw * 0.25,
                        0,
                      )
                    : 0,
              )}
              &nbsp;MWh
            </strong>{" "}
            of flexible demand.
          </p>
          <dl>
            <ImpactRow
              label="Required Response"
              value={`${number.format(Math.max(0, snapshot.baselineDemandMw - (model.scenario.importLimitMw - model.scenario.safetyReserveMw)))} MW`}
            />
            <ImpactRow
              label="Battery Contribution"
              value={`${number.format(selected === "baseline" || selected === "workload" ? 0 : model.recommendation.batteryMw)} MW`}
            />
            <ImpactRow
              label="Workload Contribution"
              value={`${number.format(selected === "battery_workload" ? Math.max(...model.intervals.map((point) => point.workloadShiftMw)) : selected === "workload" ? Math.max(...model.intervals.map((point) => point.workloadOnlyShiftMw)) : 0)} MW`}
            />
            <ImpactRow
              label="Violation Intervals Avoided"
              value={integer.format(
                Math.max(
                  0,
                  model.summaries[0].violationIntervals - selectedSummary.violationIntervals,
                ),
              )}
            />
            <ImpactRow
              label="Reference GPU-hour equivalent (not delivered compute)"
              value={`${integer.format(selectedSummary.additionalGpuHours)} h`}
            />
          </dl>
          <div className="operations-v2-readonly">
            <ShieldCheck aria-hidden="true" />
            <span>Read-only scenario. No physical control command will be sent.</span>
          </div>
        </article>
      </div>
      <section
        className="operations-scenario-comparison"
        aria-labelledby="scenario-comparison-title"
      >
        <p className="context-label">Scenario comparison</p>
        <h3 id="scenario-comparison-title">Compare operational responses</h3>
        <p className="operations-chart-purpose">
          Peak and exposure use the selected display window. Recovery obligations remain assessed
          over the full planning horizon.
        </p>
        <ScenarioDecisionTable model={model} selected={selected} onSelect={onSelect} />
      </section>
      <details className="operations-assurance-panel">
        <summary>Operating envelope & uncertainty</summary>
        <OperatingEnvelopeMap model={model} />
      </details>
      <OperationsEvidenceRail model={model} />
      <details className="operations-assurance-panel">
        <summary>Planning assumptions & recovery obligations</summary>
        <OperationsLifecycle />
        <ul>
          {model.planningWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
        <p>
          Cost unavailable until a reviewed tariff and full-horizon canonical calculation are
          supplied.
        </p>
      </details>
      <details id="operations-assurance" className="operations-assurance-panel">
        <summary>Evidence, verification and control readiness</summary>
        <div className="operations-assurance-grid">
          <section>
            <span>Measured verification</span>
            <strong>Awaiting observed response</strong>
            <p>
              Predicted and delivered response remain separate until interval evidence is imported.
            </p>
          </section>
          <section>
            <span>Operational evidence</span>
            <strong>{compliance.evidenceReady ? "Evidence ready" : "Evidence incomplete"}</strong>
            <p>{compliance.missing.slice(0, 2).join(" · ") || "Required evidence is aligned."}</p>
          </section>
          <section>
            <span>Economics</span>
            <strong>Disabled in scenario mode</strong>
            <p>Cost selection follows technical feasibility and never changes the safe envelope.</p>
          </section>
          <section>
            <span>Physical dispatch</span>
            <strong>{dispatchGate.authorized ? "Authorized" : "Locked"}</strong>
            <p>{dispatchGate.reasons[0]}</p>
          </section>
        </div>
      </details>
    </section>
  );
}
