export type MapExperience = "power_finder" | "constraint_explorer";
export type LocationPrecision =
  | "exact_published"
  | "street"
  | "postcode"
  | "municipality"
  | "regional"
  | "unknown";

export type MapLayerDefinition = {
  id: string;
  label: string;
  experiences: MapExperience[];
  minimumZoom: number;
  defaultVisible: boolean;
  cluster: boolean;
  precision: LocationPrecision[];
};

export const mapLayerRegistry: readonly MapLayerDefinition[] = [
  {
    id: "grid-lines",
    label: "Grid lines",
    experiences: ["power_finder", "constraint_explorer"],
    minimumZoom: 4,
    defaultVisible: true,
    cluster: false,
    precision: ["exact_published", "regional"],
  },
  {
    id: "grid-nodes",
    label: "Grid nodes",
    experiences: ["power_finder", "constraint_explorer"],
    minimumZoom: 7,
    defaultVisible: true,
    cluster: true,
    precision: ["exact_published", "street", "municipality"],
  },
  {
    id: "facilities",
    label: "Published facilities",
    experiences: ["power_finder"],
    minimumZoom: 8,
    defaultVisible: false,
    cluster: true,
    precision: ["exact_published", "street"],
  },
  {
    id: "postcode-areas",
    label: "Postcode-only records",
    experiences: ["power_finder"],
    minimumZoom: 6,
    defaultVisible: false,
    cluster: true,
    precision: ["postcode", "municipality", "regional"],
  },
  {
    id: "operator-territories",
    label: "Operator context",
    experiences: ["power_finder", "constraint_explorer"],
    minimumZoom: 4,
    defaultVisible: false,
    cluster: false,
    precision: ["regional"],
  },
  {
    id: "constraint-exposure",
    label: "Constraint exposure",
    experiences: ["constraint_explorer"],
    minimumZoom: 5,
    defaultVisible: true,
    cluster: false,
    precision: ["exact_published", "street", "postcode", "municipality", "regional"],
  },
] as const;

export function layersForExperience(experience: MapExperience) {
  return mapLayerRegistry.filter((layer) => layer.experiences.includes(experience));
}

export function renderLocationAsPoint(precision: LocationPrecision) {
  return precision === "exact_published" || precision === "street";
}
