import { describe, expect, it } from "vitest";
import { claimCanBeConfirmed, evidenceReadiness } from "./evidence";
import type { Provenance } from "./domain";

const provenance = (overrides: Partial<Provenance>): Provenance => ({
  evidenceClass: "public_source",
  confidence: "supported",
  validationStatus: "collected",
  sourceEvidenceIds: [],
  assumptions: [],
  limitations: [],
  operatorValidationRequired: true,
  ...overrides,
});

describe("claim provenance", () => {
  it("requires current, validated operator evidence for confirmation", () => {
    expect(
      claimCanBeConfirmed(
        provenance({
          evidenceClass: "operator_confirmed",
          confidence: "confirmed",
          validationStatus: "validated",
        }),
      ),
    ).toBe(true);
    expect(
      claimCanBeConfirmed(
        provenance({
          evidenceClass: "derived",
          confidence: "confirmed",
          validationStatus: "validated",
        }),
      ),
    ).toBe(false);
  });

  it("separates screening readiness from operator-backed decision readiness", () => {
    const result = evidenceReadiness([
      provenance({ evidenceClass: "customer_declared" }),
      provenance({ evidenceClass: "public_source" }),
    ]);
    expect(result.readyForScreening).toBe(true);
    expect(result.readyForDecision).toBe(false);
  });
});
