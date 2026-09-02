import { describe, expect, it } from "vitest";
import { canonicalOperatorName } from "./operator-normalization";

describe("canonicalOperatorName", () => {
  it("collapses aliases while retaining unknown operators", () => {
    expect(canonicalOperatorName("50Hertz")).toBe("50Hertz Transmission GmbH");
    expect(canonicalOperatorName("eon_edis")).toBe("E.DIS Netz GmbH");
    expect(canonicalOperatorName("Local Utility")).toBe("Local Utility");
    expect(canonicalOperatorName(null)).toBeNull();
  });
});
