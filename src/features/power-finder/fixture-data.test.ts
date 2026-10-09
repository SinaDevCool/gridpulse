import { describe, expect, it } from "vitest";
import {
  emptyGermanyPowerFinderCollection,
  featureSummary,
  parsePowerFinderCollection,
  type PowerFinderFeature,
} from "./fixture-data";

describe("empty Germany map shell", () => {
  it("mounts independent tile sources without inventing asset evidence", () => {
    const result = emptyGermanyPowerFinderCollection();
    expect(result.features).toEqual([]);
    expect(result.metadata.record_count).toBe(0);
    expect(result.metadata.available_kinds).toEqual([]);
    expect(result.metadata.coverage_status).toBe("unavailable");
    expect(result.metadata.evidence_boundary).toContain("no capacity claim");
  });
});

const collection = {
  type: "FeatureCollection",
  metadata: {
    title: "Fixture",
    source_id: "fixture",
    publisher: "GridPulse",
    licence: "fixture",
    attribution: "fixture",
    published_at: "2026-07-23T00:00:00Z",
    geographic_scope: "Brandenburg",
    freshness: "fixed",
    artifact_sha256: "a".repeat(64),
    record_count: 1,
    evidence_boundary: "Synthetic development fixture.",
  },
  features: [
    {
      type: "Feature",
      id: "node-1",
      properties: {
        kind: "node",
        name: "Node",
        voltage_kv: [110],
        evidence_class: "test_fixture",
        capacity_state: "not_established",
      },
      geometry: { type: "Point", coordinates: [13.3, 52.3] },
    },
  ],
};

describe("Power Finder fixture data", () => {
  it("accepts classified, metadata-matched GeoJSON", () => {
    const parsed = parsePowerFinderCollection(collection);
    expect(parsed.features).toHaveLength(1);
    expect(parsed.features[0].properties.max_voltage_kv).toBe(110);
    expect(featureSummary(parsed.features[0])).toContain("capacity not established");
  });

  it("rejects a mismatched record count", () => {
    expect(() =>
      parsePowerFinderCollection({
        ...collection,
        metadata: { ...collection.metadata, record_count: 2 },
      }),
    ).toThrow(/metadata/);
  });

  it("rejects an unclassified feature", () => {
    expect(() =>
      parsePowerFinderCollection({
        ...collection,
        features: [
          {
            ...collection.features[0],
            properties: { ...collection.features[0].properties, evidence_class: "unknown" },
          },
        ],
      }),
    ).toThrow(/unclassified/);
  });

  it("accepts real open-mapping evidence without treating capacity as known", () => {
    const parsed = parsePowerFinderCollection({
      ...collection,
      features: [
        {
          ...collection.features[0],
          properties: {
            ...collection.features[0].properties,
            evidence_class: "open_mapping",
          },
        },
      ],
    });
    expect(parsed.features[0].properties.evidence_class).toBe("open_mapping");
    expect(featureSummary(parsed.features[0])).toContain("capacity not established");
  });

  it("labels registered asset MW as asset context rather than grid capacity", () => {
    const feature = {
      ...collection.features[0],
      properties: {
        ...collection.features[0].properties,
        kind: "generation_asset",
        evidence_class: "official_regulatory",
        net_capacity_mw: 12.5,
      },
    };
    expect(featureSummary(feature as PowerFinderFeature)).toContain("registered generation");
    expect(featureSummary(feature as PowerFinderFeature)).toContain("not grid capacity");
  });
});
