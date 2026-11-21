import { z } from "zod";
import { isFinderMvp } from "../../config/product-mode";
const safeNumber = (minimum: number, maximum: number) =>
  z.coerce.number().min(minimum).max(maximum).optional().catch(undefined);
export const finderSearchSchema = z.object({
  site: z.enum(["none"]).optional().catch(undefined),
  q: z.string().max(160).optional().catch(undefined),
  voltage: z.coerce
    .number()
    .refine((value) => [0, 20, 110, 220, 380].includes(value))
    .optional()
    .catch(undefined),
  operator: z.string().max(160).optional().catch(undefined),
  tso: z.string().max(160).optional().catch(undefined),
  dso: z.string().max(160).optional().catch(undefined),
  sort: z.enum(["context", "voltage", "name", "distance", "operator"]).optional().catch(undefined),
  resultsView: z.enum(["cards", "table", "assets"]).optional().catch(undefined),
  tableColumns: z
    .string()
    .max(160)
    .regex(
      /^(voltage|distance|operator|fit|capacity)(,(voltage|distance|operator|fit|capacity))*$|^none$/,
    )
    .optional()
    .catch(undefined),
  generationGroup: z
    .string()
    .regex(/^(all|solar|wind|biomass|hydro|geothermal|nuclear|gas|fossil_other|other)$/)
    .optional()
    .catch(undefined),
  assetKind: z
    .enum(["node", "line", "industrial_site", "generation_asset", "storage_asset"])
    .optional()
    .catch(undefined),
  assetMissing: z.enum(["voltage", "operator", "rating"]).optional().catch(undefined),
  assetEvidence: z
    .enum(["official_operator", "official_regulatory", "official_public", "open_mapping"])
    .optional()
    .catch(undefined),
  discoveryStrategy: z.enum(["connection", "balanced", "energy"]).optional().catch(undefined),
  discoveryCount: z.coerce
    .number()
    .refine((v) => v === 10 || v === 20)
    .optional()
    .catch(undefined),
  mapArea: z
    .string()
    .max(120)
    .refine((value) => {
      const a = value.split(",").map(Number);
      return (
        a.length === 4 &&
        a.every(Number.isFinite) &&
        a[0] >= 5 &&
        a[2] <= 16 &&
        a[1] >= 47 &&
        a[3] <= 56 &&
        a[0] < a[2] &&
        a[1] < a[3]
      );
    })
    .optional()
    .catch(undefined),
  layers: z
    .string()
    .max(100)
    .regex(
      /^(node|line|industrial_site|generation_asset|storage_asset)(,(node|line|industrial_site|generation_asset|storage_asset))*$|^none$/,
    )
    .optional()
    .catch(undefined),
  workflow: z.enum(["screen", "discover"]).optional().catch(undefined),
  mw: safeNumber(0.1, 1000),
  distance: safeNumber(1, 100),
  candidate: z.string().max(200).optional().catch(undefined),
  compare: z.string().max(700).optional().catch(undefined),
  region: z
    .enum([
      "DE",
      "DE-BB",
      "DE-BW",
      "DE-BY",
      "DE-BE",
      "DE-HB",
      "DE-HH",
      "DE-HE",
      "DE-MV",
      "DE-NI",
      "DE-NW",
      "DE-RP",
      "DE-SL",
      "DE-SN",
      "DE-ST",
      "DE-SH",
      "DE-TH",
    ])
    .optional()
    .catch(undefined),
  mapMode: z
    .enum(["voltage", "evidence", "capacity"])
    .optional()
    .catch(undefined)
    .transform((value) => (isFinderMvp() && value === "capacity" ? ("voltage" as const) : value)),
  mapView: z.enum(["connection", "infrastructure", "generation"]).optional().catch(undefined),
  isolateVoltage: z
    .enum(["ehv", "220kv", "110kv", "distribution", "unknown"])
    .optional()
    .catch(undefined),
  isolateTechnology: z
    .enum([
      "solar",
      "wind",
      "biomass",
      "hydro",
      "geothermal",
      "nuclear",
      "gas",
      "fossil_other",
      "other",
      "storage",
    ])
    .optional()
    .catch(undefined),
  generationMinMw: safeNumber(0, 100_000),
  generationMaxMw: safeNumber(0, 100_000),
  storageMinMw: safeNumber(0, 100_000),
  storageMaxMw: safeNumber(0, 100_000),
  capacitySource: z
    .enum(["reference", "private", "demo", "berlin_synthetic"])
    .optional()
    .catch(undefined),
  capacityMetric: z
    .enum([
      "n0_import_mw",
      "firm_import_mw",
      "flexible_import_mw",
      "bess_assisted_import_mw",
      "staged_initial_import_mw",
      "eventual_import_mw",
    ])
    .optional()
    .catch(undefined),
  requiredMw: safeNumber(0.1, 1000),
  workspaceId: z.string().uuid().optional().catch(undefined),
  study: z.enum(["activation"]).optional().catch(undefined),
  studyTab: z
    .enum(["geographic", "overview", "topology", "hourly", "options", "commercial", "evidence"])
    .optional()
    .catch(undefined),
  lat: safeNumber(47, 56),
  lng: safeNumber(5, 16),
  projectType: z
    .enum([
      "data_centre",
      "industrial_load",
      "battery_storage",
      "co_location",
      "electrolyser",
      "charging_hub",
    ])
    .optional()
    .catch(undefined),
  exportMw: safeNumber(0, 1000),
  flexibleMw: safeNumber(0, 1000),
  batteryMw: safeNumber(0, 1000),
  batteryMwh: safeNumber(0, 20_000),
  preferredVoltage: z.coerce
    .number()
    .refine((value) => [0, 20, 110, 220, 380].includes(value))
    .optional()
    .catch(undefined),
  propertyId: z.string().uuid().optional().catch(undefined),
});
export type FinderSearch = z.infer<typeof finderSearchSchema>;
