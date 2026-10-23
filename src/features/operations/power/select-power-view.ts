import type { BatteryObservation, FacilityPowerObservation } from "../battery-dispatch";
import { buildHistoricalSeries, valueOf, type EvidenceMode } from "../power/presentation";
import { importThresholds } from "../presentation";
import type { OperationsOverviewModel } from "../scenario-engine";
import { historicalBatteryPoints, selectBatteryWorkspace } from "./select-battery-workspace";
export function selectPowerView(
  model: OperationsOverviewModel,
  displayModel: OperationsOverviewModel,
  mode: EvidenceMode,
  facilityObservations: FacilityPowerObservation[],
  batteryObservations: BatteryObservation[],
  selectedTimestamp: string | null,
) {
  const scenarioPeak = displayModel.intervals.reduce(
    (peak, point) => (point.baselineDemandMw > peak.baselineDemandMw ? point : peak),
    displayModel.intervals[0],
  );
  const selectedScenario =
    displayModel.intervals.find((point) => point.timestamp === selectedTimestamp) ?? scenarioPeak;
  const historical = buildHistoricalSeries(
    facilityObservations,
    batteryObservations,
    model.assessmentPlan?.alignedPower,
  );
  const selectedHistorical =
    historical.find((point) => point.timestamp === selectedTimestamp) ?? historical.at(-1) ?? null;
  // Uploaded limits are observed declarations, not reviewed contractual evidence.
  const limitMw =
    mode === "historical" && selectedHistorical?.operatingLimitMw != null
      ? Math.min(model.scenario.importLimitMw, selectedHistorical.operatingLimitMw)
      : model.scenario.importLimitMw;
  const targetMw = Math.max(0, limitMw - model.scenario.safetyReserveMw);
  const selected = mode === "scenario" ? selectedScenario : selectedHistorical;
  const workspace = selectBatteryWorkspace(model);
  const visibleTimes = new Set(displayModel.intervals.map((point) => point.timestamp));
  const series =
    mode === "scenario"
      ? workspace.points.filter((point) => visibleTimes.has(point.timestamp))
      : historicalBatteryPoints(
          historical,
          model.scenario.importLimitMw,
          model.scenario.safetyReserveMw,
        );
  const requiredMw =
    mode === "scenario"
      ? Math.max(0, selectedScenario.baselineDemandMw - targetMw)
      : selectedHistorical?.facilityDemandMw != null
        ? Math.max(0, selectedHistorical.facilityDemandMw - targetMw)
        : null;
  const batteryMw =
    mode === "scenario"
      ? selectedScenario.batteryPowerMw
      : (selectedHistorical?.batteryPowerMw ?? null);
  const shortfallMw =
    requiredMw == null || batteryMw == null
      ? null
      : Math.max(0, requiredMw - Math.max(0, batteryMw));
  const feasible = shortfallMw != null && shortfallMw <= 0.01;
  const thresholds = importThresholds(
    selected ? valueOf(selected, "gridImportMw", "batteryDemandMw") : null,
    limitMw,
    model.scenario.safetyReserveMw,
  );
  const responseRequired = requiredMw != null && requiredMw > 0.01;
  const dispatchHeadline =
    !selected || requiredMw == null
      ? "Aligned evidence required"
      : !responseRequired
        ? "No discharge needed this interval"
        : feasible
          ? "Target covered this interval"
          : "Battery response constrained";
  return {
    scenarioPeak,
    selectedScenario,
    historical,
    selectedHistorical,
    targetMw,
    limitMw,
    selected,
    series,
    requiredMw,
    batteryMw,
    shortfallMw,
    feasible,
    thresholds,
    responseRequired,
    dispatchHeadline,
    workspace,
    selectedPoint: series.find((point) => point.timestamp === selected?.timestamp) ?? null,
  };
}
