import { describe, expect, it } from "vitest";
import { validateFlexibleLoadSpecification, type FlexibleLoadSpecification } from "./flexible-load";

const base: FlexibleLoadSpecification = {
  requestedImportMw: 100,
  firmImportMw: 60,
  conditionalImportMw: 20,
  minimumCriticalLoadMw: 50,
  shiftableLoadMw: 10,
  batteryPowerMw: 20,
  batteryEnergyMwh: 50,
  restrictionDurationHours: 2,
  restrictionEventsPerYear: 20,
  energyValueEurMwh: 200,
  batteryDegradationEurMwh: 20,
  maximumEventsPerDay: 2,
  recoveryHours: 4,
  geographicTransferMw: 5,
  notificationLeadMinutes: 30,
  rampDownMwPerMinute: 5,
  rampUpMwPerMinute: 5,
  upsPowerMw: 5,
  upsEnergyMwh: 2,
  generatorPowerMw: 5,
  generatorMaxHoursYear: 50,
  batteryRoundTripEfficiency: 0.9,
  batteryMinimumSoc: 0.1,
  initialBatterySoc: 1,
};

describe("flexible-load specification", () => {
  it("derives the usable operational envelope", () => {
    const result = validateFlexibleLoadSpecification(base);
    expect(result.blockers).toEqual([]);
    expect(result.derived.maximumCurtailmentMw).toBe(40);
    expect(result.derived.dispatchablePowerMw).toBe(40);
    expect(result.derived.batteryUsableEnergyMwh).toBe(40.5);
  });

  it("blocks internally inconsistent declarations", () => {
    const result = validateFlexibleLoadSpecification({
      ...base,
      firmImportMw: 40,
      conditionalImportMw: 0,
      minimumCriticalLoadMw: 50,
      batteryMinimumSoc: 0.8,
      initialBatterySoc: 0.4,
    });
    expect(result.blockers).toHaveLength(2);
  });
});
