import type {
  OperationsInterval,
  OperationsOverviewModel,
  OperationsScenarioKind,
  ScenarioSummary,
} from "./scenario-engine";

export const operatingWindowValues = ["now", "next-4h", "today", "tomorrow"] as const;
export const operationsModeValues = ["scenario", "live", "historical"] as const;

export type OperatingWindowPreset = (typeof operatingWindowValues)[number];
export type OperationsDataMode = (typeof operationsModeValues)[number];

export const operatingWindowLabels: Record<OperatingWindowPreset, string> = {
  now: "Now",
  "next-4h": "Next 4 Hours",
  today: "Today",
  tomorrow: "Tomorrow",
};

export const operationsModeLabels: Record<OperationsDataMode, string> = {
  scenario: "Scenario",
  live: "Live",
  historical: "Historical",
};

const intervalHours = 0.25;

export function intervalsForWindow(intervals: OperationsInterval[], window: OperatingWindowPreset) {
  if (window === "now") {
    const peakIndex = intervals.reduce(
      (best, point, index) =>
        point.baselineDemandMw > intervals[best].baselineDemandMw ? index : best,
      0,
    );
    return intervals.slice(peakIndex, peakIndex + 1);
  }
  if (window === "next-4h") {
    const firstRisk = intervals.findIndex(
      (point) => point.baselineDemandMw > point.combinedDemandMw,
    );
    const start = Math.max(0, firstRisk < 0 ? 0 : firstRisk - 4);
    return intervals.slice(start, start + 16);
  }
  return intervals;
}

export function scopeOperationsModel(
  model: OperationsOverviewModel,
  window: OperatingWindowPreset,
): OperationsOverviewModel {
  const intervals = intervalsForWindow(model.intervals, window);
  if (intervals.length === model.intervals.length) return model;
  const summaries = model.summaries.map((summary) => summarize(summary, intervals, model));
  const baseline = summaries[0];
  const combined = summaries[2];
  const peak = intervals.reduce(
    (best, point) => (point.baselineDemandMw > best.baselineDemandMw ? point : best),
    intervals[0],
  );
  const target = model.scenario.importLimitMw - model.scenario.safetyReserveMw;
  const headroom = Math.max(0, target - peak.combinedDemandMw);
  const incrementalGpuMw = (model.scenario.gpuActivePowerWatts * model.scenario.pue) / 1_000_000;
  return {
    ...model,
    intervals,
    summaries,
    metrics: {
      ...model.metrics,
      facilityDemand: { ...model.metrics.facilityDemand, value: peak.combinedDemandMw },
      remainingMargin: { ...model.metrics.remainingMargin, value: headroom },
      additionalGpus: {
        ...model.metrics.additionalGpus,
        value: incrementalGpuMw ? Math.floor(headroom / incrementalGpuMw) : 0,
      },
      limitRisk: {
        ...model.metrics.limitRisk,
        value:
          baseline.violationIntervals === 0
            ? "Low"
            : combined.violationIntervals === 0
              ? "Moderate"
              : "High",
      },
    },
    recommendation: {
      ...model.recommendation,
      durationMinutes: intervals.filter((point) => point.batteryPowerMw > 0).length * 15,
      workloadMwh: Number(
        intervals.reduce((sum, point) => sum + point.workloadShiftMw * intervalHours, 0).toFixed(1),
      ),
      violationsAvoided: Math.max(0, baseline.violationIntervals - combined.violationIntervals),
      peakReductionMw: Number((baseline.peakDemandMw - combined.peakDemandMw).toFixed(1)),
      additionalGpuHours: combined.additionalGpuHours,
    },
  };
}

function summarize(
  source: ScenarioSummary,
  intervals: OperationsInterval[],
  model: OperationsOverviewModel,
): ScenarioSummary {
  const key: Record<OperationsScenarioKind, keyof OperationsInterval> = {
    baseline: "baselineDemandMw",
    battery: "batteryDemandMw",
    battery_workload: "combinedDemandMw",
  };
  const values = intervals.map((point) => Number(point[key[source.kind]]));
  const violations = values.filter((value) => value > model.scenario.importLimitMw).length;
  const incrementalGpuMw = (model.scenario.gpuActivePowerWatts * model.scenario.pue) / 1_000_000;
  return {
    ...source,
    peakDemandMw: Number(Math.max(...values).toFixed(1)),
    violationIntervals: violations,
    violationHours: Number((violations * intervalHours).toFixed(2)),
    totalEnergyMwh: Number(
      values.reduce((sum, value) => sum + value * intervalHours, 0).toFixed(1),
    ),
    additionalGpuHours:
      source.kind === "baseline"
        ? 0
        : Math.round(
            intervals.reduce(
              (total, point) =>
                total +
                (incrementalGpuMw
                  ? (Math.max(0, point.baselineDemandMw - Number(point[key[source.kind]])) /
                      incrementalGpuMw) *
                    intervalHours
                  : 0),
              0,
            ),
          ),
  };
}

export type OperationsAlert = {
  id: string;
  state: "normal" | "watch" | "action" | "uncertain";
  title: string;
  detail: string;
  interval: string;
  remainingRisk: string;
};

export function derivePrimaryAlert(model: OperationsOverviewModel): OperationsAlert {
  const target = model.scenario.importLimitMw - model.scenario.safetyReserveMw;
  const firstTargetBreach = model.intervals.find((point) => point.baselineDemandMw > target);
  const firstLimitBreach = model.intervals.find(
    (point) => point.combinedDemandMw > model.scenario.importLimitMw,
  );
  if (!firstTargetBreach) {
    return {
      id: "operating-margin-normal",
      state: "normal",
      title: "Operating margin remains available",
      detail: "No interval in this window crosses the configured safety target.",
      interval: operatingRange(model.intervals),
      remainingRisk: "No action required",
    };
  }
  if (firstLimitBreach) {
    const residual = Math.max(0, firstLimitBreach.combinedDemandMw - model.scenario.importLimitMw);
    return {
      id: "residual-limit-risk",
      state: "action",
      title: "Combined response leaves a residual power-limit risk",
      detail: `Battery and workload response do not fully cover the ${firstLimitBreach.label} interval.`,
      interval: firstLimitBreach.label,
      remainingRisk: `${residual.toFixed(1)} MW above the facility limit`,
    };
  }
  return {
    id: "response-required",
    state: "watch",
    title: "Battery and workload response is required",
    detail: `The baseline crosses the safety target from ${firstTargetBreach.label}; the proposed response restores the operating margin.`,
    interval: firstTargetBreach.label,
    remainingRisk: "No limit violation after response",
  };
}

export function operationalPue(model: OperationsOverviewModel) {
  return {
    value: model.scenario.pue,
    evidence: "user_assumption" as const,
    status: "Scenario assumption",
    detail: "Connect aligned facility and IT energy meters to calculate measured operating PUE.",
  };
}

function operatingRange(intervals: OperationsInterval[]) {
  if (!intervals.length) return "Unavailable";
  if (intervals.length === 1) return intervals[0].label;
  return `${intervals[0].label}–${intervals.at(-1)!.label}`;
}
