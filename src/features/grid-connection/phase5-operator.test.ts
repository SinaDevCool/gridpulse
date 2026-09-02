import { describe, expect, it } from "vitest";
import {
  compareOperatorFacts,
  buildRelease5Acceptance,
  extractOperatorFacts,
  simulateRestrictionEvent,
} from "./phase5-operator";

describe("Phase 5 operator engagement", () => {
  it("highlights German operator terms without confirming them", () => {
    const result = extractOperatorFacts(
      "Dynamische Bezugsleistung 42,5 MW. Vorlauf 15 Minuten. Schutzkonzept und Telemetrie erforderlich.",
    );
    expect(result.importLimitMw).toBe(42.5);
    expect(result.flexibilityMode).toBe("dynamic");
    expect(result.noticeMinutes).toBe(15);
    expect(result.studyRequirements).toContain("Protection coordination");
    expect(result.warnings[0]).toContain("draft only");
  });

  it("extracts validity scope without treating it as confirmed", () => {
    const result = extractOperatorFacts("Gültig 01.09.2026 bis 31.08.2027. Maximum import 42 MW.");
    expect(result.validFrom).toBe("2026-09-01");
    expect(result.validTo).toBe("2027-08-31");
    expect(result.warnings[0]).toContain("draft only");
  });

  it("rejects invalid restriction and declaration values", () => {
    expect(() =>
      simulateRestrictionEvent({
        baselineMw: Number.NaN,
        networkLimitMw: 20,
        batteryResponseMw: 1,
        workloadResponseMw: 1,
      }),
    ).toThrow("finite and non-negative");
    expect(() =>
      compareOperatorFacts(extractOperatorFacts("Import 10 MW"), {
        requestedImportMw: -1,
        requestedExportMw: 0,
      }),
    ).toThrow("finite and non-negative");
  });

  it("reports residual exposure in a restriction rehearsal", () => {
    expect(
      simulateRestrictionEvent({
        baselineMw: 70,
        networkLimitMw: 50,
        batteryResponseMw: 8,
        workloadResponseMw: 7,
      }),
    ).toMatchObject({
      requiredReductionMw: 20,
      deliveredReductionMw: 15,
      residualMw: 5,
      compliant: false,
    });
  });

  it("preserves discrepancies instead of replacing declared values", () => {
    const facts = extractOperatorFacts("Maximum import 60 MW. Export 0 MW. Notice 30 minutes.");
    const comparison = compareOperatorFacts(facts, {
      requestedImportMw: 100,
      requestedExportMw: 0,
      notificationLeadMinutes: 30,
    });
    expect(comparison.map((item) => item.status)).toEqual(["conflict", "confirmed", "confirmed"]);
    expect(comparison[0].action).toContain("do not overwrite");
  });

  it("passes the governed Release 5 rehearsal without creating a capacity claim", () => {
    const result = buildRelease5Acceptance();
    expect(result.all_repository_gates_passed).toBe(true);
    expect(result.benchmark.discrepancy_statuses.import_limit_mw).toBe("conflict");
    expect(result.benchmark.restriction_rehearsal.residual_mw).toBe(3.5);
    expect(result.controls.operator_confirmation_created).toBe(false);
    expect(result.controls.display_as_capacity).toBe(false);
  });
});
