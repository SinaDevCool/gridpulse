import { describe, expect, it } from "vitest";
import {
  buildProfileQualityReport,
  rankPilotCandidates,
  simulateOperationsEvent,
  transitionReviewStage,
  type ReviewRecord,
} from "./phase45";

const profile = Array.from({ length: 96 }, (_, index) => ({
  timestamp: new Date(Date.UTC(2027, 0, 1, 0, index * 15)).toISOString(),
  importMw: 50 + (index % 8),
  exportMw: 0,
}));

describe("Phase 4.5 pilot foundation", () => {
  it("produces an inspectable profile quality report", () => {
    const report = buildProfileQualityReport(profile);
    expect(report.intervalMinutes).toBe(15);
    expect(report.intervalCount).toBe(96);
    expect(report.peakImportMw).toBe(57);
    expect(report.unit).toBe("MW");
  });

  it("ranks readiness without presenting unconfirmed capacity", () => {
    const [candidate] = rankPilotCandidates([
      {
        id: "berlin",
        name: "Berlin",
        municipality: "Ludwigsfelde",
        likelyDso: "Unconfirmed",
        likelyTso: "50Hertz",
        targetVoltageKv: 110,
        maturity: 80,
        evidenceCompleteness: 70,
        flexibilityCompatibility: 90,
        operatorEngagement: "contacted",
        capacityEvidence: "declared",
        blockers: [],
      },
    ]);
    expect(candidate.nextAction).toContain("operator confirmation");
    expect(candidate.readinessScore).toBeLessThan(100);
  });

  it("detects a simulated operational exceedance", () => {
    const result = simulateOperationsEvent({
      id: "event-1",
      startsAt: "2027-01-01T12:00:00Z",
      durationMinutes: 60,
      baselineMw: 80,
      networkLimitMw: 50,
      batteryResponseMw: 10,
      workloadResponseMw: 12,
      state: "forecast",
    });
    expect(result.remainingExceedanceMw).toBe(8);
    expect(result.compliant).toBe(false);
  });

  it("blocks operator readiness until expert review is accepted", () => {
    const reviews: ReviewRecord[] = [];
    expect(() => transitionReviewStage("expert_review", "operator_ready", reviews)).toThrow(
      "Grid-expert acceptance",
    );
    reviews.push({
      id: "review-1",
      role: "grid_expert",
      status: "accepted",
      subject: "Connection assumptions",
      note: "Accepted for operator discussion only.",
      createdAt: "2027-01-01T00:00:00Z",
    });
    expect(transitionReviewStage("expert_review", "operator_ready", reviews)).toBe(
      "operator_ready",
    );
  });
});
