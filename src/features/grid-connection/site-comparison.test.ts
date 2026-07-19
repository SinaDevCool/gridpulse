import { describe, expect, it } from "vitest";
import type { ProjectSiteCandidate } from "@/lib/assessment-model";
import { assessCandidateDimensions } from "./site-comparison";

const candidate = {
  likely_tso: "50Hertz",
  maturity_score: 60,
  screening_status: "screened",
  infrastructure_context: {
    maturityChecks: [
      { key: "land", ready: true },
      { key: "planning", ready: false },
    ],
  },
} as unknown as ProjectSiteCandidate;

describe("candidate decision dimensions", () => {
  it("keeps dimensions separate rather than creating an opaque total", () => {
    const result = assessCandidateDimensions(candidate, true);
    expect(result.projectMaturity).toBe(60);
    expect(result.evidenceCompleteness).toBe(50);
    expect(result.operatorReadiness).toBe(50);
    expect(result.operationalFit).toBe("tested");
    expect(result.blockers).toEqual(["planning"]);
  });
});
