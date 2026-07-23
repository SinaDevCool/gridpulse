import { describe, expect, it } from "vitest";
import type { ConnectionOptionResult } from "./connection-options";
import { buildOptionSensitivity } from "./option-sensitivity";

function option(exposure?: number): ConnectionOptionResult {
  return {
    kind: "reduced_firm",
    title: "Reduced firm",
    initialImportMw: 60,
    eventualImportMw: 60,
    evidenceStatus: "customer_hypothesis",
    operationalStatus:
      exposure === undefined ? "insufficient_evidence" : "feasible_with_constraints",
    analysis:
      exposure === undefined
        ? null
        : ({ estimatedAnnualExposureEur: exposure } as ConnectionOptionResult["analysis"]),
    customerCommitments: [],
    operatorQuestions: [],
    warnings: [],
  };
}

describe("connection-option sensitivity", () => {
  it("builds a deterministic exposure range", () => {
    expect(buildOptionSensitivity(option(100_000))).toMatchObject({
      status: "modelled",
      lowExposureEur: 50_000,
      baseExposureEur: 100_000,
      highExposureEur: 200_000,
    });
  });

  it("does not invent a range without profile evidence", () => {
    expect(buildOptionSensitivity(option())).toMatchObject({
      status: "insufficient_evidence",
      lowExposureEur: null,
    });
  });
});
