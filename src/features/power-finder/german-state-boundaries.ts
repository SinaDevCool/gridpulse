import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import germanStates from "../../data/german-states.geo.json";
import bremenState from "../../data/bremen-state.geo.json";

type StateFeature = Feature<Polygon | MultiPolygon, { id: string; name: string }>;

const states = germanStates as FeatureCollection<
  Polygon | MultiPolygon,
  StateFeature["properties"]
>;

export const germanStateBoundarySource = {
  title: "German state boundaries",
  url: "https://github.com/isellsoap/deutschlandGeoJSON",
  source: "GeoBasis-DE / BKG 2013; Bremen geometry from OpenStreetMap relation 62718",
  licence: "Data licence Germany - attribution - Version 2.0; ODbL for Bremen geometry",
} as const;

const stateByCode = new Map(
  states.features.map((feature) => [feature.properties.id, feature] as const),
);
stateByCode.set("DE-HB", {
  type: "Feature",
  properties: { id: "DE-HB", name: "Bremen" },
  geometry: bremenState as MultiPolygon,
});

function pointOnSegment(point: [number, number], start: [number, number], end: [number, number]) {
  const cross =
    (point[1] - start[1]) * (end[0] - start[0]) - (point[0] - start[0]) * (end[1] - start[1]);
  if (Math.abs(cross) > 1e-10) return false;
  return (
    point[0] >= Math.min(start[0], end[0]) &&
    point[0] <= Math.max(start[0], end[0]) &&
    point[1] >= Math.min(start[1], end[1]) &&
    point[1] <= Math.max(start[1], end[1])
  );
}

function pointInRing(point: [number, number], ring: number[][]) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index] as [number, number];
    const previousPoint = ring[previous] as [number, number];
    if (pointOnSegment(point, previousPoint, currentPoint)) return true;
    if (
      currentPoint[1] > point[1] !== previousPoint[1] > point[1] &&
      point[0] <
        ((previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1])) /
          (previousPoint[1] - currentPoint[1]) +
          currentPoint[0]
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(point: [number, number], rings: number[][][]) {
  if (!rings[0] || !pointInRing(point, rings[0])) return false;
  return !rings.slice(1).some((hole) => pointInRing(point, hole));
}

export function isPointInGermanState(regionCode: string, point: [number, number]) {
  if (regionCode === "DE") return true;
  const state = stateByCode.get(regionCode);
  if (!state) return false;
  const polygons =
    state.geometry.type === "Polygon" ? [state.geometry.coordinates] : state.geometry.coordinates;
  return polygons.some((polygon) => pointInPolygon(point, polygon));
}

export function germanStateBoundary(regionCode: string): StateFeature | null {
  return stateByCode.get(regionCode) ?? null;
}
