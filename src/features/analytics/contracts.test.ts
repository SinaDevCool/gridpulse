import { describe, expect, it } from "vitest";
import { c3RequestSchema, jobAcceptedSchema } from "./contracts";
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
});
