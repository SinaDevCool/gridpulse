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
  category: "infrastructure" | "facility" | "generation" | "constraint" | "outage";
  sourceOwner: "power_finder_viewport" | "constraint_exposure" | "operator_context";
  legendGroup: "voltage" | "location" | "technology" | "constraint" | "event";
  evidenceClass: "public_source" | "derived" | "operator_confirmed";
  availability: "available" | "evidence_dependent" | "operator_only";
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
    category: "infrastructure",
    sourceOwner: "power_finder_viewport",
    legendGroup: "voltage",
    evidenceClass: "public_source",
    availability: "available",
    experiences: ["power_finder", "constraint_explorer"],
    minimumZoom: 4,
    defaultVisible: true,
    cluster: false,
    precision: ["exact_published", "regional"],
  },
  {
    id: "grid-nodes",
    label: "Grid nodes",
    category: "infrastructure",
    sourceOwner: "power_finder_viewport",
    legendGroup: "voltage",
    evidenceClass: "public_source",
    availability: "available",
    experiences: ["power_finder", "constraint_explorer"],
    minimumZoom: 7,
    defaultVisible: true,
    cluster: true,
    precision: ["exact_published", "street", "municipality"],
  },
  {
    id: "facilities",
    label: "Published facilities",
    category: "facility",
    sourceOwner: "power_finder_viewport",
    legendGroup: "location",
    evidenceClass: "public_source",
    availability: "available",
    experiences: ["power_finder", "constraint_explorer"],
    minimumZoom: 8,
    defaultVisible: false,
    cluster: true,
    precision: ["exact_published", "street"],
  },
  {
    id: "postcode-areas",
    label: "Postcode-only records",
    category: "facility",
    sourceOwner: "power_finder_viewport",
    legendGroup: "location",
    evidenceClass: "public_source",
    availability: "available",
    experiences: ["power_finder", "constraint_explorer"],
    minimumZoom: 6,
    defaultVisible: false,
    cluster: true,
    precision: ["postcode", "municipality", "regional"],
  },
  {
    id: "registered-generation",
    label: "Registered generation",
    category: "generation",
    sourceOwner: "power_finder_viewport",
    legendGroup: "technology",
    evidenceClass: "public_source",
    availability: "evidence_dependent",
    experiences: ["power_finder"],
    minimumZoom: 6,
    defaultVisible: false,
    cluster: true,
    precision: ["exact_published", "street"],
  },
  {
    id: "registered-storage",
    label: "Registered storage",
    category: "generation",
    sourceOwner: "power_finder_viewport",
    legendGroup: "technology",
    evidenceClass: "public_source",
    availability: "evidence_dependent",
    experiences: ["power_finder"],
    minimumZoom: 6,
    defaultVisible: false,
    cluster: true,
    precision: ["exact_published", "street"],
  },
  {
    id: "operator-territories",
    label: "Operator context",
    category: "infrastructure",
    sourceOwner: "operator_context",
    legendGroup: "location",
    evidenceClass: "public_source",
    availability: "evidence_dependent",
    experiences: ["power_finder", "constraint_explorer"],
    minimumZoom: 4,
    defaultVisible: false,
    cluster: false,
    precision: ["regional"],
  },
  {
    id: "constraint-exposure",
    label: "Constraint exposure",
    category: "constraint",
    sourceOwner: "constraint_exposure",
    legendGroup: "constraint",
    evidenceClass: "derived",
    availability: "evidence_dependent",
    experiences: ["constraint_explorer"],
    minimumZoom: 5,
    defaultVisible: true,
    cluster: false,
    precision: ["exact_published", "street", "postcode", "municipality", "regional"],
  },
  {
    id: "outage-context",
    label: "Outage context",
    category: "outage",
    sourceOwner: "constraint_exposure",
    legendGroup: "event",
    evidenceClass: "public_source",
    availability: "evidence_dependent",
    experiences: ["constraint_explorer"],
    minimumZoom: 6,
    defaultVisible: false,
    cluster: false,
    precision: ["exact_published", "regional"],
  },
  {
    id: "phase-shifters",
    label: "Phase-shifting transformers",
    category: "infrastructure",
    sourceOwner: "constraint_exposure",
    legendGroup: "event",
    evidenceClass: "operator_confirmed",
    availability: "operator_only",
    experiences: ["constraint_explorer"],
    minimumZoom: 8,
    defaultVisible: false,
    cluster: false,
    precision: ["exact_published"],
  },
] as const;

export function layersForExperience(experience: MapExperience) {
  return mapLayerRegistry.filter((layer) => layer.experiences.includes(experience));
}

export function renderLocationAsPoint(precision: LocationPrecision) {
  return precision === "exact_published" || precision === "street";
}
