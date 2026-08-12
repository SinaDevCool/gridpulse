import type { FeatureCollection, Point } from "geojson";
import {
  pointCoordinates,
  type PowerFinderCollection,
  type PowerFinderFeature,
} from "./fixture-data";
import { mappedVoltageRelevance } from "./candidate-intelligence";

export type DiscoveryStrategy = "connection" | "balanced" | "energy";

export type DiscoveryParameters = {
  requiredMw: number;
  preferredVoltageKv: number | null;
  maxNodeDistanceKm: number;
  resultCount: 10 | 20;
  strategy: DiscoveryStrategy;
};

export type DiscoveryLocation = {
  id: string;
  name: string;
  coordinates: [number, number];
  score: number;
  gridScore: number;
  energyScore: number;
  node: PowerFinderFeature;
  nodeDistanceKm: number;
  renewableMw: number;
  storageMw: number;
  technologyCount: number;
  landContext: "mapped" | "not_assessed";
  reasons: string[];
};

const weights = {
  connection: { grid: 0.8, energy: 0.2 },
  balanced: { grid: 0.65, energy: 0.35 },
  energy: { grid: 0.5, energy: 0.5 },
} as const;

const round1 = (value: number) => Math.round(value * 10) / 10;

function distanceKm(left: [number, number], right: [number, number]) {
  const radians = Math.PI / 180;
  const latitudeDelta = (right[1] - left[1]) * radians;
  const longitudeDelta = (right[0] - left[0]) * radians;
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(left[1] * radians) * Math.cos(right[1] * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function voltageScore(node: PowerFinderFeature, preferredVoltageKv: number | null) {
  const fit = mappedVoltageRelevance(preferredVoltageKv, node.properties.voltage_kv ?? []);
  return fit === "compatible" ? 100 : fit === "conditional" ? 50 : 25;
}

export function discoverLocations(
  collection: PowerFinderCollection,
  parameters: DiscoveryParameters,
): DiscoveryLocation[] {
  const nodes = collection.features.filter(
    (feature) => feature.properties.kind === "node" && pointCoordinates(feature),
  );
  const land = collection.features.filter(
    (feature) => feature.properties.kind === "industrial_site" && pointCoordinates(feature),
  );
  const energy = collection.features.filter(
    (feature) =>
      ["generation_asset", "storage_asset"].includes(feature.properties.kind) &&
      pointCoordinates(feature),
  );
  const origins = land.length > 0 ? land : nodes;
  const candidates = origins.flatMap((origin) => {
    const coordinates = pointCoordinates(origin);
    if (!coordinates) return [];
    const nearest = nodes
      .map((node) => ({ node, distance: distanceKm(coordinates, pointCoordinates(node)!) }))
      .filter((item) => item.distance <= parameters.maxNodeDistanceKm)
      .sort((left, right) => left.distance - right.distance)[0];
    if (!nearest) return [];
    const nearby = energy.filter((feature) => {
      const position = pointCoordinates(feature);
      return position && distanceKm(coordinates, position) <= 15;
    });
    const renewableMw = nearby
      .filter((feature) => feature.properties.kind === "generation_asset")
      .reduce((sum, feature) => sum + (feature.properties.net_capacity_mw ?? 0), 0);
    const storageMw = nearby
      .filter((feature) => feature.properties.kind === "storage_asset")
      .reduce((sum, feature) => sum + (feature.properties.net_capacity_mw ?? 0), 0);
    const technologies = new Set(
      nearby
        .filter((feature) => feature.properties.kind === "generation_asset")
        .map((feature) => feature.properties.generation_group)
        .filter(Boolean),
    );
    const proximity = Math.max(0, 100 * (1 - nearest.distance / parameters.maxNodeDistanceKm));
    const gridScore =
      voltageScore(nearest.node, parameters.preferredVoltageKv) * 0.55 +
      proximity * 0.3 +
      (nearest.node.properties.operator ? 100 : 40) * 0.15;
    const energyScore =
      Math.min(100, (renewableMw / Math.max(1, parameters.requiredMw)) * 45) +
      Math.min(25, technologies.size * 7) +
      Math.min(15, (storageMw / Math.max(1, parameters.requiredMw)) * 15);
    const profile = weights[parameters.strategy];
    const landBonus = origin.properties.kind === "industrial_site" ? 8 : 0;
    const score = Math.min(
      100,
      gridScore * profile.grid + energyScore * profile.energy + landBonus,
    );
    return [
      {
        id: `discovery-${origin.id}`,
        name:
          origin.properties.kind === "industrial_site"
            ? origin.properties.name
            : `${nearest.node.properties.name} area`,
        coordinates,
        score: round1(score),
        gridScore: round1(gridScore),
        energyScore: round1(energyScore),
        node: nearest.node,
        nodeDistanceKm: round1(nearest.distance),
        renewableMw: round1(renewableMw),
        storageMw: round1(storageMw),
        technologyCount: technologies.size,
        landContext: origin.properties.kind === "industrial_site" ? "mapped" : "not_assessed",
        reasons: [
          `${nearest.node.properties.voltage_kv?.join(" / ") || "Unknown"} kV mapped node ${round1(nearest.distance)} km away.`,
          `${round1(renewableMw)} MW known registered generation within 15 km.`,
          storageMw > 0
            ? `${round1(storageMw)} MW registered storage within 15 km.`
            : "No registered storage detected; developer-supplied storage remains possible.",
        ],
      } satisfies DiscoveryLocation,
    ];
  });

  const selected: DiscoveryLocation[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    if (selected.some((item) => distanceKm(item.coordinates, candidate.coordinates) < 8)) continue;
    selected.push(candidate);
    if (selected.length === parameters.resultCount) break;
  }
  return selected;
}

export function discoveryGeoJson(locations: DiscoveryLocation[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: locations.map((location, index) => ({
      type: "Feature",
      id: location.id,
      geometry: { type: "Point", coordinates: location.coordinates },
      properties: { id: location.id, rank: index + 1, score: location.score },
    })),
  };
}
