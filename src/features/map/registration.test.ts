import { describe, expect, it, vi } from "vitest";
import type { Map as MapLibreMap } from "maplibre-gl";
import { addMapLayer, addMapSource } from "./registration";
describe("idempotent map registration", () => {
  it("adds absent identities once and allows a cleared style to be rebuilt", () => {
    const layers = new Set<string>(),
      sources = new Set<string>();
    const addLayer = vi.fn((layer: { id: string }) => layers.add(layer.id));
    const addSource = vi.fn((id: string) => sources.add(id));
    const map = {
      getLayer: (id: string) => layers.has(id),
      getSource: (id: string) => sources.has(id),
      addLayer,
      addSource,
    } as unknown as MapLibreMap;
    for (let i = 0; i < 2; i++) {
      addMapLayer(map, { id: "nodes", type: "circle", source: "nodes" });
      addMapSource(map, "nodes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    expect(addLayer).toHaveBeenCalledTimes(1);
    expect(addSource).toHaveBeenCalledTimes(1);
    layers.clear();
    sources.clear();
    addMapLayer(map, { id: "nodes", type: "circle", source: "nodes" });
    expect(addLayer).toHaveBeenCalledTimes(2);
  });
});
