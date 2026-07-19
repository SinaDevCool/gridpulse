import readXlsxFile from "read-excel-file";
import { parseIntervalCsv, type IntervalPoint } from "../../lib/fca-engine";

function normalizedHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, "_");
}

function numeric(value: unknown, scale: number) {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric value: ${String(value)}`);
  return parsed * scale;
}

export async function importIntervalFile(file: File, declaredUnit: "MW" | "kW" = "MW") {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") return parseIntervalCsv(await file.text());
  if (extension !== "xlsx") throw new Error("Upload a CSV or XLSX interval profile.");
  const rows = await readXlsxFile(file);
  if (rows.length < 2) throw new Error("The XLSX file needs a header and at least one data row.");
  const headers = rows[0].map(normalizedHeader);
  const timestampIndex = headers.findIndex((value) =>
    ["timestamp", "datetime", "date_time"].includes(value),
  );
  const importIndex = headers.findIndex((value) =>
    ["import_mw", "import_kw", "load_mw", "load_kw"].includes(value),
  );
  const exportIndex = headers.findIndex((value) =>
    ["export_mw", "export_kw", "generation_mw", "generation_kw"].includes(value),
  );
  const flexibleIndex = headers.findIndex((value) =>
    ["flexible_load_mw", "flexible_load_kw", "shiftable_mw"].includes(value),
  );
  if (timestampIndex < 0 || (importIndex < 0 && exportIndex < 0)) {
    throw new Error("Map timestamp and at least one import/load or export/generation column.");
  }
  const inferredKw = headers.some((header) => header.endsWith("_kw"));
  const scale = inferredKw || declaredUnit === "kW" ? 0.001 : 1;
  return rows.slice(1).map((row, index): IntervalPoint => {
    const rawTimestamp = row[timestampIndex];
    const date = rawTimestamp instanceof Date ? rawTimestamp : new Date(String(rawTimestamp));
    if (Number.isNaN(date.getTime())) throw new Error(`Row ${index + 2} has an invalid timestamp.`);
    return {
      timestamp: date.toISOString(),
      importMw: importIndex >= 0 ? numeric(row[importIndex], scale) : 0,
      exportMw: exportIndex >= 0 ? numeric(row[exportIndex], scale) : 0,
      flexibleLoadMw: flexibleIndex >= 0 ? numeric(row[flexibleIndex], scale) : undefined,
    };
  });
}
