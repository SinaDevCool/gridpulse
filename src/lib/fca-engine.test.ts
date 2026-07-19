import { describe, expect, it } from "vitest";
import {
  simulateFlexibleConnection,
  validateIntervalProfile,
  type DispatchSettings,
  type IntervalPoint,
} from "./fca-engine";

const points = (loads: number[]): IntervalPoint[] =>
  loads.map((importMw, index) => ({
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, index * 15)).toISOString(),
    importMw,
    exportMw: 0,
  }));

const settings: DispatchSettings = {
  firmImportMw: 50,
  conditionalImportMw: 0,
  minimumCriticalLoadMw: 40,
  shiftableLoadMw: 5,
  batteryPowerMw: 10,
  batteryEnergyMwh: 5,
  batteryRoundTripEfficiency: 1,
  batteryMinimumSoc: 0,
  initialBatterySoc: 1,
  energyValueEurMwh: 200,
  batteryDegradationEurMwh: 20,
};

describe("interval profile validation", () => {
  it("accepts complete 15-minute data", () => {
    expect(validateIntervalProfile(points([50, 51, 52])).valid).toBe(true);
  });

  it("reports missing intervals", () => {
    const profile = points([50, 51, 52]);
    profile[2].timestamp = new Date(Date.UTC(2026, 0, 1, 1, 0)).toISOString();
    expect(validateIntervalProfile(profile).missingIntervals).toBe(2);
  });
});

describe("flexible connection dispatch", () => {
  it("serves demand below the declared connection limit", () => {
    const result = simulateFlexibleConnection(points([40, 45]), settings);
    expect(result.residualUnservedMwh).toBe(0);
    expect(result.restrictedIntervals).toBe(0);
  });

  it("uses workload shifting before battery discharge", () => {
    const result = simulateFlexibleConnection(points([60]), settings);
    expect(result.timeline[0].workloadResponseMw).toBe(5);
    expect(result.timeline[0].batteryResponseMw).toBe(5);
    expect(result.residualUnservedMwh).toBe(0);
  });

  it("records residual demand after battery energy is exhausted", () => {
    const constrained = points(Array.from({ length: 8 }, () => 70));
    const result = simulateFlexibleConnection(constrained, settings);
    expect(result.batteryDischargeMwh).toBe(5);
    expect(result.residualUnservedMwh).toBeGreaterThan(0);
  });

  it("recharges from declared connection headroom between constrained events", () => {
    const profile = points([70, 40, 40, 70]);
    const result = simulateFlexibleConnection(profile, {
      ...settings,
      batteryEnergyMwh: 2.5,
    });
    expect(result.timeline[0].batterySocMwh).toBe(0);
    expect(result.timeline[1].batteryChargeMw).toBe(10);
    expect(result.timeline[2].batterySocMwh).toBe(2.5);
    expect(result.timeline[3].batteryResponseMw).toBe(10);
    expect(result.timeline[3].residualShortfallMw).toBe(5);
  });

  it("counts restriction events and their longest continuous duration", () => {
    const result = simulateFlexibleConnection(points([60, 60, 40, 60]), settings);
    expect(result.restrictionEvents).toBe(2);
    expect(result.longestRestrictionHours).toBe(0.5);
  });

  it("separately flags limits below the project's minimum viable import", () => {
    const result = simulateFlexibleConnection(points([45]), {
      ...settings,
      firmImportMw: 40,
      minimumViableImportMw: 50,
    });
    expect(result.minimumViableBreaches).toBe(1);
    expect(result.classification).toBe("fails_minimum_viable_capacity");
  });
});
