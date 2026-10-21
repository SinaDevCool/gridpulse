import type { OperationsOverviewModel, OperationsScenarioKind } from "../scenario-engine";
import { PlanObligations } from "./PlanObligations";
import { OperatingSummary } from "./OperatingSummary";
import { DemandChart } from "./DemandChart";
export function OverviewView({
  model,
  fullModel,
  selected,
  onSelect,
}: {
  model: OperationsOverviewModel;
  fullModel: OperationsOverviewModel;
  selected: OperationsScenarioKind;
  onSelect: (kind: OperationsScenarioKind) => void;
}) {
  if (!model.intervals.length)
    return (
      <section className="operations-v2-view">
        <h2>Assessment unavailable</h2>
        <p>No intervals available. Adjust the inputs or retry the assessment.</p>
      </section>
    );
  return (
    <section className="operations-v2-view" aria-labelledby="operations-overview-title">
      <h2 id="operations-overview-title" className="sr-only">
        Operations Overview
      </h2>
      <OperatingSummary model={model} selected={selected} />
      <DemandChart model={model} fullModel={fullModel} selected={selected} onSelect={onSelect} />
      <PlanObligations fullModel={fullModel} selected={selected} />
    </section>
  );
}
