import { describe, expect, it } from "vitest";
import { extractOperatorFacts, simulateRestrictionEvent } from "./phase5-operator";

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
});
