import { describe, expect, it } from "vitest";
import {
  candidateEvidenceBoundary,
  rankPublishedCandidates,
  requiredVoltageFit,
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
  it("uses project demand only for indicative voltage fit", () => {
    expect(requiredVoltageFit(100, [110])).toBe("conditional");
    expect(requiredVoltageFit(100, [220])).toBe("compatible");
    expect(requiredVoltageFit(20, [])).toBe("unknown");
  });

  it("ranks stronger nearby evidence without inventing capacity", () => {
    const result = rankPublishedCandidates(collection, 100, 10);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].nodeId).toBe("node-380");
    expect(result.candidates[0].confidence).toBe("medium");
    expect(result.candidates[0].missingEvidence).toContain("available demand capacity");
    expect(result.evidenceBoundary).toBe(candidateEvidenceBoundary);
  });
});
