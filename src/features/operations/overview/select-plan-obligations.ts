import { durationMap } from "../operating-context";
import type { OperationsOverviewModel, OperationsScenarioKind } from "../scenario-engine";

/** Presentation projection only. Never recalculates dispatch or job feasibility. */
export function selectPlanObligations(full: OperationsOverviewModel, kind: OperationsScenarioKind) {
  const summary = full.summaries.find((item) => item.kind === kind);
  const hasWorkload = kind === "workload" || kind === "battery_workload";
  const usesBattery = kind === "battery" || kind === "battery_workload";
  const available = full.intervals.length > 0 && !!summary;
  const durations = durationMap(full);
  let deferred = 0;
  let recovered = 0;
  for (const point of full.intervals) {
    const hours = durations.get(point.timestamp)!;
    const shift = kind === "workload" ? point.workloadOnlyShiftMw : point.workloadShiftMw;
    deferred += hasWorkload ? shift * hours : 0;
    recovered += hasWorkload
      ? (kind === "workload"
          ? Math.max(0, point.workloadDemandMw - point.baselineDemandMw + shift)
          : point.workloadRecoveryMw) * hours
      : 0;
  }
  const unresolved = available ? summary!.unresolvedWorkMwh : null;
  const soc = [
    full.scenario.battery.initialSocPercent,
    ...full.intervals.map((p) => p.batterySocPercent),
  ];
  const minSoc = available && soc.every(Number.isFinite) ? Math.min(...soc) : null;
  const reserveFailed =
    usesBattery &&
    available &&
    (minSoc == null ||
      minSoc < full.scenario.battery.minimumSocPercent - 0.01 ||
      Math.max(...soc) > full.scenario.battery.maximumSocPercent + 0.01 ||
      full.intervals.some((p) => p.batteryConstraintCode === "constraint_conflict"));
  return {
    available,
    usesBattery,
    deferred: available ? deferred : null,
    recovered: available ? recovered : null,
    unresolved,
    minSoc,
    reserveFailed,
    recoveryRequired: hasWorkload && deferred > 0.001,
    recoveryIncomplete: unresolved != null && unresolved > 0.001,
  };
}
