import { describe, expect, it } from "vitest";
import { defaultFinderProject } from "../power-finder/finder-project";
import type { AnonymousProperty } from "./schema";
import { anonymousPropertyToDecisionRow, projectAnonymousProperty } from "./portfolio-projection";

function property(overrides: Partial<AnonymousProperty> = {}): AnonymousProperty {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    schemaVersion: 2,
    name: "Berlin DC 01",
    externalPropertyId: null,
    project: { ...defaultFinderProject, latitude: 52.5, longitude: 13.4, importMw: 50 },
    boundary: null,
    propertyType: "data_centre",
    propertyCondition: "brownfield",
    requiredItLoadMw: 40,
    requiredTotalSiteLoadMw: 50,
    exportRequirementMw: 0,
    developmentPhase: "screening",
    landControlStatus: "identified",
    municipality: "Berlin",
    siteLabel: null,
    decisionStatus: "unreviewed",
    decisionRationale: null,
    preferredCandidateId: null,
    selectedCandidateIds: [],
    candidateSnapshots: [],
    evidence: null,
    source: "power_finder",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("anonymous portfolio projection", () => {
  it("requires candidate screening when no shortlist exists", () => {
    const summary = projectAnonymousProperty(property());
    expect(summary.stage).toBe("screening");
    expect(summary.nextAction).toMatch(/grid screening/i);
  });
  it("uses the explicitly preferred candidate", () => {
    const candidates = [
      {
        id: "low",
        siteName: "A",
        nodeName: "Node A",
        operator: null,
        voltageKv: [110],
        distanceKm: 2,
        screeningRank: 60,
        evidenceScore: 50,
        missingEvidence: [],
        calculationVersion: "v1",
        capacityState: "not_established",
        evidenceClass: "open_mapping",
        capturedAt: new Date().toISOString(),
      },
      {
        id: "preferred",
        siteName: "B",
        nodeName: "Node B",
        operator: "Operator",
        voltageKv: [110],
        distanceKm: 4,
        screeningRank: 80,
        evidenceScore: 70,
        missingEvidence: [],
        calculationVersion: "v1",
        capacityState: "not_established",
        evidenceClass: "open_mapping",
        capturedAt: new Date().toISOString(),
      },
    ];
    const summary = projectAnonymousProperty(
      property({ candidateSnapshots: candidates, preferredCandidateId: "preferred" }),
    );
    expect(summary.preferredCandidate?.nodeName).toBe("Node B");
    expect(anonymousPropertyToDecisionRow(summary.property).operator_name).toBe("Operator");
  });
  it("never converts unknown capacity into indicated MW", () =>
    expect(anonymousPropertyToDecisionRow(property()).indicated_import_mw).toBeNull());
});
