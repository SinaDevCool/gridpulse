import { z } from "zod";
import { readCsv } from "../../shared/csv";
import { batteryConfigurationSchema, type BatteryConfiguration } from "./battery-configuration";
export type { BatteryConfiguration } from "./battery-configuration";

export type BatteryConstraintCode =
  | "none"
  | "power_limited"
  | "energy_limited"
  | "constraint_conflict"
  | "soc_minimum"
  | "soc_maximum"
  | "ramp_limited"
  | "minimum_dwell"
  | "asset_unavailable"
  | "inverter_unavailable";

export type BatteryDispatchInput = {
  timestamp: string;
  facilityDemandMw: number;
  targetImportMw: number;
};

export type BatteryDispatchInterval = BatteryDispatchInput & {
  gridImportMw: number;
  batteryPowerMw: number;
  socPercent: number;
  availableDischargeMw: number;
  availableChargeMw: number;
  shortfallMw: number;
  constraintCode: BatteryConstraintCode;
  durationMinutes: number;
  startingSocPercent: number;
  startingEnergyMwh: number;
  endingEnergyMwh: number;
};

export type FacilityPowerObservation = {
  timestamp: string;
  facilityImportMw: number;
  operatingLimitMw: number | null;
};

export type BatteryObservation = {
  timestamp: string;
  socPercent: number;
  activePowerMw: number;
  allowedDischargeMw: number | null;
  allowedChargeMw: number | null;
  stateOfHealthPercent: number | null;
  temperatureC: number | null;
  inverterState: string | null;
  alarms: string | null;
};

const dispatchInputSchema = z.object({
  timestamp: z
    .string()
    .datetime({ offset: true })
    .refine(
      (value) => Number.isFinite(Date.parse(value)),
      "Timestamp must identify a valid instant.",
    ),
  facilityDemandMw: z.number().finite().nonnegative(),
  targetImportMw: z.number().finite().nonnegative(),
});

export function simulateBatteryDispatch(
  inputs: BatteryDispatchInput[],
  rawConfig: BatteryConfiguration,
  intervalMinutes: number,
): BatteryDispatchInterval[] {
  if (!(intervalMinutes > 0) || !Number.isFinite(intervalMinutes))
    throw new Error("A positive battery interval duration is required.");
  const config = batteryConfigurationSchema.parse(rawConfig);
  inputs = z.array(dispatchInputSchema).max(100_000).parse(inputs);
  const effectiveEnergyMwh = (config.usableEnergyMwh * config.stateOfHealthPercent) / 100;
  let storedEnergyMwh = (effectiveEnergyMwh * config.initialSocPercent) / 100;
  let previousPowerMw = 0;
  let previousMode: "charge" | "discharge" | "idle" = "idle";
  let modeMinutes = config.minimumDwellMinutes;

  return inputs.map((input, index) => {
    const next = inputs[index + 1];
    const duration = next
      ? (Date.parse(next.timestamp) - Date.parse(input.timestamp)) / 60_000
      : intervalMinutes;
    if (!(duration > 0) || !Number.isFinite(duration))
      throw new Error("Battery timestamps must be valid, unique and chronological.");
    const dtHours = duration / 60;
    const startingEnergyMwh = storedEnergyMwh;
    const socPercent = effectiveEnergyMwh ? (storedEnergyMwh / effectiveEnergyMwh) * 100 : 0;
    const dischargeEnergyMw =
      dtHours > 0
        ? (Math.max(0, storedEnergyMwh - (effectiveEnergyMwh * config.minimumSocPercent) / 100) *
            config.dischargeEfficiency) /
          dtHours
        : 0;
    const chargeEnergyMw =
      dtHours > 0
        ? Math.max(0, (effectiveEnergyMwh * config.maximumSocPercent) / 100 - storedEnergyMwh) /
          config.chargeEfficiency /
          dtHours
        : 0;
    const enabled = config.available && config.inverterAvailable;
    const availableDischargeMw = enabled
      ? Math.min(config.maximumDischargePowerMw, dischargeEnergyMw)
      : 0;
    const availableChargeMw = enabled ? Math.min(config.maximumChargePowerMw, chargeEnergyMw) : 0;
    const requiredDischargeMw = Math.max(0, input.facilityDemandMw - input.targetImportMw);
    const desiredChargeMw =
      requiredDischargeMw === 0 && socPercent < config.maximumSocPercent
        ? Math.min(availableChargeMw, Math.max(0, input.targetImportMw - input.facilityDemandMw))
        : 0;
    const requestedPowerMw =
      requiredDischargeMw > 0
        ? Math.min(requiredDischargeMw, availableDischargeMw)
        : -desiredChargeMw;
    const requestedMode =
      requestedPowerMw > 0 ? "discharge" : requestedPowerMw < 0 ? "charge" : "idle";
    let constraintCode: BatteryConstraintCode = "none";
    let batteryPowerMw = requestedPowerMw;

    if (!config.available) {
      batteryPowerMw = 0;
      constraintCode = "asset_unavailable";
    } else if (!config.inverterAvailable) {
      batteryPowerMw = 0;
      constraintCode = "inverter_unavailable";
    } else if (
      requestedMode !== "idle" &&
      previousMode !== "idle" &&
      requestedMode !== previousMode &&
      modeMinutes < config.minimumDwellMinutes
    ) {
      batteryPowerMw = 0;
      constraintCode = "minimum_dwell";
    } else {
      const maxDeltaMw = config.rampRateMwPerMinute * duration;
      const ramped = Math.max(
        previousPowerMw - maxDeltaMw,
        Math.min(previousPowerMw + maxDeltaMw, batteryPowerMw),
      );
      if (Math.abs(ramped - batteryPowerMw) > 0.0001) constraintCode = "ramp_limited";
      // Energy and PCS limits are hard bounds. A ramp-down obligation cannot
      // create energy or force charging beyond the facility's import headroom.
      const safePower = Math.max(
        -desiredChargeMw,
        Math.min(availableDischargeMw, input.facilityDemandMw, ramped),
      );
      batteryPowerMw = safePower;
      if (Math.abs(safePower - ramped) > 0.0001) constraintCode = "constraint_conflict";
    }

    if (batteryPowerMw > 0) {
      storedEnergyMwh -= (batteryPowerMw / config.dischargeEfficiency) * dtHours;
      if (requiredDischargeMw > batteryPowerMw && constraintCode === "none") {
        constraintCode =
          availableDischargeMw < config.maximumDischargePowerMw
            ? "energy_limited"
            : "power_limited";
      }
    } else if (batteryPowerMw < 0) {
      storedEnergyMwh += -batteryPowerMw * config.chargeEfficiency * dtHours;
    }
    storedEnergyMwh = Math.max(
      (effectiveEnergyMwh * config.minimumSocPercent) / 100,
      Math.min((effectiveEnergyMwh * config.maximumSocPercent) / 100, storedEnergyMwh),
    );
    const endingSoc = effectiveEnergyMwh ? (storedEnergyMwh / effectiveEnergyMwh) * 100 : 0;
    if (
      requiredDischargeMw > 0 &&
      endingSoc <= config.minimumSocPercent + 0.001 &&
      constraintCode === "none"
    )
      constraintCode = "soc_minimum";
    if (
      batteryPowerMw < 0 &&
      endingSoc >= config.maximumSocPercent - 0.001 &&
      constraintCode === "none"
    )
      constraintCode = "soc_maximum";

    const actualMode = batteryPowerMw > 0 ? "discharge" : batteryPowerMw < 0 ? "charge" : "idle";
    // An idle interval must not erase the last direction and bypass dwell protection.
    modeMinutes =
      actualMode === "idle" || actualMode === previousMode ? modeMinutes + duration : duration;
    if (actualMode !== "idle") previousMode = actualMode;
    previousPowerMw = batteryPowerMw;
    const gridImportMw = Math.max(0, input.facilityDemandMw - batteryPowerMw);
    return {
      ...input,
      // Preserve numerical precision for downstream calculations; views format values.
      gridImportMw,
      batteryPowerMw,
      socPercent: endingSoc,
      availableDischargeMw,
      availableChargeMw,
      shortfallMw: Math.max(0, gridImportMw - input.targetImportMw),
      constraintCode,
      durationMinutes: duration,
      startingSocPercent: socPercent,
      startingEnergyMwh,
      endingEnergyMwh: storedEnergyMwh,
    };
  });
}

function numeric(cells: string[], index: number, row: number, label: string, nullable = false) {
  if (index < 0 || cells[index] === "") {
    if (nullable) return null;
    throw new Error(`Missing ${label} on row ${row}.`);
  }
  const value = Number(cells[index]);
  if (!Number.isFinite(value)) throw new Error(`Invalid ${label} on row ${row}.`);
  return value;
}

export function parseFacilityPowerCsv(text: string): FacilityPowerObservation[] {
  const { headers, rows } = readCsv(text);
  const timestampIndex = headers.indexOf("timestamp");
  const importIndex = headers.findIndex(
    (header) => header === "facility_import_mw" || header === "grid_import_mw",
  );
  const limitIndex = headers.indexOf("operating_limit_mw");
  if (timestampIndex < 0 || importIndex < 0)
    throw new Error("Required columns: timestamp and facility_import_mw (or grid_import_mw).");
  return rows.map((cells, index) => {
    const timestamp = new Date(cells[timestampIndex]);
    if (!Number.isFinite(timestamp.getTime()))
      throw new Error(`Invalid timestamp on row ${index + 2}.`);
    const observation = {
      timestamp: timestamp.toISOString(),
      facilityImportMw: numeric(cells, importIndex, index + 2, "facility import")!,
      operatingLimitMw: numeric(cells, limitIndex, index + 2, "operating limit", true),
    };
    return z
      .object({
        timestamp: z.string(),
        facilityImportMw: z.number().nonnegative(),
        operatingLimitMw: z.number().positive().nullable(),
      })
      .parse(observation);
  });
}

export function parseBatteryCsv(text: string): BatteryObservation[] {
  const { headers, rows } = readCsv(text);
  const indexOf = (name: string) => headers.indexOf(name);
  if (indexOf("timestamp") < 0 || indexOf("soc_percent") < 0 || indexOf("active_power_mw") < 0) {
    throw new Error("Required columns: timestamp, soc_percent, active_power_mw.");
  }
  return rows.map((cells, index) => {
    const timestamp = new Date(cells[indexOf("timestamp")]);
    if (!Number.isFinite(timestamp.getTime()))
      throw new Error(`Invalid timestamp on row ${index + 2}.`);
    const observation = {
      timestamp: timestamp.toISOString(),
      socPercent: numeric(cells, indexOf("soc_percent"), index + 2, "SOC")!,
      activePowerMw: numeric(cells, indexOf("active_power_mw"), index + 2, "active power")!,
      allowedDischargeMw: numeric(
        cells,
        indexOf("allowed_discharge_mw"),
        index + 2,
        "allowed discharge",
        true,
      ),
      allowedChargeMw: numeric(
        cells,
        indexOf("allowed_charge_mw"),
        index + 2,
        "allowed charge",
        true,
      ),
      stateOfHealthPercent: numeric(
        cells,
        indexOf("state_of_health_percent"),
        index + 2,
        "state of health",
        true,
      ),
      temperatureC: numeric(cells, indexOf("temperature_c"), index + 2, "temperature", true),
      inverterState:
        indexOf("inverter_state") < 0 ? null : cells[indexOf("inverter_state")] || null,
      alarms: indexOf("alarms") < 0 ? null : cells[indexOf("alarms")] || null,
    };
    return z
      .object({
        timestamp: z.string().datetime(),
        socPercent: z.number().min(0).max(100),
        activePowerMw: z.number().min(-2000).max(2000),
        allowedDischargeMw: z.number().nonnegative().nullable(),
        allowedChargeMw: z.number().nonnegative().nullable(),
        stateOfHealthPercent: z.number().min(0).max(100).nullable(),
        temperatureC: z.number().min(-50).max(200).nullable(),
        inverterState: z.string().nullable(),
        alarms: z.string().nullable(),
      })
      .parse(observation);
  });
}
