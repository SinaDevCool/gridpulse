import { summarizeOperatingEnvelope } from "./operating-envelope";
import { intervalDurationsHours } from "./planning-time";
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
  now: "Assessed peak",
  "next-4h": "4-hour risk inspection",
  today: "Full scenario day",
  tomorrow: "Full scenario day",
};

export const operationsModeLabels: Record<OperationsDataMode, string> = {
  scenario: "Scenario",
  live: "Live",
  historical: "Historical",
};

export function intervalsForWindow(
  intervals: OperationsInterval[],
  window: OperatingWindowPreset,
  targetMw?: number,
) {
  if (!intervals.length) return [];
  if (window === "now") {
    const peakIndex = intervals.reduce(
      (best, point, index) =>
        point.baselineDemandMw > intervals[best].baselineDemandMw ? index : best,
      0,
    );
    return intervals.slice(peakIndex, peakIndex + 1);
  }
  if (window === "next-4h") {
    const firstRisk = intervals.findIndex((point) =>
      targetMw != null
        ? point.baselineDemandMw > targetMw
        : point.baselineDemandMw > point.combinedDemandMw,
    );
    const hours = intervalDurationsHours(intervals);
    const end = Date.parse(intervals.at(-1)!.timestamp) + hours.at(-1)! * 3_600_000;
    const risk = Date.parse(intervals[Math.max(0, firstRisk)].timestamp);
    const start = Math.max(
      Date.parse(intervals[0].timestamp),
      Math.min(risk - 3_600_000, end - 4 * 3_600_000),
    );
    return intervals.filter(
      (point) =>
        Date.parse(point.timestamp) >= start && Date.parse(point.timestamp) < start + 4 * 3_600_000,
    );
  }
  return intervals;
}

export function scopeOperationsModel(
  model: OperationsOverviewModel,
  window: OperatingWindowPreset,
): OperationsOverviewModel {
  if (!model.intervals.length) return model;
  const intervals = intervalsForWindow(
    model.intervals,
    window,
    model.scenario.importLimitMw - model.scenario.safetyReserveMw,
  );
  if (intervals.length === model.intervals.length) return model;
  const summaries = model.summaries.map((summary) => summarize(summary, intervals, model));
  const baseline = summaries[0];
  const combined = summaries[2];
  const target = model.scenario.importLimitMw - model.scenario.safetyReserveMw;
  const headroom = Math.max(0, target - combined.peakDemandMw);
  const incrementalGpuMw = (model.scenario.gpuActivePowerWatts * model.scenario.pue) / 1_000_000;
  const intervalTimestamps = new Set(intervals.map((interval) => interval.timestamp));
  const durations = durationMap(model);
  const envelopeIntervals = model.operatingEnvelope.intervals.filter((interval) =>
    intervalTimestamps.has(interval.timestamp),
  );
  return {
    ...model,
    intervals,
    summaries,
    metrics: {
      ...model.metrics,
      facilityDemand: { ...model.metrics.facilityDemand, value: combined.peakDemandMw },
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
      durationMinutes: intervals.reduce(
        (sum, point) => sum + (point.batteryPowerMw > 0 ? durations.get(point.timestamp)! * 60 : 0),
        0,
      ),
      workloadMwh: Number(
        intervals
          .reduce((sum, point) => sum + point.workloadShiftMw * durations.get(point.timestamp)!, 0)
          .toFixed(1),
      ),
      violationsAvoided: Math.max(0, baseline.violationIntervals - combined.violationIntervals),
      peakReductionMw: Number((baseline.peakDemandMw - combined.peakDemandMw).toFixed(1)),
      additionalGpuHours: combined.additionalGpuHours,
    },
    operatingEnvelope: {
      intervals: envelopeIntervals,
      summary: summarizeOperatingEnvelope(envelopeIntervals),
    },
  };
}

function summarize(
  source: ScenarioSummary,
  intervals: OperationsInterval[],
  model: OperationsOverviewModel,
): ScenarioSummary {
  const durations = durationMap(model);
  const key: Record<OperationsScenarioKind, keyof OperationsInterval> = {
    baseline: "baselineDemandMw",
    battery: "batteryDemandMw",
    battery_workload: "combinedDemandMw",
    workload: "workloadDemandMw",
  };
  const values = intervals.map((point) => Number(point[key[source.kind]]));
  const violations = values.filter((value) => value > model.scenario.importLimitMw).length;
  const incrementalGpuMw = (model.scenario.gpuActivePowerWatts * model.scenario.pue) / 1_000_000;
  return {
    ...source,
    peakDemandMw: Number(Math.max(...values).toFixed(1)),
    violationIntervals: violations,
    violationHours: Number(
      intervals
        .reduce(
          (sum, point, i) =>
            sum + (values[i] > model.scenario.importLimitMw ? durations.get(point.timestamp)! : 0),
          0,
        )
        .toFixed(2),
    ),
    totalEnergyMwh: Number(
      values
        .reduce((sum, value, i) => sum + value * durations.get(intervals[i].timestamp)!, 0)
        .toFixed(1),
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
                    durations.get(point.timestamp)!
                  : 0),
              0,
            ),
          ),
  };
}

function durationMap(model: OperationsOverviewModel) {
  const explicit = new Map(
    model.planningTime?.intervals.map((item) => [Date.parse(item.start), item]),
  );
  const hours = intervalDurationsHours(model.intervals);
  return new Map(
    model.intervals.map((point, index) => {
      const interval = explicit.get(Date.parse(point.timestamp));
      return [
        point.timestamp,
        interval
          ? (Date.parse(interval.end) - Date.parse(interval.start)) / 3_600_000
          : hours[index],
      ];
    }),
  );
}

export function describeDisplayWindow(
  model: OperationsOverviewModel,
  window: OperatingWindowPreset,
) {
  const intervals = intervalsForWindow(
    model.intervals,
    window,
    model.scenario.importLimitMw - model.scenario.safetyReserveMw,
  );
  if (!intervals.length) return "No intervals available";
  const durations = durationMap(model);
  const minutes = intervals.reduce((sum, point) => sum + durations.get(point.timestamp)! * 60, 0);
  return `${minutes} minutes displayed${window === "next-4h" && minutes < 240 ? " · Partial coverage: fewer than four hours available" : ""}. Recovery and battery state retain the full calculation horizon.`;
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
