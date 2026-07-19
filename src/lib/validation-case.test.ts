import { describe, expect, it } from "vitest";
import { buildValidationCase, createSyntheticAnnualDataCentreProfile } from "./validation-case";

describe("German data-centre validation case", () => {
  it("contains a complete non-leap-year 15-minute profile", () => {
    const profile = createSyntheticAnnualDataCentreProfile();
    expect(profile).toHaveLength(35_040);
    expect(new Set(profile.map((point) => point.timestamp)).size).toBe(35_040);
  });

  it("keeps every option explicitly unsupported by the operator", () => {
    const result = buildValidationCase();
    expect(result.options).toHaveLength(6);
    expect(result.options.every((option) => option.evidenceStatus === "customer_hypothesis")).toBe(
      true,
    );
  });

  it("exposes minimum-viable failures instead of hiding them in a score", () => {
    const result = buildValidationCase();
    expect(
      result.options.some((option) => option.operationalStatus === "fails_minimum_viable_capacity"),
    ).toBe(true);
  });
});
