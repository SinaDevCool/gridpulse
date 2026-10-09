import { describe, expect, it } from "vitest";
import { assertEvidenceBoundary } from "./evidence-origin";

describe("evidence origin boundary", () => {
  it("rejects a synthetic capacity claim", () => {
    expect(() => assertEvidenceBoundary({
      origin: "synthetic_fixture", isSynthetic: true,
      validationClass: "synthetic_demonstration", capacityClaim: true,
      operatorConfirmed: false, displayAsCapacity: false,
    })).toThrow(/cannot be represented/);
  });

  it("accepts operator-confirmed evidence", () => {
    expect(assertEvidenceBoundary({
      origin: "operator_supplied", isSynthetic: false,
      validationClass: "operator_confirmed", capacityClaim: true,
      operatorConfirmed: true, displayAsCapacity: true,
    }).operatorConfirmed).toBe(true);
  });
});
