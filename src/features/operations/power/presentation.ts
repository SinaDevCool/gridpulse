import type { OperationsInterval, OperationsOverviewModel } from "../scenario-engine";
import { batteryReserveEnergyMwh } from "../battery-configuration";

import { alignPowerEvidence } from "../evidence-alignment";

import { type BatteryObservation, type FacilityPowerObservation } from "../battery-dispatch";

import { formatMw, formatPercent } from "../formatting";

import { formatOperationsTime } from "../presentation";

export const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export type EvidenceMode = "scenario" | "historical";

export type HistoricalPoint = {
  timestamp: string;
  label: string;
  facilityDemandMw: number | null;
  gridImportMw: number;
  batteryPowerMw: number | null;
  socPercent: number | null;
  operatingLimitMw: number | null;
  battery: BatteryObservation | null;
};

export function buildHistoricalSeries(
  facility: FacilityPowerObservation[],
  battery: BatteryObservation[],
  aligned = alignPowerEvidence(facility, battery),
): HistoricalPoint[] {
  return aligned.map((point) => {
    const batteryPoint = point.battery;
    return {
      timestamp: point.timestamp,
      label: formatOperationsTime(point.timestamp).replace(" UTC", ""),
      facilityDemandMw:
        batteryPoint && point.facilityImportMw + batteryPoint.activePowerMw >= 0
          ? point.facilityImportMw + batteryPoint.activePowerMw
          : null,
      gridImportMw: point.facilityImportMw,
      batteryPowerMw: batteryPoint?.activePowerMw ?? null,
      socPercent: batteryPoint?.socPercent ?? null,
      operatingLimitMw: point.operatingLimitMw,
      battery: batteryPoint,
    };
  });
}

export const formatOptionalMw = (value: number | null) =>
  value == null ? "Unavailable" : formatMw(value);

const formatOptionalPercent = (value: number | null) =>
  value == null ? "Unavailable" : formatPercent(value);

export function valueOf(point: unknown, historicalKey: string, scenarioKey: string): number | null {
  const record = point as Record<string, unknown>;
  const value = record[historicalKey] ?? record[scenarioKey];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function durationLabel(model: OperationsOverviewModel, selected: OperationsInterval) {
  const usable =
    Math.max(
      0,
      (((model.scenario.battery.usableEnergyMwh * model.scenario.battery.stateOfHealthPercent) /
        100) *
        selected.batterySocPercent) /
        100 -
        batteryReserveEnergyMwh(model.scenario.battery),
    ) * model.scenario.battery.dischargeEfficiency;
  return selected.batteryPowerMw > 0
    ? `${number.format(usable / selected.batteryPowerMw)} h`
    : "Ready";
}

export function humanConstraint(code: string) {
  return (
    (
      {
        none: "None",
        power_limited: "Power limit",
        energy_limited: "Energy limit",
        soc_minimum: "Minimum SOC",
        soc_maximum: "Maximum SOC",
        ramp_limited: "Ramp rate",
        minimum_dwell: "Minimum dwell",
        asset_unavailable: "Asset unavailable",
        inverter_unavailable: "Inverter unavailable",
      } as Record<string, string>
    )[code] ?? code
  );
}
