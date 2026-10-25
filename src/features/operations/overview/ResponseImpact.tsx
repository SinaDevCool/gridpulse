import type { OperationsOverviewModel, OperationsScenarioKind } from "../scenario-engine";
import { selectBreachSpans } from "./select-breach-spans";
import { OverviewImpact } from "./OverviewImpact";

export function ResponseImpact({ model, selected, onSelect, points = model.intervals }: {
  model: OperationsOverviewModel; selected: OperationsScenarioKind; onSelect: (time: string) => void;
  points?: OperationsOverviewModel["intervals"];
}) {
  if (!points.length) return null;
  const key = { baseline: "baselineDemandMw", battery: "batteryDemandMw", workload: "workloadDemandMw",
    battery_workload: "combinedDemandMw" } as const;
  const baseline = model.summaries[0];
  const response = model.summaries.find(item => item.kind === selected)!;
  const start = Date.parse(points[0].timestamp);
  const last = points.at(-1)!;
  return <OverviewImpact onSelect={onSelect} impact={{
    baselinePeakMw: baseline.peakDemandMw, planPeakMw: response.peakDemandMw,
    limitMw: model.scenario.importLimitMw, scope: "display_range", start,
    durationMs: Math.max(1, Date.parse(last.timestamp) + (last.durationMinutes ?? 0) * 60_000 - start),
    lanes: [
      { label: "Before response", minutes: baseline.violationHours * 60,
        spans: selectBreachSpans(points, "baselineDemandMw", model.scenario.importLimitMw) },
      { label: "Selected response", minutes: response.violationHours * 60,
        spans: selectBreachSpans(points, key[selected], model.scenario.importLimitMw) },
    ],
  }} />;
}
