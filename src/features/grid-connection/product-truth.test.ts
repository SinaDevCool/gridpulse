import { describe, expect, it } from "vitest";
import { isCapacityClaimAllowed } from "./product-truth";

describe("product truth policy", () => {
  it("permits a capacity claim only for validated operator evidence", () => {
    expect(isCapacityClaimAllowed("customer_declared", true)).toBe(false);
    expect(isCapacityClaimAllowed("public_source", true)).toBe(false);
    expect(isCapacityClaimAllowed("derived", true)).toBe(false);
    expect(isCapacityClaimAllowed("operator_confirmed", false)).toBe(false);
    expect(isCapacityClaimAllowed("operator_confirmed", true)).toBe(true);
  });
});
