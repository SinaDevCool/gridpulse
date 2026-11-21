import { describe, expect, it } from "vitest";
import type { LocalCapacityEvidence } from "./schema";
import {
  isAcceptedLocalCapacityEvidence,
  localCapacityState,
  localEvidenceGaps,
} from "./local-evidence-state";

const evidence = (overrides: Partial<LocalCapacityEvidence> = {}): LocalCapacityEvidence => ({
  status: "validated",
  validationStatus: "validated",
  evidenceClass: "operator_response",
  n0CapacityMw: 80,
  n1FirmCapacityMw: 60,
  flexibleCapacityMw: null,
  bessAssistedCapacityMw: null,
  modelVersion: null,
  studyVersion: null,
  validFrom: null,
  validTo: "2099-01-01T00:00:00.000Z",
  assumptions: [],
  unresolvedEvidence: [],
  claimsAndLimitations: [],
  ...overrides,
});

describe("local evidence state", () => {
  it("accepts only current validated evidence", () =>
    expect(isAcceptedLocalCapacityEvidence(evidence())).toBe(true));
  it("accepts a current calculated result after validation", () =>
    expect(isAcceptedLocalCapacityEvidence(evidence({ status: "calculated" }))).toBe(true));
  it("marks past evidence stale and exposes the validity gap", () => {
    const item = evidence({ validTo: "2000-01-01T00:00:00.000Z" });
    expect(localCapacityState(item)).toBe("stale");
    expect(localEvidenceGaps(item)).toContain(
      "Capacity evidence is outside its valid period or has an invalid validity date",
    );
  });
  it.each([
    { validFrom: "2099-01-01" },
    { validTo: "invalid" },
    { validFrom: "invalid" },
    { validFrom: "2026-12-01", validTo: "2026-01-01" },
  ])("does not accept invalid or not-yet-current validity windows: %j", (dates) => {
    expect(isAcceptedLocalCapacityEvidence(evidence(dates), new Date("2026-11-21T00:00:00Z"))).toBe(
      false,
    );
  });
  it("keeps absent evidence unknown", () => expect(localCapacityState(null)).toBe("unknown"));
});
