import { describe, expect, it } from "vitest";
import { propertyFromImport } from "./factory";
import type { AnonymousEnrichmentFinding } from "./schema";
import { deriveScreeningAssessments } from "./screening-assessment";

const property = propertyFromImport(
  {
    sourceRow: 1,
    propertyName: "Test site",
    externalPropertyId: "TEST-1",
    latitude: 52.5,
    longitude: 13.4,
    boundary: null,
    propertyType: "data_centre",
    propertyCondition: null,
    requiredItLoadMw: null,
    requiredTotalSiteLoadMw: 100,
    exportRequirementMw: null,
    developmentPhase: null,
    landControlStatus: "unknown",
    municipality: null,
    siteLabel: null,
    address: null,
    federalState: null,
    cadastralReference: null,
    siteAreaHectares: null,
    developableAreaHectares: null,
    minimumViableLoadMw: null,
    targetEnergisationYear: null,
    confidentialityClassification: "confidential",
    clientOrganisation: null,
    projectOwner: null,
    notes: null,
  },
  "csv",
);

function finding(
  effect: AnonymousEnrichmentFinding["screeningEffect"],
): AnonymousEnrichmentFinding {
  return {
    id: "finding-1",
    propertyId: property.id,
    source: "bfn_protected",
    category: "environment",
    fieldPath: null,
    title: "Protected area screening",
    displayValue: effect === "constraint" ? "Intersection found" : "No mapped intersection",
    proposedValue: effect === "constraint",
    status: "proposed",
    confidence: "high",
    method: "intersection",
    sourceOrganisation: "BfN",
    sourceReference: "release",
    sourceUrl: "https://example.com",
    licence: "DL-DE 2.0",
    releaseId: "release-1",
    observedAt: null,
    retrievedAt: "2026-08-11T00:00:00.000Z",
    coverage: "available",
    limitations: [],
    reviewedAt: null,
    findingKey: `bfn:${effect}`,
    polarity: effect === "constraint" ? "constraint" : "positive",
    screeningEffect: effect,
    distanceMetres: null,
    geometryRelation: "intersects",
    supersedesFindingId: null,
    automaticallyDerived: true,
  };
}

describe("screening assessment rules", () => {
  it("derives a screened state from a covered non-intersection", () => {
    expect(
      deriveScreeningAssessments({ ...property, enrichmentFindings: [finding("supports")] })[0]
        .state,
    ).toBe("screened");
  });

  it("keeps a detected constraint visible", () => {
    expect(
      deriveScreeningAssessments({ ...property, enrichmentFindings: [finding("constraint")] })[0]
        .state,
    ).toBe("constraint_detected");
  });

  it("does not derive a favourable state from unavailable coverage", () => {
    const unavailable = { ...finding("supports"), coverage: "unavailable" as const };
    expect(deriveScreeningAssessments({ ...property, enrichmentFindings: [unavailable] })).toEqual(
      [],
    );
  });
});
