import writeXlsxFile from "write-excel-file";

export type ExportableProperty = {
  id: string; name: string; project_type: string; latitude: number; longitude: number;
  requested_import_mw: number; requested_export_mw: number; likely_network_operator: string | null;
  operator_status: string; planning_status: string; land_status: string; assessment_status: string;
  boundary?: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
};

const columns: Array<[keyof ExportableProperty, string]> = [
  ["id", "gridpulse_property_id"], ["name", "property_name"], ["project_type", "property_type"],
  ["latitude", "latitude"], ["longitude", "longitude"], ["requested_import_mw", "required_total_site_load_mw"],
  ["requested_export_mw", "export_requirement_mw"], ["likely_network_operator", "operator_context"],
  ["operator_status", "operator_evidence"], ["planning_status", "planning_status"], ["land_status", "land_control_status"],
  ["assessment_status", "assessment_status"],
];

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url);
}
function csvCell(value: unknown) { const text = value == null ? "" : String(value); return `"${text.replaceAll('"', '""')}"`; }

export function downloadPropertyCsv(properties: ExportableProperty[]) {
  const text = [columns.map(([, label]) => csvCell(label)).join(","), ...properties.map((property) => columns.map(([key]) => csvCell(property[key])).join(","))].join("\n");
  download(new Blob([text], { type: "text/csv;charset=utf-8" }), "gridpulse-property-portfolio.csv");
}

export async function downloadPropertyXlsx(properties: ExportableProperty[]) {
  const data = [
    columns.map(([, label]) => ({ value: label, fontWeight: "bold" as const })),
    ...properties.map((property) => columns.map(([key]) => {
      const value = property[key];
      return { value: value == null ? "" : typeof value === "object" ? JSON.stringify(value) : value };
    })),
  ];
  await writeXlsxFile(data, { fileName: "gridpulse-property-portfolio.xlsx" });
}

export function downloadPropertyGeoJson(properties: ExportableProperty[]) {
  const collection: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: properties.map((property) => ({ type: "Feature", id: property.id, geometry: property.boundary ?? { type: "Point", coordinates: [property.longitude, property.latitude] }, properties: { ...property, boundary: undefined, capacity_boundary: "No capacity value is inferred from this export." } })) };
  download(new Blob([JSON.stringify(collection, null, 2)], { type: "application/geo+json" }), "gridpulse-property-portfolio.geojson");
}
