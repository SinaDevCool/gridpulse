import type { PowerFinderCollection, PowerFinderKind } from "@/features/power-finder/fixture-data";

export type VisibleLayerCounts = {
  line: number;
  industrial_site: number;
};

export function splitMapCollection(collection: PowerFinderCollection) {
  const featureCollection = (kind: PowerFinderKind) => ({
    type: "FeatureCollection" as const,
    features: collection.features.filter((feature) => feature.properties.kind === kind),
  });
  return {
    nodes: featureCollection("node"),
    lines: featureCollection("line"),
    industrialSites: featureCollection("industrial_site"),
    generationAssets: featureCollection("generation_asset"),
    storageAssets: featureCollection("storage_asset"),
  };
}
