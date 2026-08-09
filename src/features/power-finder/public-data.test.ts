import { describe, expect, it } from "vitest";
import { toPublicPowerFinderCollection } from "./public-data";
import type { PowerFinderCollection } from "./fixture-data";

describe("public Power Finder data contract", () => {
  it("strips properties outside the public allowlist", () => {
    const collection = {
      type: "FeatureCollection",
      metadata: {
        title: "Test",
        source_id: "test",
        publisher: "Test",
        licence: "Test",
        attribution: "Test",
        published_at: "2026-08-08T00:00:00Z",
        geographic_scope: "Test",
        freshness: "Test",
        artifact_sha256: "test",
        record_count: 1,
        evidence_boundary: "Screening only",
      },
      features: [
        {
          type: "Feature",
          id: "node-1",
          geometry: { type: "Point", coordinates: [13, 52] },
          properties: {
            kind: "node",
            name: "Node 1",
            evidence_class: "open_mapping",
            internal_review_notes: "private",
          },
        },
      ],
    } as unknown as PowerFinderCollection;

    const result = toPublicPowerFinderCollection(collection);
    expect(result.features[0].properties.name).toBe("Node 1");
    expect(result.features[0].properties).not.toHaveProperty("internal_review_notes");
  });
});
