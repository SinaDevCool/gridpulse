import { describe, expect, it } from "vitest";
import { discoverLocations } from "./location-discovery";
import { isPointInGermanState } from "./german-state-boundaries";
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
      technology: "Windenergie an Land",
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
      generationGroup: "all",
      minimumGenerationMw: 0,
      minimumStorageMw: 0,
    });
    expect(result.name).toBe("land-a");
    expect(result.generationMw).toBe(120);
    expect(result.technologyCount).toBe(2);
    expect(result.node.properties.capacity_state).toBeUndefined();
  });

  it("recognises both Bremen and Bremerhaven while excluding surrounding Lower Saxony", () => {
    expect(isPointInGermanState("DE-HB", [8.807, 53.075])).toBe(true);
    expect(isPointInGermanState("DE-HB", [8.58, 53.54])).toBe(true);
    expect(isPointInGermanState("DE-HB", [8.63, 53.05])).toBe(false);
    expect(isPointInGermanState("DE-HB", [9.4, 53.1])).toBe(false);
  });

  it("removes otherwise highly ranked origins outside the selected Bundesland", () => {
    const regionalCollection = {
      ...collection,
      features: [
        feature("bremen-land", "industrial_site", [8.807, 53.075]),
        feature("bremen-node", "node", [8.81, 53.075], {
          voltage_kv: [110],
          operator: "Operator",
        }),
        feature("lower-saxony-land", "industrial_site", [8.63, 53.05]),
        feature("lower-saxony-node", "node", [8.631, 53.05], {
          voltage_kv: [110],
          operator: "Operator",
        }),
      ],
    } as PowerFinderCollection;

    const results = discoverLocations(regionalCollection, {
      regionCode: "DE-HB",
      requiredMw: 100,
      preferredVoltageKv: 110,
      maxNodeDistanceKm: 20,
      resultCount: 10,
      strategy: "balanced",
      generationGroup: "all",
      minimumGenerationMw: 0,
      minimumStorageMw: 0,
    });

    expect(results.map((result) => result.name)).toEqual(["bremen-land"]);
    expect(results.every((result) => isPointInGermanState("DE-HB", result.coordinates))).toBe(true);
  });

  it("uses the selected technology and capacity thresholds in the energy score", () => {
    const [allEnergy] = discoverLocations(collection, {
      requiredMw: 100,
      preferredVoltageKv: 110,
      maxNodeDistanceKm: 20,
      resultCount: 10,
      strategy: "energy",
      generationGroup: "all",
      minimumGenerationMw: 0,
      minimumStorageMw: 0,
    });
    const [largeWind] = discoverLocations(collection, {
      requiredMw: 100,
      preferredVoltageKv: 110,
      maxNodeDistanceKm: 20,
      resultCount: 10,
      strategy: "energy",
      generationGroup: "wind",
      minimumGenerationMw: 50,
      minimumStorageMw: 10,
    });

    expect(allEnergy.generationMw).toBe(120);
    expect(largeWind.generationMw).toBe(0);
    expect(largeWind.technologyCount).toBe(0);
    expect(largeWind.energyScore).toBeLessThan(allEnergy.energyScore);
  });

  it("applies load, voltage, distance, strategy and result-count parameters", () => {
    const base = {
      requiredMw: 100,
      preferredVoltageKv: 110,
      maxNodeDistanceKm: 20,
      resultCount: 10 as const,
      strategy: "balanced" as const,
      generationGroup: "all",
      minimumGenerationMw: 0,
      minimumStorageMw: 0,
    };
    const [baseline] = discoverLocations(collection, base);
    const [largerLoad] = discoverLocations(collection, { ...base, requiredMw: 500 });
    const [voltageMismatch] = discoverLocations(collection, {
      ...base,
      preferredVoltageKv: 380,
    });
    const [connectionFirst] = discoverLocations(collection, {
      ...base,
      strategy: "connection",
    });
    const [energyFirst] = discoverLocations(collection, { ...base, strategy: "energy" });

    expect(largerLoad.energyScore).toBeLessThan(baseline.energyScore);
    expect(voltageMismatch.gridScore).toBeLessThan(baseline.gridScore);
    expect(connectionFirst.score).not.toBe(energyFirst.score);
    expect(discoverLocations(collection, { ...base, maxNodeDistanceKm: 0.5 })).toEqual([]);
    expect(discoverLocations(collection, base)).toHaveLength(1);
  });
});
