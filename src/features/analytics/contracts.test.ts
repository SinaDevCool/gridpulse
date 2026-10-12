import { describe, expect, it } from "vitest";
import {
  c3RequestSchema,
  facilityUncertaintyRequestSchema,
  jobAcceptedSchema,
  marketQualificationRequestSchema,
  rollingFacilityPlanRequestSchema,
} from "./contracts";
describe("analytics contracts", () => {
  it("accepts the API job acknowledgement", () =>
    expect(
      jobAcceptedSchema.parse({ job_id: "00000000-0000-4000-8000-000000000001", status: "queued" })
        .status,
    ).toBe("queued"));
  it("rejects misaligned C3 series", () => {
    const result = c3RequestSchema.safeParse({
      network_model: {},
      security_criteria: {},
      portfolio: {},
      timestamps: ["2026-01-01"],
      demand_mw: [1, 2],
      onsite_generation_mw: [0],
      import_envelope_mw: [1],
      export_envelope_mw: [0],
      price_eur_mwh: [50],
      contract_start: "2026-01-01",
      contract_end: "2026-01-02",
      fca_mode: "dynamic",
    });
    expect(result.success).toBe(false);
  });
  it("rejects reversed uncertainty bounds before submitting a job", () => {
    const result = facilityUncertaintyRequestSchema.safeParse({
      schema_version: "gridpulse-facility-uncertainty-request-v1",
      facility_plan: {},
      bounds: {
        temperature_min_c: 30,
        temperature_max_c: 20,
        onsite_generation_min_mw: 0,
        onsite_generation_max_mw: 5,
      },
      scenario_count: 10,
      seed: 42,
      risk_policy: "chance_constrained",
      confidence: 0.9,
    });
    expect(result.success).toBe(false);
  });
  it("rejects negative market settlement quantities", () => {
    expect(
      marketQualificationRequestSchema.safeParse({
        schema_version: "gridpulse-market-qualification-request-v1",
        product: {}, requirement: {}, uncertainty: {},
        settlement: {
          offered_mw: 1, availability_hours: 1, requested_mwh: 1,
          verified_delivered_mwh: -1,
        },
      }).success,
    ).toBe(false);
  });
  it("rejects rolling windows without a canonical forecast fingerprint", () => {
    expect(
      rollingFacilityPlanRequestSchema.safeParse({
        schema_version: "gridpulse-rolling-facility-plan-request-v1",
        facility_plan: {},
        windows: [{
          window_id: "w", cutoff: "2026-01-01T00:00:00Z",
          forecast_fingerprint: "not-a-hash", recalculation_reason: "initial",
          scenarios: [{}],
        }],
        confidence: 0.9,
      }).success,
    ).toBe(false);
  });
});
