import { describe, expect, it } from "vitest";
import { calculateOperatingEnvelope, summarizeOperatingEnvelope } from "./operating-envelope";

describe("operating envelope", () => {
  it("treats workload recovery as mandatory even when proposed demand fits directly", () => {
    const [point] = calculateOperatingEnvelope([
      {
        timestamp: "2026-10-18T00:00:00Z",
        baselineDemandMw: 98,
        contractualLimitMw: 100,
        workloadReboundMw: 5,
      },
    ]);
    expect(point.feasibleBand).toBe("infeasible");
    expect(point.residualShortfallMw).toBe(3);
    expect(point.directHeadroomMw).toBe(-3);
    expect(point.combinedCeilingMw).toBe(95);
  });
  it("uses battery and shifting to cover recovery before claiming feasibility", () => {
    const base = {
      timestamp: "2026-10-18T00:00:00Z",
      baselineDemandMw: 98,
      contractualLimitMw: 100,
      workloadReboundMw: 5,
      batteryAvailableEnergyMwh: 10,
    };
    const [battery, combined] = calculateOperatingEnvelope([
      { ...base, batteryAvailablePowerMw: 3 },
      { ...base, batteryAvailablePowerMw: 2, workloadFlexibleMw: 1 },
    ]);
    expect(battery).toMatchObject({
      feasibleBand: "battery",
      batteryResponseMw: 3,
      residualShortfallMw: 0,
    });
    expect(combined).toMatchObject({
      feasibleBand: "battery_workload",
      batteryResponseMw: 2,
      workloadResponseMw: 1,
      residualShortfallMw: 0,
    });
  });
  it("agrees with an independent response budget over demand/rebound/resource combinations", () => {
    for (const demand of [90, 100, 105])
      for (const rebound of [0, 4, 12])
        for (const power of [0, 3])
          for (const flexible of [0, 5]) {
            const [point] = calculateOperatingEnvelope([
              {
                timestamp: "2026-10-18T00:00:00Z",
                baselineDemandMw: demand,
                contractualLimitMw: 100,
                safetyReserveMw: 2,
                batteryAvailablePowerMw: power,
                batteryAvailableEnergyMwh: 10,
                workloadReboundMw: rebound,
                workloadFlexibleMw: flexible,
              },
            ]);
            const shortfall = Math.max(0, demand + rebound - 98 - power - flexible);
            expect(point.residualShortfallMw).toBe(shortfall);
            expect(point.feasibleBand === "infeasible").toBe(shortfall > 0);
          }
  });
  it("rejects nonfinite resource inputs and explicit empty summaries", () => {
    expect(() =>
      calculateOperatingEnvelope([
        {
          timestamp: "2026-10-18T00:00:00Z",
          baselineDemandMw: 90,
          contractualLimitMw: 100,
          batteryAvailableEnergyMwh: Infinity,
        },
      ]),
    ).toThrow();
    expect(() => summarizeOperatingEnvelope([])).toThrow(/At least one/);
  });
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
    const [interval] = calculateOperatingEnvelope([
      {
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
      },
    ]);
    expect(interval.batteryCeilingMw).toBe(101.8);
    expect(interval.residualShortfallMw).toBe(3.2);
  });
});
