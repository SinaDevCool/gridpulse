import type { ExpressionSpecification } from "maplibre-gl";

export const GENERATION_TECHNOLOGY_CLASSES = [
  { id: "solar", label: "Solar", color: "#facc15", glyph: "S" },
  { id: "wind", label: "Wind", color: "#38bdf8", glyph: "W" },
  { id: "biomass", label: "Biomass", color: "#22c55e", glyph: "B" },
  { id: "hydro", label: "Hydro", color: "#06b6d4", glyph: "H" },
  { id: "geothermal", label: "Geothermal", color: "#f97316", glyph: "G" },
  { id: "nuclear", label: "Nuclear", color: "#f472b6", glyph: "N" },
  { id: "gas", label: "Gas", color: "#a78bfa", glyph: "G" },
  { id: "fossil_other", label: "Coal, oil & other fossil", color: "#ef4444", glyph: "F" },
  { id: "other", label: "Other / unknown", color: "#94a3b8", glyph: "?" },
] as const;

export type GenerationTechnologyId = (typeof GENERATION_TECHNOLOGY_CLASSES)[number]["id"];

export const STORAGE_TECHNOLOGY = {
  id: "storage",
  label: "Registered storage",
  color: "#a855f7",
  glyph: "E",
} as const;

export const generationGlyphExpression: ExpressionSpecification = [
  "match",
  ["get", "generation_group"],
  "solar",
  "S",
  "wind",
  "W",
  "biomass",
  "B",
  "hydro",
  "H",
  "geothermal",
  "G",
  "nuclear",
  "N",
  "gas",
  "G",
  "fossil_other",
  "F",
  "other",
  "?",
  "?",
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
