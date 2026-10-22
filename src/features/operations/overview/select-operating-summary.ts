import type { OperationsOverviewModel, OperationsScenarioKind } from "../scenario-engine";

export const responseOptions = [
  { value: "baseline", label: "Baseline" },
  { value: "battery", label: "Battery Response" },
  { value: "workload", label: "Workload Only" },
  { value: "battery_workload", label: "Battery + Workload" },
] as const;

/** Presentation only: contributions share one interval; aggregate metrics retain their scope. */
export function selectOperatingSummary(
  model: OperationsOverviewModel,
  selected: OperationsScenarioKind,
  timestamp?: string,
) {
  const summary = model.summaries.find((item) => item.kind === selected)!;
  const key = {
    baseline: "baselineDemandMw",
    battery: "batteryDemandMw",
    workload: "workloadDemandMw",
    battery_workload: "combinedDemandMw",
  } as const;
  const peak =
    model.intervals.find((point) => point.timestamp === timestamp) ??
    model.intervals.reduce((best, point) =>
      point.baselineDemandMw > best.baselineDemandMw ? point : best,
    );
  const limit = model.scenario.importLimitMw;
  const target = limit - model.scenario.safetyReserveMw;
  const battery =
    selected === "battery" || selected === "battery_workload" ? peak.batteryPowerMw : 0;
  const workload =
    selected === "workload"
      ? peak.workloadOnlyShiftMw
      : selected === "battery_workload"
        ? peak.workloadShiftMw
        : 0;
  const recovery =
    selected === "workload"
      ? Math.max(0, peak.workloadDemandMw - peak.baselineDemandMw + workload)
      : selected === "battery_workload"
        ? peak.workloadRecoveryMw
        : 0;
  const required = Math.max(0, peak.baselineDemandMw - target);
  return {
    summary,
    peak,
    limit,
    target,
    battery,
    workload,
    recovery,
    required,
    response: peak.baselineDemandMw - peak[key[selected]],
    residual: Math.max(0, peak[key[selected]] - target),
    headroom: target - summary.peakDemandMw,
    limitHeadroom: limit - summary.peakDemandMw,
    powerMet: summary.peakDemandMw <= target + 0.01,
    recoveryMet: summary.unresolvedWorkMwh <= 0.001,
    gaugeMaximum:
      Math.ceil(
        Math.max(limit * 1.15, model.summaries[0].peakDemandMw, summary.peakDemandMw, 1) / 10,
      ) * 10,
  };
}
