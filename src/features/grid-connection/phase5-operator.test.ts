import { describe, expect, it } from "vitest";
import {
  compareOperatorFacts,
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
});
