import type {
  PowerFinderCollection,
  PowerFinderKind,
} from "./fixture-data";

export type LayerAvailability = {
  kind: PowerFinderKind;
  available: boolean;
  total: number;
  reason: "available" | "not_in_release" | "empty_release";
  explanation: string;
};

export function layerAvailability(
  collection: PowerFinderCollection,
  kind: PowerFinderKind,
): LayerAvailability {
  const total = collection.features.filter((feature) => feature.properties.kind === kind).length;
  const declared = collection.metadata.available_kinds?.includes(kind);
  const declaredCount = collection.metadata.kind_counts?.[kind];
  if (declared === false || (declared === undefined && total === 0 && declaredCount === undefined)) {
    return {
      kind,
      available: false,
      total: 0,
      reason: "not_in_release",
      explanation: `${kindLabel(kind)} is not included in this accepted data release.`,
    };
  }
  if (total === 0) {
    return {
      kind,
      available: true,
      total: 0,
      reason: "empty_release",
      explanation: `${kindLabel(kind)} is included, but this response contains no records in the current viewport.`,
    };
  }
  return {
    kind,
    available: true,
    total,
    reason: "available",
    explanation: `${total} ${kindLabel(kind).toLocaleLowerCase()} records loaded.`,
  };
}

function kindLabel(kind: PowerFinderKind) {
  return {
    node: "Grid nodes",
    line: "Grid lines",
    industrial_site: "Industrial sites",
    generation_asset: "Registered generation",
    storage_asset: "Registered storage",
  }[kind];
}
