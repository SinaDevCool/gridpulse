import { describe, expect, it } from "vitest";
import {
  buildOperationsScenario,
  defaultOperationsScenario,
  operationsScenarioSchema,
} from "./scenario-engine";

describe("operations scenario engine", () => {
  it("keeps the configured operational limit as a user assumption", () => {
    const result = buildOperationsScenario();
    expect(result.metrics.operationalLimit.value).toBe(100);
    expect(result.metrics.operationalLimit.evidenceClass).toBe("user_assumption");
    expect(result.metrics.facilityDemand.evidenceClass).toBe("simulated");
  });

  it("uses charge/discharge signs and conserves deferred work including unresolved obligations", () => {
    const result = buildOperationsScenario();
    result.intervals.forEach((point) => {
      expect(point.batteryDemandMw).toBeCloseTo(point.baselineDemandMw - point.batteryPowerMw, 1);
    });
    expect(result.intervals.some((point) => point.batteryPowerMw < 0)).toBe(true);
    expect(result.intervals.some((point) => point.batteryPowerMw > 0)).toBe(true);
    const shifted = result.intervals.reduce((sum, point) => sum + point.workloadShiftMw * 0.25, 0);
    const recovered = result.intervals.reduce(
      (sum, point) => sum + point.workloadRecoveryMw * 0.25,
      0,
    );
    expect(shifted - recovered).toBeCloseTo(result.summaries[2].unresolvedWorkMwh, 1);
    expect(result.summaries).toHaveLength(4);
  });

  it("respects battery power and reserve constraints", () => {
    const result = buildOperationsScenario();
    expect(Math.max(...result.intervals.map((point) => point.batteryPowerMw))).toBeLessThanOrEqual(
      defaultOperationsScenario.battery.maximumPowerMw,
    );
    expect(
      Math.min(...result.intervals.map((point) => point.batterySocPercent)),
    ).toBeGreaterThanOrEqual(defaultOperationsScenario.battery.minimumSocPercent);
  });

  it("rejects physically incoherent assumptions", () => {
    expect(() =>
      operationsScenarioSchema.parse({ ...defaultOperationsScenario, safetyReserveMw: 100 }),
    ).toThrow(/Safety reserve/);
    expect(() =>
      operationsScenarioSchema.parse({ ...defaultOperationsScenario, gpuIdlePowerWatts: 900 }),
    ).toThrow(/Idle GPU power/);
  });
});
