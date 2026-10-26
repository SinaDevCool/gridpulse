import { describe, expect, it } from "vitest";
import { experimentRequestSchema, experimentResultSchema } from "./experiment-contracts";

describe("experiment boundary", () => {
  const request = { schema_version: "gridpulse-facility-experiment-request-v1", baseline_job_id: "11111111-1111-4111-8111-111111111111",
    baseline_result_fingerprint: "a".repeat(64), cases: [{ case_id: "half", mode: "frozen_plan", changes: [{field: "battery_energy_mwh", value: 40, asset_id: "b"}] }] };
  it("accepts explicit bounded changes and rejects unbounded or nonfinite inputs", () => {
    expect(experimentRequestSchema.safeParse(request).success).toBe(true);
    expect(experimentRequestSchema.safeParse({...request, cases: Array(5).fill(request.cases[0])}).success).toBe(false);
    expect(experimentRequestSchema.safeParse({...request, cases: [{...request.cases[0], changes: [{field: "battery_energy_mwh", value: Infinity}]}]}).success).toBe(false);
  });
  it("never accepts dispatch or a calibrated probability claim", () => {
    const result = { schema_version: "gridpulse-facility-experiment-result-v1", engine_version: "fixture",
      input_fingerprint: "a".repeat(64), result_fingerprint: "b".repeat(64), baseline_result_fingerprint: "c".repeat(64),
      scenario_basis: "assumed_not_calibrated_probability", capacity_claim: false, automatic_live_dispatch_authorized: true,
      cases: [{case_id: "half", mode: "frozen_plan", status: "completed", accepted: false}] };
    expect(experimentResultSchema.safeParse(result).success).toBe(false);
  });
});
