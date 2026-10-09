import { describe, expect, it } from "vitest";
import { decisionLabels, portfolioStageLabels, portfolioViews } from "./portfolio-status";

describe("unified Sites status definitions", () => {
  it("keeps the three portfolio views and shared workflow labels canonical", () => {
    expect(portfolioViews).toEqual(["pipeline", "readiness", "decisions"]);
    expect(portfolioStageLabels.shortlisted).toBe("Candidate Shortlisted");
    expect(decisionLabels.advance).toBe("Advance");
  });
});
