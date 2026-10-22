import { describe, expect, it } from "vitest";
import { buildOperationsScenario, defaultOperationsScenario } from "../scenario-engine";
import { scopeOperationsModel } from "../operating-context";
import { responseOptions, selectOperatingSummary } from "./select-operating-summary";
describe("operating summary presentation contract", () => {
  const model = buildOperationsScenario();
  it.each(responseOptions)(
    "inspects every interval without changing aggregate results: $value",
    ({ value }) => {
      const aggregate = selectOperatingSummary(model, value);
      for (const point of model.intervals) {
        const inspected = selectOperatingSummary(model, value, point.timestamp);
        expect(inspected.peak.timestamp).toBe(point.timestamp);
        expect(inspected.battery + inspected.workload - inspected.recovery).toBeCloseTo(
          inspected.response,
          1,
        );
        expect(inspected.summary).toEqual(aggregate.summary);
        expect(inspected.headroom).toBe(aggregate.headroom);
        expect(inspected.residual).toBeGreaterThanOrEqual(0);
      }
    },
  );
  it("keeps overload on the meter scale and signed headroom", () => {
    const s = selectOperatingSummary(model, "baseline");
    expect(s.gaugeMaximum).toBeGreaterThan(s.summary.peakDemandMw);
    expect(s.headroom).toBeLessThan(0);
    expect(s.powerMet).toBe(false);
  });
  it("does not call target compliance a complete plan", () => {
    const s = selectOperatingSummary(model, "battery_workload");
    expect(s.powerMet).toBe(true);
    expect(s.recoveryMet).toBe(false);
    expect(s.limitHeadroom - s.headroom).toBeCloseTo(model.scenario.safetyReserveMw);
  });
  it.each(responseOptions)("uses simultaneous contributions for $value", ({ value }) => {
    const s = selectOperatingSummary(model, value);
    expect(s.battery + s.workload - s.recovery).toBeCloseTo(s.response, 1);
  });
  it("retains full-horizon recovery in a scoped window", () => {
    expect(
      selectOperatingSummary(scopeOperationsModel(model, "now"), "battery_workload").summary
        .unresolvedWorkMwh,
    ).toBe(selectOperatingSummary(model, "battery_workload").summary.unresolvedWorkMwh);
  });
  it("handles unavailable or zero-capacity battery without inventing response", () => {
    for (const battery of [
      { ...defaultOperationsScenario.battery, available: false },
      { ...defaultOperationsScenario.battery, maximumPowerMw: 0, usableEnergyMwh: 0 },
    ]) {
      const s = selectOperatingSummary(
        buildOperationsScenario({ ...defaultOperationsScenario, battery }),
        "battery",
      );
      expect(s.battery).toBe(0);
      expect(s.response).toBe(0);
    }
  });
});
