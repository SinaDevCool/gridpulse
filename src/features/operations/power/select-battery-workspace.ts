import { batteryEnergyAboveReserveMwh, batteryReserveEnergyMwh } from "../battery-configuration";
import type { OperationsInterval, OperationsOverviewModel } from "../scenario-engine";
import { intervalDurationsHours } from "../planning-time";
import { formatOperationsTime } from "../presentation";
import { humanConstraint, type HistoricalPoint } from "./presentation";

export type BatteryTimelinePoint = {
  timestamp: string;
  label: string;
  endTimestamp: string | null;
  durationMinutes: number | null;
  facilityDemandMw: number | null;
  gridImportMw: number;
  batteryPowerMw: number | null;
  socPercent: number | null;
  startingSocPercent: number | null;
  availableDischargeMw: number | null;
  targetMw: number;
  limitMw: number;
  shortfallMw: number | null;
  limitExceedanceMw: number;
  constraintCode: string;
  constraintLabel: string;
};
export type BatteryEvent = {
  kind: "target" | "limit" | "reserve" | "availability";
  timestamp: string;
  label: string;
};
export type BatterySegment = {
  start: string;
  end: string | null;
  minutes: number;
  code: string;
  label: string;
  count: number;
};

/** Read-only projection of the existing dispatch result. Never simulates another plan. */
export function selectBatteryWorkspace(model: OperationsOverviewModel) {
  const battery = model.scenario.battery;
  const effectiveEnergyMwh = (battery.usableEnergyMwh * battery.stateOfHealthPercent) / 100;
  const protectedEnergyMwh = batteryReserveEnergyMwh(battery);
  const protectedSocPercent =
    effectiveEnergyMwh > 0
      ? (protectedEnergyMwh / effectiveEnergyMwh) * 100
      : protectedEnergyMwh > 0
        ? Infinity
        : 0;
  const targetMw = Math.max(0, model.scenario.importLimitMw - model.scenario.safetyReserveMw);
  const durations = intervalDurationsHours(model.intervals);
  const points: BatteryTimelinePoint[] = model.intervals.map((point, index) => {
    const durationMinutes = point.durationMinutes ?? durations[index] * 60;
    return {
      timestamp: point.timestamp,
      label: point.label,
      endTimestamp: new Date(Date.parse(point.timestamp) + durationMinutes * 60_000).toISOString(),
      durationMinutes,
      facilityDemandMw: point.baselineDemandMw,
      gridImportMw: point.batteryDemandMw,
      batteryPowerMw: point.batteryPowerMw,
      socPercent: point.batterySocPercent,
      startingSocPercent: point.batteryStartingSocPercent ?? null,
      availableDischargeMw: point.availableDischargeMw,
      targetMw,
      limitMw: model.scenario.importLimitMw,
      shortfallMw: point.batteryShortfallMw,
      limitExceedanceMw: Math.max(0, point.batteryDemandMw - model.scenario.importLimitMw),
      constraintCode: point.batteryConstraintCode,
      constraintLabel:
        point.batteryConstraintCode === "none"
          ? "Unconstrained"
          : humanConstraint(point.batteryConstraintCode),
    };
  });
  const segments = batteryConstraintSegments(points);
  const events: BatteryEvent[] = [];
  const add = (
    kind: BatteryEvent["kind"],
    point: BatteryTimelinePoint | undefined,
    label: string,
  ) => {
    if (point) events.push({ kind, timestamp: point.timestamp, label });
  };
  add(
    "target",
    points.find((point) => (point.shortfallMw ?? 0) > 0.01),
    "First target shortfall",
  );
  add(
    "limit",
    points.find((point) => point.limitExceedanceMw > 0.01),
    "First facility-limit breach",
  );
  add(
    "reserve",
    points.find(
      (point) => point.socPercent != null && point.socPercent <= protectedSocPercent + 0.001,
    ),
    "Protected reserve reached in interval",
  );
  add(
    "availability",
    points.find((point) =>
      ["asset_unavailable", "inverter_unavailable", "constraint_conflict"].includes(
        point.constraintCode,
      ),
    ),
    "Equipment / constraint restriction",
  );
  const targetMet = points.every((point) => (point.shortfallMw ?? Infinity) <= 0.01);
  const reserveProtected =
    protectedEnergyMwh <= effectiveEnergyMwh &&
    model.intervals.every(
      (point) =>
        point.batteryConstraintCode !== "constraint_conflict" &&
        (point.batteryEndingEnergyMwh ?? (effectiveEnergyMwh * point.batterySocPercent) / 100) +
          0.000001 >=
          protectedEnergyMwh,
    );
  return {
    points,
    segments,
    events,
    targetMet,
    reserveProtected,
    protectedSocPercent,
    protectedEnergyMwh,
    effectiveEnergyMwh,
    dischargeMinutes: points.reduce(
      (sum, point) => sum + ((point.batteryPowerMw ?? 0) > 0 ? (point.durationMinutes ?? 0) : 0),
      0,
    ),
  };
}

/** The same contiguous-run projection powers both horizon tests and the visible strip. */
export function batteryConstraintSegments(points: BatteryTimelinePoint[]): BatterySegment[] {
  const segments: BatterySegment[] = [];
  for (const point of points) {
    const previous = segments.at(-1);
    if (
      previous?.code === point.constraintCode &&
      (previous.end === point.timestamp || previous.end === null)
    ) {
      previous.end = point.endTimestamp;
      previous.minutes += point.durationMinutes ?? 0;
      previous.count++;
    } else
      segments.push({
        start: point.timestamp,
        end: point.endTimestamp,
        minutes: point.durationMinutes ?? 0,
        code: point.constraintCode,
        label: point.constraintLabel,
        count: 1,
      });
  }
  return segments;
}

/** Observations are instants, not simulated intervals or capability claims. */
export function historicalBatteryPoints(
  points: HistoricalPoint[],
  limitMw: number,
  reserveMw: number,
): BatteryTimelinePoint[] {
  return points.map((point) => {
    const limit =
      point.operatingLimitMw == null ? limitMw : Math.min(limitMw, point.operatingLimitMw);
    const target = Math.max(0, limit - reserveMw);
    const complete = point.batteryPowerMw != null && point.socPercent != null;
    return {
      ...point,
      label: formatOperationsTime(point.timestamp),
      endTimestamp: null,
      durationMinutes: null,
      startingSocPercent: null,
      availableDischargeMw: point.battery?.allowedDischargeMw ?? null,
      targetMw: target,
      limitMw: limit,
      shortfallMw: Math.max(0, point.gridImportMw - target),
      limitExceedanceMw: Math.max(0, point.gridImportMw - limit),
      constraintCode: complete ? "observed" : "missing_evidence",
      constraintLabel: complete
        ? "Observed · constraint not inferred"
        : "Missing aligned battery evidence",
    };
  });
}

export function intervalLabel(point: Pick<BatteryTimelinePoint, "timestamp" | "endTimestamp">) {
  return point.endTimestamp
    ? `${formatOperationsTime(point.timestamp)} – ${formatOperationsTime(point.endTimestamp)}`
    : `${formatOperationsTime(point.timestamp)} · observation`;
}

export function selectedReserveEnergy(model: OperationsOverviewModel, point: OperationsInterval) {
  return batteryEnergyAboveReserveMwh(
    model.scenario.battery,
    point.batterySocPercent,
    point.batteryEndingEnergyMwh,
  );
}
