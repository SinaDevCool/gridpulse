import type { ExpressionSpecification } from "maplibre-gl";

export const GENERATION_TECHNOLOGY_CLASSES = [
  { id: "solar", label: "Solar", color: "#facc15", icon: "/assets/energy-icons/solar.svg" },
  { id: "wind", label: "Wind", color: "#38bdf8", icon: "/assets/energy-icons/wind.svg" },
  { id: "biomass", label: "Biomass", color: "#22c55e", icon: "/assets/energy-icons/biomass.svg" },
  { id: "hydro", label: "Hydro", color: "#06b6d4", icon: "/assets/energy-icons/hydro.svg" },
  { id: "geothermal", label: "Geothermal", color: "#f97316", icon: "/assets/energy-icons/geothermal.svg" },
  { id: "nuclear", label: "Nuclear", color: "#f472b6", icon: "/assets/energy-icons/nuclear.svg" },
  { id: "gas", label: "Gas", color: "#a78bfa", icon: "/assets/energy-icons/gas.svg" },
  { id: "fossil_other", label: "Coal, oil & other fossil", color: "#ef4444", icon: "/assets/energy-icons/fossil.svg" },
  { id: "other", label: "Other / unknown", color: "#94a3b8", icon: "/assets/energy-icons/other.svg" },
] as const;

export type GenerationTechnologyId = (typeof GENERATION_TECHNOLOGY_CLASSES)[number]["id"];

export const STORAGE_TECHNOLOGY = {
  id: "storage",
  label: "Registered storage",
  color: "#a855f7",
  icon: "/assets/energy-icons/storage.svg",
} as const;

export const generationIconExpression: ExpressionSpecification = [
  "match",
  ["get", "generation_group"],
  "solar",
  "energy-solar",
  "wind",
  "energy-wind",
  "biomass",
  "energy-biomass",
  "hydro",
  "energy-hydro",
  "geothermal",
  "energy-geothermal",
  "nuclear",
  "energy-nuclear",
  "gas",
  "energy-gas",
  "fossil_other",
  "energy-fossil_other",
  "other",
  "energy-other",
  "energy-other",
];

export const EVIDENCE_CLASSES = [
  { id: "public_source", label: "Observed public", color: "#10b6c7" },
  { id: "derived", label: "Modelled / derived", color: "#f5a300" },
  { id: "operator_confirmed", label: "Operator confirmed", color: "#20b26b" },
] as const;

export const generationColourExpression: ExpressionSpecification = [
  "match",
  ["get", "generation_group"],
  "solar",
  "#facc15",
  "wind",
  "#38bdf8",
  "biomass",
  "#22c55e",
  "hydro",
  "#06b6d4",
  "geothermal",
  "#f97316",
  "nuclear",
  "#f472b6",
  "gas",
  "#a78bfa",
  "fossil_other",
  "#ef4444",
  "other",
  "#94a3b8",
  "#94a3b8",
];

export function generationTechnologyLabel(id: string | null | undefined) {
  return GENERATION_TECHNOLOGY_CLASSES.find((item) => item.id === id)?.label ?? "Other / unknown";
}
