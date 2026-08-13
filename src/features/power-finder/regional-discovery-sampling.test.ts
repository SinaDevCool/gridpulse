import { describe, expect, it, vi } from "vitest";
import type { PowerFinderCollection } from "./fixture-data";
import { loadRegionalDiscoverySamples } from "./regional-discovery-sampling";

const bounds = [
  { west: 9, south: 48, east: 10, north: 49 },
  { west: 10, south: 48, east: 11, north: 49 },
];
const collection = {
  type: "FeatureCollection",
  features: [],
  metadata: {},
} as unknown as PowerFinderCollection;

describe("regional discovery sampling", () => {
  it("retries unavailable full-context samples with the lighter grid dataset", async () => {
    const loader = vi.fn(async (sampleBounds, options) => {
      if (sampleBounds === bounds[1] && options.includeRegistryAssets) throw new Error("timeout");
      return { collection, mode: "public_database" as const };
    });

    const result = await loadRegionalDiscoverySamples(bounds, loader);

    expect(result).toMatchObject({ fullContextCount: 1, gridOnlyCount: 1, unavailableCount: 0 });
    expect(result.samples.map((sample) => sample.context)).toEqual(["full", "grid_only"]);
    expect(loader).toHaveBeenCalledTimes(3);
    expect(loader).toHaveBeenLastCalledWith(bounds[1], {
      fallbackAllowed: false,
      includeRegistryAssets: false,
    });
  });

  it("reports a sample unavailable only after both attempts fail", async () => {
    const loader = vi.fn(async () => {
      throw new Error("unavailable");
    });

    const result = await loadRegionalDiscoverySamples(bounds, loader);

    expect(result.samples).toHaveLength(0);
    expect(result.unavailableCount).toBe(2);
    expect(loader).toHaveBeenCalledTimes(4);
  });
});
