import { describe, expect, it } from "vitest";
import { layersForExperience, mapLayerRegistry } from "./map-layer-registry";
describe("canonical map layer registry", () => {
  it("has unique ids and one shared constraint layer", () => {
    expect(new Set(mapLayerRegistry.map((item) => item.id)).size).toBe(mapLayerRegistry.length);
    expect(
      layersForExperience("constraint_explorer").filter(
        (item) => item.id === "constraint-exposure",
      ),
    ).toHaveLength(1);
  });
  it("assigns one source, legend, evidence class, and availability policy to every layer", () => {
    for (const layer of mapLayerRegistry) {
      expect(layer.sourceOwner).toBeTruthy();
      expect(layer.legendGroup).toBeTruthy();
      expect(layer.evidenceClass).toBeTruthy();
      expect(layer.availability).toBeTruthy();
    }
    expect(mapLayerRegistry.find((layer) => layer.id === "phase-shifters")?.availability).toBe(
      "operator_only",
    );
  });
});
