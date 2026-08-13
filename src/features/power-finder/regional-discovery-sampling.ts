import type { PowerFinderCollection } from "./fixture-data";
import type { PowerFinderBounds, PowerFinderDataMode } from "./data-source";

type Sample = { collection: PowerFinderCollection; mode: PowerFinderDataMode };
type Loader = (
  bounds: PowerFinderBounds,
  options: { fallbackAllowed: false; includeRegistryAssets: boolean },
) => Promise<Sample>;

export type RegionalDiscoverySample = Sample & {
  bounds: PowerFinderBounds;
  context: "full" | "grid_only";
};

async function loadBatches(
  bounds: PowerFinderBounds[],
  includeRegistryAssets: boolean,
  loader: Loader,
) {
  const loaded: RegionalDiscoverySample[] = [];
  const failed: PowerFinderBounds[] = [];
  for (let offset = 0; offset < bounds.length; offset += 2) {
    const batchBounds = bounds.slice(offset, offset + 2);
    const batch = await Promise.allSettled(
      batchBounds.map((sampleBounds) =>
        loader(sampleBounds, { fallbackAllowed: false, includeRegistryAssets }),
      ),
    );
    batch.forEach((result, index) => {
      if (result.status === "fulfilled") {
        loaded.push({
          ...result.value,
          bounds: batchBounds[index],
          context: includeRegistryAssets ? "full" : "grid_only",
        });
      } else {
        failed.push(batchBounds[index]);
      }
    });
  }
  return { loaded, failed };
}

export async function loadRegionalDiscoverySamples(bounds: PowerFinderBounds[], loader: Loader) {
  const primary = await loadBatches(bounds, true, loader);
  const retry = await loadBatches(primary.failed, false, loader);
  return {
    samples: [...primary.loaded, ...retry.loaded],
    fullContextCount: primary.loaded.length,
    gridOnlyCount: retry.loaded.length,
    unavailableCount: retry.failed.length,
  };
}
