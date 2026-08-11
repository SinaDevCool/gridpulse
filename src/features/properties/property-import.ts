import readXlsxFile from "read-excel-file";

export const propertyImportHeaders = [
  "property_name",
  "external_property_id",
  "latitude",
  "longitude",
  "property_type",
  "property_condition",
  "required_it_load_mw",
  "required_total_site_load_mw",
  "export_requirement_mw",
  "target_energisation_year",
  "development_phase",
  "land_control_status",
  "confidentiality_classification",
  "client_organisation",
  "project_owner",
  "notes",
] as const;

export type PropertyImportValue = {
  propertyName: string;
  externalPropertyId: string | null;
  latitude: number | null;
  longitude: number | null;
  boundary: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  propertyType: string | null;
  propertyCondition: "greenfield" | "brownfield" | "existing" | null;
  requiredItLoadMw: number | null;
  requiredTotalSiteLoadMw: number | null;
  exportRequirementMw: number | null;
  targetEnergisationYear: number | null;
  developmentPhase: string | null;
  landControlStatus: "unknown" | "identified" | "optioned" | "controlled";
  confidentialityClassification: "public" | "internal" | "confidential" | "strictly_confidential";
  clientOrganisation: string | null;
  projectOwner: string | null;
  notes: string | null;
  sourceRow: number;
};

export type PropertyImportRow = {
  value: PropertyImportValue;
  errors: string[];
  duplicateKey: string | null;
};

const conditionValues = new Set(["greenfield", "brownfield", "existing"]);
const landValues = new Set(["unknown", "identified", "optioned", "controlled"]);
const confidentialityValues = new Set([
  "public",
  "internal",
  "confidential",
  "strictly_confidential",
]);

function header(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_|_$/g, "");
}

function nullableText(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

function nullableNumber(value: unknown) {
  if (value == null || String(value).trim() === "") return null;
  const result = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(result) ? result : Number.NaN;
}

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function valueFromRecord(
  record: Record<string, unknown>,
  sourceRow: number,
  geometry: GeoJSON.Geometry | null = null,
): PropertyImportValue {
  const condition = nullableText(record.property_condition)?.toLowerCase() ?? null;
  const land = nullableText(record.land_control_status)?.toLowerCase() ?? "unknown";
  const confidentiality =
    nullableText(record.confidentiality_classification)?.toLowerCase() ?? "confidential";
  const point = geometry?.type === "Point" ? geometry.coordinates : null;
  const boundary =
    geometry?.type === "Polygon" || geometry?.type === "MultiPolygon" ? geometry : null;
  return {
    propertyName: nullableText(record.property_name ?? record.name) ?? "",
    externalPropertyId: nullableText(record.external_property_id),
    latitude: nullableNumber(record.latitude ?? point?.[1]),
    longitude: nullableNumber(record.longitude ?? point?.[0]),
    boundary,
    propertyType: nullableText(record.property_type),
    propertyCondition: conditionValues.has(condition ?? "")
      ? (condition as PropertyImportValue["propertyCondition"])
      : (condition as PropertyImportValue["propertyCondition"]),
    requiredItLoadMw: nullableNumber(record.required_it_load_mw),
    requiredTotalSiteLoadMw: nullableNumber(record.required_total_site_load_mw),
    exportRequirementMw: nullableNumber(record.export_requirement_mw),
    targetEnergisationYear: nullableNumber(record.target_energisation_year),
    developmentPhase: nullableText(record.development_phase),
    landControlStatus: land as PropertyImportValue["landControlStatus"],
    confidentialityClassification:
      confidentiality as PropertyImportValue["confidentialityClassification"],
    clientOrganisation: nullableText(record.client_organisation ?? record.client_organization),
    projectOwner: nullableText(record.project_owner),
    notes: nullableText(record.notes),
    sourceRow,
  };
}

function validate(value: PropertyImportValue): string[] {
  const errors: string[] = [];
  if (value.propertyName.length < 2 || value.propertyName.length > 160)
    errors.push("Property name must contain 2–160 characters.");
  if (value.latitude == null || !Number.isFinite(value.latitude) || value.latitude < 47 || value.latitude > 56)
    errors.push("Latitude must be within Germany (47–56).");
  if (value.longitude == null || !Number.isFinite(value.longitude) || value.longitude < 5 || value.longitude > 16)
    errors.push("Longitude must be within Germany (5–16).");
  for (const [label, number] of [
    ["Required IT load", value.requiredItLoadMw],
    ["Required total site load", value.requiredTotalSiteLoadMw],
    ["Export requirement", value.exportRequirementMw],
  ] as const) {
    if (number != null && (!Number.isFinite(number) || number < 0))
      errors.push(`${label} must be a non-negative number or blank.`);
  }
  if (value.requiredTotalSiteLoadMw == null)
    errors.push("Required total site load is required; unknown is not converted to zero.");
  if (
    value.targetEnergisationYear != null &&
    (!Number.isInteger(value.targetEnergisationYear) ||
      value.targetEnergisationYear < 2020 ||
      value.targetEnergisationYear > 2200)
  )
    errors.push("Target energisation year must be a 4-digit year.");
  if (value.propertyCondition && !conditionValues.has(value.propertyCondition))
    errors.push("Property condition must be greenfield, brownfield, existing, or blank.");
  if (!landValues.has(value.landControlStatus)) errors.push("Land-control status is invalid.");
  if (!confidentialityValues.has(value.confidentialityClassification))
    errors.push("Confidentiality classification is invalid.");
  return errors;
}

function finalize(values: PropertyImportValue[]): PropertyImportRow[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.externalPropertyId?.toLocaleLowerCase() ?? null;
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return values.map((value) => {
    const duplicateKey = value.externalPropertyId?.toLocaleLowerCase() ?? null;
    const errors = validate(value);
    if (duplicateKey && (counts.get(duplicateKey) ?? 0) > 1)
      errors.push(`Duplicate external property ID: ${value.externalPropertyId}.`);
    return { value, errors, duplicateKey };
  });
}

export async function parsePropertyImport(file: File): Promise<PropertyImportRow[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "geojson" || extension === "json") {
    const payload = JSON.parse(await file.text()) as GeoJSON.FeatureCollection | GeoJSON.Feature;
    const features = payload.type === "FeatureCollection" ? payload.features : [payload];
    if (features.length < 1 || features.length > 100)
      throw new Error("Import 1–100 GeoJSON features at a time.");
    return finalize(
      features.map((feature, index) =>
        valueFromRecord((feature.properties ?? {}) as Record<string, unknown>, index + 1, feature.geometry),
      ),
    );
  }
  const rows = extension === "xlsx" ? await readXlsxFile(file) : csvRows(await file.text());
  if (!['csv', 'xlsx'].includes(extension ?? '')) throw new Error("Upload CSV, XLSX, or GeoJSON.");
  if (rows.length < 2) throw new Error("The import needs a header and at least 1 property row.");
  if (rows.length > 101) throw new Error("Import no more than 100 properties at a time.");
  const headers = rows[0].map(header);
  const values = rows.slice(1).map((row, index) => {
    const record = Object.fromEntries(headers.map((key, column) => [key, row[column]]));
    return valueFromRecord(record, index + 2);
  });
  return finalize(values);
}

export function propertyImportTemplateCsv() {
  return `${propertyImportHeaders.join(",")}\nExample property,EXT-001,52.5200,13.4050,data_centre,brownfield,40,55,0,2030,site_selection,optioned,confidential,Example client,owner@example.com,Replace this row\n`;
}
