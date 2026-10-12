import { describe, expect, it } from "vitest";
import { buildOperationsScenario } from "./scenario-engine";
import {
  overviewResultSchema,
  assessmentEnvelopeSchema,
  powerResultSchema,
  assuranceResultSchema,
} from "./transport-contracts";
import { runOperationsAssessment } from "./operations-service";

describe("assessment transport validation", () => {
  it("accepts the real scenario shape", () =>
    expect(overviewResultSchema.safeParse(buildOperationsScenario()).success).toBe(true));
  it("rejects malformed numeric results", () => {
    const result = buildOperationsScenario();
    expect(
      overviewResultSchema.safeParse({
        ...result,
        intervals: [{ ...result.intervals[0], gpuPowerMw: "75" }],
      }).success,
    ).toBe(false);
  });
  it("rejects unauthenticated dispatch claims and incomplete envelopes", () => {
    expect(assessmentEnvelopeSchema.safeParse({ automaticDispatchAuthorized: true }).success).toBe(
      false,
    );
  });
  it("validates historical result shapes and rejects invalid numeric evidence", () => {
    const result = runOperationsAssessment({
      kind: "power",
      facilityName: "Test facility",
      contractedLimitMw: 100,
      limitEvidence: "customer_declared",
      battery: [],
      batteryConfiguration: null,
      facility: Array.from({ length: 4 }, (_, index) => ({
        timestamp: `2026-09-26T00:${String(index * 15).padStart(2, "0")}:00Z`,
        facilityImportMw: 90,
        operatingLimitMw: null,
      })),
    }).result;
    expect(powerResultSchema.safeParse(result).success).toBe(true);
    expect(powerResultSchema.safeParse({ ...(result as object), peakImportMw: "90" }).success).toBe(
      false,
    );
    expect(
      assuranceResultSchema.safeParse({
        quality: {},
        verification: null,
        compliance: {},
        economics: {},
        dispatch: { authorized: true, failClosed: false, reasons: [] },
      }).success,
    ).toBe(false);
  });
});
