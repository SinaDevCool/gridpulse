import { describe, expect, it } from "vitest";
import { propertyFromFinder } from "../anonymous-workspace/factory";
import { defaultFinderProject } from "../power-finder/finder-project";
import type { AnonymousEnrichmentFinding } from "../anonymous-workspace/schema";
import { mergeEnrichment, reviewEnrichmentFinding } from "./property-enrichment";

function property() {
  return propertyFromFinder(
    { ...defaultFinderProject, name: "Berlin site", latitude: 52.5, longitude: 13.4 },
    [],
  );
}

function finding(propertyId: string): AnonymousEnrichmentFinding {
  return {
    id: "finding-1",
    propertyId,
    source: "bkg_admin",
    category: "municipality",
    fieldPath: "municipality",
    title: "Official municipality",
    displayValue: "Berlin",
    proposedValue: "Berlin",
    status: "proposed",
    confidence: "high",
    method: "point_in_polygon",
    sourceOrganisation: "BKG",
    sourceReference: "11000000",
    sourceUrl: "https://bkg.bund.de",
    licence: "dl-de/by-2-0",
    releaseId: "release-1",
    observedAt: "2026-01-01T00:00:00Z",
    retrievedAt: "2026-08-11T00:00:00Z",
    coverage: "available",
    limitations: ["Not cadastral."],
    reviewedAt: null,
    findingKey: "bkg:municipality:test",
    polarity: "neutral",
    screeningEffect: "supports",
    distanceMetres: null,
    geometryRelation: "contains",
    supersedesFindingId: null,
    automaticallyDerived: true,
  };
}

describe("property enrichment review", () => {
  it("stores proposals without changing property fields", () => {
    const input = property();
    const merged = mergeEnrichment(
      input,
      {
        releaseFingerprint: "hash",
        findings: [finding(input.id)],
        sourceStatus: {
          bkg_admin: "complete",
          osm_context: "unavailable",
          bfn_protected: "unavailable",
          mastr: "unavailable",
          bkg_heavy_rain: "unavailable",
          power_finder: "unavailable",
        },
      },
      "2026-08-11T00:00:00Z",
    );
    expect(merged.municipality).toBeNull();
    expect(merged.enrichmentFindings).toHaveLength(1);
    expect(merged.enrichmentRuns?.[0].status).toBe("partial");
  });

  it("atomically accepts a finding into the property and evidence register", () => {
    const input = property();
    input.enrichmentFindings = [finding(input.id)];
    const accepted = reviewEnrichmentFinding(input, "finding-1", "accept");
    expect(accepted.municipality).toBe("Berlin");
    expect(accepted.enrichmentFindings?.[0].status).toBe("accepted");
    expect(accepted.evidenceRegister?.[0].validationStatus).toBe("validated");
    expect(
      accepted.qualification?.find((item) => item.key === "municipality")?.evidenceIds,
    ).toContain(accepted.evidenceRegister?.[0].id);
  });

  it("rejects without changing the property or adding evidence", () => {
    const input = property();
    input.enrichmentFindings = [finding(input.id)];
    const rejected = reviewEnrichmentFinding(input, "finding-1", "reject");
    expect(rejected.municipality).toBeNull();
    expect(rejected.evidenceRegister).toHaveLength(0);
    expect(rejected.enrichmentFindings?.[0].status).toBe("rejected");
  });

  it("keeps a reviewed finding idempotent when the same release is refreshed", () => {
    const input = property();
    input.enrichmentFindings = [finding(input.id)];
    const accepted = reviewEnrichmentFinding(input, "finding-1", "accept");
    const refreshed = mergeEnrichment(
      accepted,
      {
        releaseFingerprint: "hash",
        findings: [{ ...finding(input.id), id: "finding-2" }],
        sourceStatus: {
          bkg_admin: "complete",
          osm_context: "unavailable",
          bfn_protected: "unavailable",
          mastr: "unavailable",
          bkg_heavy_rain: "unavailable",
          power_finder: "unavailable",
        },
      },
      "2026-08-11T01:00:00Z",
    );
    expect(refreshed.enrichmentFindings).toHaveLength(1);
    expect(refreshed.enrichmentFindings?.[0].status).toBe("accepted");
    expect(refreshed.evidenceRegister).toHaveLength(1);
  });
});
