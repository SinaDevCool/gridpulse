import { describe, expect, it } from "vitest";
import {
  classifyCapacityOpportunity,
  createIllustrativeCapacityNodes,
  summariseCapacityOpportunities,
} from "./capacity-opportunity";
import type { CalculatedCapacityNode } from "./calculated-capacity";

const node = (overrides: Partial<CalculatedCapacityNode> = {}): CalculatedCapacityNode => ({
  resultId: "r",
  studyRunId: "s",
  publicNodeId: "n",
  candidateId: "c",
  modelBusId: "b",
  valueMw: 12,
  firmCapacityMw: 12,
  flexibleCapacityMw: 22,
  bessAssistedCapacityMw: 24,
  stagedInitialCapacityMw: 10,
  eventualCapacityMw: 30,
  restrictedHours: 0,
  restrictedEnergyMwh: 0,
  bindingCategory: null,
  validationState: "operator_reviewed",
  calculatedAt: "2026-01-01",
  modelVersion: "v1",
  scenarioLabel: "base",
  securityCase: "n_1",
  ...overrides,
});

describe("capacity opportunity classification", () => {
  it("separates firm fit, activation pathways and below-threshold results", () => {
    expect(classifyCapacityOpportunity(node(), "firm_import_mw", 10).fit).toBe("meets");
    expect(classifyCapacityOpportunity(node(), "firm_import_mw", 20)).toMatchObject({
      fit: "activation",
      alternative: "flexible",
    });
    expect(classifyCapacityOpportunity(node(), "firm_import_mw", 40).fit).toBe("below");
  });
  it("never turns null or stale capacity into zero or a fit", () => {
    expect(
      classifyCapacityOpportunity(node({ firmCapacityMw: null }), "firm_import_mw", 1).fit,
    ).toBe("unknown");
    expect(
      classifyCapacityOpportunity(node({ validationState: "stale" }), "firm_import_mw", 1).fit,
    ).toBe("stale");
  });
  it("counts unmapped coverage as unknown", () => {
    expect(summariseCapacityOpportunities([node()], "firm_import_mw", 10, 3)).toEqual({
      meets: 1,
      activation: 0,
      below: 0,
      stale: 0,
      unknown: 2,
    });
  });
  it("creates deterministic illustrative values without operator claims", () => {
    const first = createIllustrativeCapacityNodes(["node-a"])[0];
    expect(first).toEqual(createIllustrativeCapacityNodes(["node-a"])[0]);
    expect(first.scenarioLabel).toContain("Illustrative demo");
    expect(first.flexibleCapacityMw).toBeGreaterThan(first.firmCapacityMw ?? 0);
  });
});
