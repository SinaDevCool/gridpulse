import { describe, expect, it } from "vitest";
import {
  rankCandidatesForLocation,
  candidateEvidenceBoundary,
  highestRankedOpportunityForNode,
  rankPublishedCandidates,
  requiredVoltageFit,
  mappedVoltageRelevance,
  sourceFreshnessScore,
} from "./candidate-intelligence";
import type { PowerFinderCollection } from "./fixture-data";

const collection: PowerFinderCollection = {
  type: "FeatureCollection",
  metadata: {
    title: "Test",
    source_id: "test",
    publisher: "Test",
    licence: "Test",
    attribution: "Test",
    published_at: "2026-07-23",
    geographic_scope: "Test",
    freshness: "Test",
    artifact_sha256: "test",
    record_count: 3,
    evidence_boundary: "Test",
  },
  features: [
    {
      type: "Feature",
      id: "site-a",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [13, 52],
            [13.01, 52],
            [13.01, 52.01],
            [13, 52],
          ],
        ],
      },
      properties: {
        kind: "industrial_site",
        name: "Industrial Site A",
        evidence_class: "open_mapping",
      },
    },
    {
      type: "Feature",
      id: "node-380",
      geometry: { type: "Point", coordinates: [13.02, 52.01] },
      properties: {
        kind: "node",
        name: "Node 380",
        voltage_kv: [380],
        operator: "Operator",
        status: "operational",
        evidence_class: "official_operator",
        capacity_state: "not_established",
      },
    },
    {
      type: "Feature",
      id: "node-20",
      geometry: { type: "Point", coordinates: [13.03, 52.01] },
      properties: {
        kind: "node",
        name: "Node 20",
        voltage_kv: [20],
        evidence_class: "open_mapping",
        capacity_state: "not_established",
      },
    },
  ],
};

describe("Power Finder candidate intelligence", () => {
  it("derives freshness from publication date instead of a fixed score", () => {
    const now = new Date("2026-08-08T00:00:00Z");
    expect(sourceFreshnessScore("2026-08-01T00:00:00Z", now)).toBe(100);
    expect(sourceFreshnessScore("2025-08-01T00:00:00Z", now)).toBe(40);
    expect(sourceFreshnessScore(null, now)).toBe(30);
  });
  it("does not infer voltage compatibility from requested demand", () => {
    expect(requiredVoltageFit(100, [110])).toBe("compatible");
    expect(mappedVoltageRelevance(220, [110])).toBe("conditional");
    expect(mappedVoltageRelevance(110, [110, 20])).toBe("compatible");
    expect(requiredVoltageFit(20, [])).toBe("unknown");
  });

  it("ranks stronger nearby evidence without inventing capacity", () => {
    const result = rankPublishedCandidates(collection, 100, 10);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].nodeId).toBe("node-380");
    expect(result.candidates[0].confidence).toBe("medium");
    expect(result.candidates[0].missingEvidence).toContain("available demand capacity");
    expect(result.evidenceBoundary).toBe(candidateEvidenceBoundary);
    expect(result.candidates[0].provenance?.calculationClass).toBe("heuristic");
    expect(result.candidates[0].rankComponents).toBeDefined();
  });

  it("ranks nodes around a customer-defined site", () => {
    const customCollection: PowerFinderCollection = {
      ...collection,
      metadata: { ...collection.metadata, record_count: 1 },
      features: [collection.features[1]],
    };
    const result = rankCandidatesForLocation(customCollection, 13.01, 52.01, 40, 20);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].siteId).toBe("custom-site");
    expect(result.candidates[0].missingEvidence).toContain("available import capacity");
    expect(result.candidates[0].missingEvidence).toContain("available export capacity");
  });

  it("selects the highest-ranked pathway for a map node independent of list ordering", () => {
    const result = rankPublishedCandidates(collection, 100, 10);
    const lowerRankedDuplicate = {
      ...result.candidates[0],
      id: "alternate-site:node-380",
      siteId: "alternate-site",
      screeningRank: 1,
      distanceKm: 0.1,
    };

    expect(
      highestRankedOpportunityForNode([lowerRankedDuplicate, result.candidates[0]], "node-380")?.id,
    ).toBe(result.candidates[0].id);
    expect(highestRankedOpportunityForNode(result.candidates, "missing-node")).toBeUndefined();
  });
});
