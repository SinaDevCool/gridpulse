import { describe, expect, it } from "vitest";
import {
  canonicalOperatorName,
  canonicalOperatorNames,
  formatOperatorNames,
  sameOperatorIdentity,
} from "./operator-normalization";

describe("canonicalOperatorName", () => {
  it("collapses aliases while retaining unknown operators", () => {
    expect(canonicalOperatorName("50Hertz")).toBe("50Hertz Transmission GmbH");
    expect(canonicalOperatorName("eon_edis")).toBe("E.DIS Netz GmbH");
    expect(canonicalOperatorName("Avacon")).toBe("Avacon Netz GmbH");
    expect(canonicalOperatorName("AON Avacon")).toBe("Avacon Netz GmbH");
    expect(canonicalOperatorName("Wesernetz")).toBe("wesernetz Bremen GmbH");
    expect(canonicalOperatorName("EWE_Netz")).toBe("EWE Netz GmbH");
    expect(canonicalOperatorName("Local Utility")).toBe("Local Utility");
    expect(canonicalOperatorName(null)).toBeNull();
  });

  it("normalizes and formats multiple mapped operators without exposing source delimiters", () => {
    expect(canonicalOperatorNames("TenneT; Avacon")).toEqual([
      "TenneT TSO GmbH",
      "Avacon Netz GmbH",
    ]);
    expect(formatOperatorNames("TenneT TSO GmbH;Avacon Netz GmbH")).toBe(
      "TenneT TSO GmbH · Avacon Netz GmbH",
    );
    expect(sameOperatorIdentity("TenneT; Avacon", "Avacon Netz GmbH")).toBe(true);
  });
});
