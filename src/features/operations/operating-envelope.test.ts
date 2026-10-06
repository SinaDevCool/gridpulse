import { describe, expect, it } from "vitest";
import { calculateOperatingEnvelope, summarizeOperatingEnvelope } from "./operating-envelope";

describe("operating envelope", () => {
  it("separates direct, battery, workload and infeasible bands", () => {
    const base = {
      durationMinutes: 15,
      baselineDemandMw: 90,
      contractualLimitMw: 100,
      operatorLimitMw: 98,
      safetyReserveMw: 2,
      batteryAvailablePowerMw: 5,
      batteryAvailableEnergyMwh: 10,
      batteryDischargeEfficiency: 0.95,
      workloadFlexibleMw: 4,
      workloadReboundMw: 0,
      demandUncertaintyMw: 1,
      resourceUncertaintyMw: 0.5,
    };
    const intervals = calculateOperatingEnvelope([
      { ...base, timestamp: "2026-10-06T10:00:00.000Z", proposedDemandMw: 95 },
      { ...base, timestamp: "2026-10-06T10:15:00.000Z", proposedDemandMw: 99 },
      { ...base, timestamp: "2026-10-06T10:30:00.000Z", proposedDemandMw: 104 },
      { ...base, timestamp: "2026-10-06T10:45:00.000Z", proposedDemandMw: 106 },
    ]);
    expect(intervals.map((item) => item.feasibleBand)).toEqual([
      "direct",
      "battery",
      "battery_workload",
      "infeasible",
    ]);
    expect(intervals[0].bindingConstraint).toBe("operator_limit");
    expect(intervals[0].riskAdjustedCeilingMw).toBeLessThan(intervals[0].combinedCeilingMw);
    expect(summarizeOperatingEnvelope(intervals).infeasibleIntervals).toBe(1);
  });

  it("limits battery response by usable energy", () => {
    const [interval] = calculateOperatingEnvelope([{
      timestamp: "2026-10-06T10:00:00.000Z",
      durationMinutes: 60,
      baselineDemandMw: 100,
      proposedDemandMw: 105,
      contractualLimitMw: 100,
      safetyReserveMw: 0,
      batteryAvailablePowerMw: 10,
      batteryAvailableEnergyMwh: 2,
      batteryDischargeEfficiency: 0.9,
      workloadFlexibleMw: 0,
    }]);
    expect(interval.batteryCeilingMw).toBe(101.8);
    expect(interval.residualShortfallMw).toBe(3.2);
  });
});
