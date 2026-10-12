import { describe, expect, it } from "vitest";
import { enquiryReadiness } from "./readiness";
describe("operator enquiry readiness", () => {
  it("lists missing inputs without altering evidence", () => {
    const value = enquiryReadiness({
      site: true,
      requestedImport: true,
      loadProfile: false,
      targetDate: false,
      phasing: false,
      constraintExposure: true,
      sourceReferences: true,
    });
    expect(value.ready).toBe(false);
    expect(value.missing).toContain("Load profile");
    expect(value.completed).toBe(4);
  });
});
