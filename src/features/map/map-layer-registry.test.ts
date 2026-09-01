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
});
