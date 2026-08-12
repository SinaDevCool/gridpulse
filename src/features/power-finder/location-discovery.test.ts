import { describe, expect, it } from "vitest";
import { discoverLocations } from "./location-discovery";
import type { PowerFinderCollection, PowerFinderFeature } from "./fixture-data";

const feature = (
  id: string,
  kind: PowerFinderFeature["properties"]["kind"],
  coordinates: [number, number],
  properties = {},
) => ({
  type: "Feature" as const,
  id,
  geometry: { type: "Point" as const, coordinates },
  properties: { kind, name: id, evidence_class: "open_mapping" as const, ...properties },
});
const collection = {
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
    record_count: 4,
    evidence_boundary: "test",
  },
  features: [
    feature("land-a", "industrial_site", [13, 52]),
    feature("node-a", "node", [13.01, 52], { voltage_kv: [110], operator: "Operator" }),
    feature("solar", "generation_asset", [13.02, 52], {
      generation_group: "solar",
      net_capacity_mw: 80,
    }),
    feature("wind", "generation_asset", [13.03, 52], {
      generation_group: "wind",
      net_capacity_mw: 40,
    }),
  ],
} as PowerFinderCollection;

describe("regional location discovery", () => {
  it("ranks mapped land against nearby grid and energy context without claiming capacity", () => {
    const [result] = discoverLocations(collection, {
      requiredMw: 100,
      preferredVoltageKv: 110,
      maxNodeDistanceKm: 20,
      resultCount: 10,
      strategy: "balanced",
    });
    expect(result.name).toBe("land-a");
    expect(result.renewableMw).toBe(120);
    expect(result.technologyCount).toBe(2);
    expect(result.node.properties.capacity_state).toBeUndefined();
  });
});
