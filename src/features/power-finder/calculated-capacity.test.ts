import { describe, expect, it } from "vitest";
import { capacityValueForMetric, isCurrentCalculatedCapacity } from "./calculated-capacity";

const node = {
  resultId: "r1", studyRunId: "s1", publicNodeId: "n1", candidateId: "c1", modelBusId: "b1",
  firmCapacityMw: 20, flexibleCapacityMw: 35, bessAssistedCapacityMw: 42,
  stagedInitialCapacityMw: 15, eventualCapacityMw: 50, restrictedHours: 10,
  restrictedEnergyMwh: 25, bindingCategory: "thermal", validationState: "calculated" as const,
  calculatedAt: "2026-08-09T00:00:00Z", modelVersion: "v1", scenarioLabel: "winter peak",
  securityCase: "n_1" as const,
};

describe("calculated capacity contract", () => {
  it("keeps strategy metrics separate", () => {
    expect(capacityValueForMetric(node, "firm_import_mw")).toBe(20);
    expect(capacityValueForMetric(node, "bess_assisted_import_mw")).toBe(42);
  });

  it("never treats stale or missing values as current capacity", () => {
    expect(isCurrentCalculatedCapacity({ ...node, valueMw: 20 })).toBe(true);
    expect(isCurrentCalculatedCapacity({ ...node, valueMw: 20, validationState: "stale" })).toBe(false);
    expect(isCurrentCalculatedCapacity({ ...node, valueMw: null })).toBe(false);
  });
});
