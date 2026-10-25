import type { OperationsOverviewModel, OperationsScenarioKind } from "../scenario-engine";
import { OperatingEnvelopeMap, ScenarioDecisionTable } from "../OperationsDecision";
import { PlanObligations } from "./PlanObligations";
import { ResponseBreakdown } from "./ResponseControls";
import { ResponseExplorerFrame } from "./ResponseExplorerFrame";

export function ResponseExplorer({ model, fullModel, selected, timestamp, onSelect }: {
  model: OperationsOverviewModel; fullModel: OperationsOverviewModel; selected: OperationsScenarioKind;
  timestamp?: string; onSelect: (kind: OperationsScenarioKind) => void;
}) {
  return <ResponseExplorerFrame scope="Power: display window · Recovery: full horizon"
    compare={<ScenarioDecisionTable model={model} fullModel={fullModel} selected={selected} onSelect={onSelect} />}
    interval={<ResponseBreakdown model={model} selected={selected} timestamp={timestamp} />}
    margins={<OperatingEnvelopeMap model={model} timestamp={timestamp} />}>
    <PlanObligations fullModel={fullModel} selected={selected} />
  </ResponseExplorerFrame>;
}
