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

  it("keeps the published generation colour group", () => {
    const collection = {
      type: "FeatureCollection",
      metadata: {
        title: "Generation",
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
          id: "generation-1",
          geometry: { type: "Point", coordinates: [13, 52] },
          properties: {
            kind: "generation_asset",
            name: "Wind asset",
            evidence_class: "official_regulatory",
            technology: "Wind",
            generation_group: "wind",
          },
        },
      ],
    } as PowerFinderCollection;

    expect(toPublicPowerFinderCollection(collection).features[0].properties.generation_group).toBe(
      "wind",
    );
  });

  it("preserves coverage status so unavailable registry data is not presented as zero", () => {
    const collection = {
      type: "FeatureCollection",
      metadata: {
        title: "Fallback",
        source_id: "test",
        publisher: "Test",
        licence: "Test",
        attribution: "Test",
        published_at: "2026-08-08T00:00:00Z",
        geographic_scope: "Test",
        freshness: "Test",
        artifact_sha256: "test",
        record_count: 0,
        available_kinds: ["node"],
        coverage_status: "accepted_static_fallback",
        evidence_boundary: "Screening only",
      },
      features: [],
    } as PowerFinderCollection;

    expect(toPublicPowerFinderCollection(collection).metadata.coverage_status).toBe(
      "accepted_static_fallback",
    );
  });
});
