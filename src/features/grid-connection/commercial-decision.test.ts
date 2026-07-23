import { describe, expect, it } from "vitest";
import { assessCommercialDecision } from "./commercial-decision";
import type { DecisionMatrixRow } from "./decision-matrix";

const option = {
  initialImportMw: 80,
  annualExposureEur: 120_000,
  evidenceReadiness: 90,
  evidenceStatus: "operator_supported",
  operationalStatus: "operationally_feasible",
  analysis: {},
  nextAction: "Advance.",
} as DecisionMatrixRow;

describe("commercial decision gate", () => {
  it("proceeds only with a supported option, cost, and operator schedule", () => {
    const result = assessCommercialDecision({
      requestedImportMw: 100,
      minimumViableImportMw: 60,
      preferredOption: option,
      estimatedConnectionCostEur: 4_000_000,
      indicatedConnectionDate: "2029-01-01",
      targetConnectionDate: "2028-01-01",
    });
    expect(result.gate).toBe("proceed");
    expect(result.demandCoveragePercent).toBe(80);
    expect(result.risks).toEqual([]);
  });

  it("keeps missing commercial evidence visible", () => {
    const result = assessCommercialDecision({
      requestedImportMw: 100,
      minimumViableImportMw: 60,
      preferredOption: {
        ...option,
        evidenceStatus: "customer_hypothesis",
        analysis: null,
        annualExposureEur: null,
      },
      estimatedConnectionCostEur: null,
      indicatedConnectionDate: null,
      targetConnectionDate: "2028-01-01",
    });
    expect(result.gate).not.toBe("proceed");
    expect(result.risks.map((risk) => risk.key)).toEqual(
      expect.arrayContaining(["operator", "exposure", "cost", "schedule"]),
    );
    expect(result.boundary).toContain("Unknown costs and dates remain unknown");
  });
});
