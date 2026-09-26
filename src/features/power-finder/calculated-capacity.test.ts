import { describe, expect, it } from "vitest";
import {
  capacityValueForMetric,
  isCurrentCalculatedCapacity,
  referenceCapacityValue,
  type ReferenceCapacityResult,
} from "./calculated-capacity";

const node = {
  resultId: "r1",
  studyRunId: "s1",
  publicNodeId: "n1",
  candidateId: "c1",
  modelBusId: "b1",
  firmCapacityMw: 20,
  n0CapacityMw: 28,
  flexibleCapacityMw: 35,
  bessAssistedCapacityMw: 42,
  stagedInitialCapacityMw: 15,
  eventualCapacityMw: 50,
  restrictedHours: 10,
  restrictedEnergyMwh: 25,
  bindingCategory: "thermal",
  validationState: "calculated" as const,
  calculatedAt: "2026-08-09T00:00:00Z",
  modelVersion: "v1",
  scenarioLabel: "winter peak",
  securityCase: "n_1" as const,
};

describe("calculated capacity contract", () => {
  it("keeps strategy metrics separate", () => {
    expect(capacityValueForMetric(node, "n0_import_mw")).toBe(28);
    expect(capacityValueForMetric(node, "firm_import_mw")).toBe(20);
    expect(capacityValueForMetric(node, "bess_assisted_import_mw")).toBe(42);
  });

  it("never treats stale or missing values as current capacity", () => {
    expect(isCurrentCalculatedCapacity({ ...node, valueMw: 20 })).toBe(true);
    expect(isCurrentCalculatedCapacity({ ...node, valueMw: 20, validationState: "stale" })).toBe(
      false,
    );
    expect(isCurrentCalculatedCapacity({ ...node, valueMw: null })).toBe(false);
  });

  it("keeps calculated reference results separate from mapped nodes", () => {
    const reference = {
      result_id: "ref-1",
      reference_bus_id: "bus-1",
      label: "REF 01",
      n0_capacity_mw: 8,
      n1_capacity_mw: 0,
      firm_capacity_mw: 0,
      flexible_capacity_mw: 6.8,
      bess_assisted_capacity_mw: 8,
      staged_initial_capacity_mw: 4,
      eventual_capacity_mw: 8,
      binding_constraint: "unsupplied_load_bus",
      binding_case: "line-1-out",
      validation_state: "reference_network_calculated" as const,
      graph_pathway_available: true,
    };
    expect(referenceCapacityValue(reference as ReferenceCapacityResult, "flexible_import_mw")).toBe(
      6.8,
    );
    expect(referenceCapacityValue(reference as ReferenceCapacityResult, "n0_import_mw")).toBe(8);
    expect(reference).not.toHaveProperty("publicNodeId");
  });
});
