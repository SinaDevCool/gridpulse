import type { Geometry } from "geojson";
import type { PowerFinderCollection } from "./fixture-data";
import type { PowerFinderBounds } from "./data-source";

function positions(value: unknown): number[][] {
  if (!Array.isArray(value)) return [];
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number")
    return [value];
  return value.flatMap(positions);
}
function geometryPositions(geometry: Geometry): number[][] {
  return geometry.type === "GeometryCollection"
    ? geometry.geometries.flatMap(geometryPositions)
    : positions(geometry.coordinates);
}

/** Keep only fallback features whose envelope intersects this requested viewport. */
export function scopeFallback(
  collection: PowerFinderCollection,
  bounds: PowerFinderBounds,
): PowerFinderCollection {
  const features = collection.features.filter((feature) => {
    if (!feature.geometry) return false;
    const points = geometryPositions(feature.geometry);
    return (
      points.length > 0 &&
      Math.min(...points.map((p) => p[0])) <= bounds.east &&
      Math.max(...points.map((p) => p[0])) >= bounds.west &&
      Math.min(...points.map((p) => p[1])) <= bounds.north &&
      Math.max(...points.map((p) => p[1])) >= bounds.south
    );
  });
  return {
    ...collection,
    features,
    metadata: {
      ...collection.metadata,
      record_count: features.length,
      kind_counts: undefined,
      available_kinds: [...new Set(features.map((feature) => feature.properties.kind))],
      published_at_basis: "source_release",
      coverage_status: "accepted_static_fallback",
      geographic_scope: "Brandenburg static fallback; features limited to the requested viewport",
      evidence_boundary: `${collection.metadata.evidence_boundary} Static Brandenburg fallback; other regions remain unassessed.`,
    },
  };
}
