import type { FlexibilityInput } from "./domain";

export const FLEXIBLE_LOAD_SPECIFICATION_VERSION = "flexible-load-v1";

export type FlexibleLoadSpecification = FlexibilityInput & {
  maximumEventsPerDay: number;
  recoveryHours: number;
  geographicTransferMw: number;
  notificationLeadMinutes: number;
  rampDownMwPerMinute: number;
  rampUpMwPerMinute: number;
  upsPowerMw: number;
  upsEnergyMwh: number;
  generatorPowerMw: number;
  generatorMaxHoursYear: number;
  batteryRoundTripEfficiency: number;
  batteryMinimumSoc: number;
  initialBatterySoc: number;
};

export type FlexibleLoadValidation = {
  blockers: string[];
  warnings: string[];
  derived: {
    maximumCurtailmentMw: number;
    dispatchablePowerMw: number;
    batteryUsableEnergyMwh: number;
    batteryDurationHours: number;
    criticalLoadCoveragePercent: number;
  };
};

const round = (value: number) => Math.round(value * 1000) / 1000;

export function validateFlexibleLoadSpecification(
  input: FlexibleLoadSpecification,
): FlexibleLoadValidation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const maximumCurtailmentMw = Math.max(0, input.requestedImportMw - input.firmImportMw);
  const batteryUsableEnergyMwh =
    input.batteryEnergyMwh *
    Math.max(0, input.initialBatterySoc - input.batteryMinimumSoc) *
    input.batteryRoundTripEfficiency;
  const batteryDurationHours = input.batteryPowerMw
    ? batteryUsableEnergyMwh / input.batteryPowerMw
    : 0;
  const dispatchablePowerMw =
    input.shiftableLoadMw +
    input.batteryPowerMw +
    input.geographicTransferMw +
    input.generatorPowerMw;

  if (input.requestedImportMw <= 0) blockers.push("Requested import must be greater than zero.");
  if (input.minimumCriticalLoadMw > input.firmImportMw + input.conditionalImportMw) {
    blockers.push("Critical load exceeds the declared firm and conditional supply.");
  }
  if (input.firmImportMw > input.requestedImportMw) {
    blockers.push("Firm import cannot exceed requested import.");
  }
  if (input.batteryMinimumSoc > input.initialBatterySoc) {
    blockers.push("Initial battery state of charge must meet the minimum state of charge.");
  }
  if (input.batteryRoundTripEfficiency <= 0 || input.batteryRoundTripEfficiency > 1) {
    blockers.push("Battery round-trip efficiency must be above 0 and no greater than 1.");
  }
  if (input.maximumEventsPerDay > 0 && input.recoveryHours <= 0) {
    warnings.push("Declare recovery time when multiple restriction events can occur per day.");
  }
  if (input.batteryPowerMw > 0 && batteryDurationHours < input.restrictionDurationHours) {
    warnings.push("Usable battery duration is shorter than the declared restriction duration.");
  }
  if (input.rampDownMwPerMinute <= 0 && maximumCurtailmentMw > 0) {
    warnings.push("Ramp-down capability is not established.");
  }
  if (dispatchablePowerMw < maximumCurtailmentMw) {
    warnings.push("Declared dispatchable resources do not cover maximum curtailment.");
  }

  return {
    blockers,
    warnings,
    derived: {
      maximumCurtailmentMw: round(maximumCurtailmentMw),
      dispatchablePowerMw: round(dispatchablePowerMw),
      batteryUsableEnergyMwh: round(batteryUsableEnergyMwh),
      batteryDurationHours: round(batteryDurationHours),
      criticalLoadCoveragePercent: input.requestedImportMw
        ? round((input.minimumCriticalLoadMw / input.requestedImportMw) * 100)
        : 0,
    },
  };
}
