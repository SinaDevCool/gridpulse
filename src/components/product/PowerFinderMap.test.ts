import { describe, expect, it } from "vitest";
import { splitMapCollection } from "./power-finder-map-data";
import type { PowerFinderCollection, PowerFinderKind } from "@/features/power-finder/fixture-data";

function collectionWithKinds(kinds: PowerFinderKind[]): PowerFinderCollection {
  return {
    type: "FeatureCollection",
    metadata: {
      title: "test",
      source_id: "test",
      publisher: "test",
      licence: "test",
      attribution: "test",
      published_at: "2026-01-01",
      geographic_scope: "test",
      freshness: "test",
      artifact_sha256: "test",
      record_count: kinds.length,
      evidence_boundary: "test",
    },
    features: kinds.map((kind, index) => ({
      type: "Feature",
      id: `${kind}-${index}`,
      properties: { kind, name: kind, evidence_class: "open_mapping" },
      geometry:
        kind === "line"
          ? {
              type: "LineString",
              coordinates: [
                [13, 52],
                [14, 53],
              ],
            }
          : kind === "industrial_site"
            ? {
                type: "Polygon",
                coordinates: [
                  [
                    [13, 52],
                    [14, 52],
                    [14, 53],
                    [13, 52],
                  ],
                ],
              }
            : { type: "Point", coordinates: [13, 52] },
    })),
  };
}

describe("splitMapCollection", () => {
  it("keeps non-point geometry out of the clustered node source", () => {
    const split = splitMapCollection(
      collectionWithKinds(["node", "line", "industrial_site", "generation_asset", "storage_asset"]),
    );

    expect(split.nodes.features.map((feature) => feature.properties.kind)).toEqual(["node"]);
    expect(split.lines.features.map((feature) => feature.geometry.type)).toEqual(["LineString"]);
    expect(split.industrialSites.features.map((feature) => feature.geometry.type)).toEqual([
      "Polygon",
    ]);
    expect(split.generationAssets.features).toHaveLength(1);
    expect(split.storageAssets.features).toHaveLength(1);
  });
});
