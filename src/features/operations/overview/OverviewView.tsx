import type { OperationsOverviewModel, OperationsScenarioKind } from "../scenario-engine";
import {
  OperatingEnvelopeMap,
  OperationsLifecycle,
  ScenarioDecisionTable,
} from "../OperationsDecision";
import { OperatingSummary } from "./OperatingSummary";
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
  return (
    <section className="operations-v2-view" aria-labelledby="operations-overview-title">
      <h2 id="operations-overview-title" className="sr-only">
        Operations Overview
      </h2>
      <OperatingSummary model={model} selected={selected} />
      <DemandChart model={model} selected={selected} onSelect={onSelect} />
      <details className="operations-assurance-panel operations-scenario-comparison">
        <summary>Compare operational responses · full results</summary>
        <p>
          Peaks and exposure use the selected display window. Recovery obligations remain assessed
          over the full planning horizon.
        </p>
        <ScenarioDecisionTable model={model} selected={selected} onSelect={onSelect} />
      </details>
      <details className="operations-assurance-panel">
        <summary>Operating envelope & uncertainty</summary>
        <OperatingEnvelopeMap model={model} />
      </details>
      <details id="operations-recovery" className="operations-assurance-panel">
        <summary>Planning assumptions & recovery obligations</summary>
        <OperationsLifecycle />
        <ul>
          {model.planningWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
        <p>
          Cost unavailable until a reviewed tariff and full-horizon canonical calculation are
          supplied. Reference GPU-hour equivalents are not delivered compute.
        </p>
      </details>
      <details id="operations-assurance" className="operations-assurance-panel">
        <summary>Evidence, verification and control readiness</summary>
        <p>
          Scenario inputs only. Uploaded meter, BMS and workload records remain separately
          identified in the input panel and their evidence views. No delivered response has been
          verified.
        </p>
        <p>
          Physical dispatch is locked. Canonical job validation, current operating agreements and
          authorised equipment integrations are required before any operational execution.
        </p>
      </details>
    </section>
  );
}
