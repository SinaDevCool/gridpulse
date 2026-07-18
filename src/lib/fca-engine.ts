export type IntervalPoint = {
  timestamp: string;
  importMw: number;
  exportMw: number;
};

export type RestrictionWindow = {
  startHour: number;
  endHour: number;
  weekdays: number[];
  importLimitMw: number | null;
  exportLimitMw: number | null;
};

export type FcaAnalysis = {
  intervalCount: number;
  intervalMinutes: number;
  coveredHours: number;
  restrictedIntervals: number;
  restrictedHours: number;
  requestedImportMwh: number;
  requestedExportMwh: number;
  servedImportMwh: number;
  servedExportMwh: number;
  constrainedImportMwh: number;
  constrainedExportMwh: number;
  estimatedGrossImpactEur: number;
  calculationVersion: "fca-profile-v1";
};

const numberPattern = /^-?\d+(?:[.,]\d+)?$/;

function parseNumber(value: string | undefined) {
  const normalized = (value ?? "").trim().replace(",", ".");
  if (!numberPattern.test(normalized)) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += character;
  }
  cells.push(current.trim());
  return cells;
}

function findColumn(headers: string[], candidates: string[]) {
  return headers.findIndex((header) => candidates.some((candidate) => header.includes(candidate)));
}

export function parseIntervalCsv(csv: string): IntervalPoint[] {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) throw new Error("The CSV needs a header and at least one data row.");
  const delimiter = lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
  const headers = splitCsvLine(lines[0], delimiter).map((header) => header.toLowerCase().trim());
  const timestampIndex = findColumn(headers, [
    "timestamp",
    "datetime",
    "date_time",
    "zeitstempel",
    "datum",
  ]);
  const importIndex = findColumn(headers, [
    "import_mw",
    "import mw",
    "load_mw",
    "bezug_mw",
    "bezug mw",
  ]);
  const exportIndex = findColumn(headers, [
    "export_mw",
    "export mw",
    "generation_mw",
    "einspeisung_mw",
    "einspeisung mw",
  ]);
  if (timestampIndex < 0 || (importIndex < 0 && exportIndex < 0)) {
    throw new Error("Use columns timestamp and at least one of import_mw or export_mw.");
  }
  const points = lines.slice(1).map((line, rowIndex) => {
    const cells = splitCsvLine(line, delimiter);
    const rawTimestamp = cells[timestampIndex];
    const date = new Date(rawTimestamp);
    if (!rawTimestamp || Number.isNaN(date.getTime())) {
      throw new Error(`Row ${rowIndex + 2} has an invalid timestamp.`);
    }
    return {
      timestamp: date.toISOString(),
      importMw: importIndex >= 0 ? parseNumber(cells[importIndex]) : 0,
      exportMw: exportIndex >= 0 ? parseNumber(cells[exportIndex]) : 0,
    };
  });
  if (points.length > 40_000) throw new Error("Upload at most 40,000 intervals per profile.");
  return points.toSorted((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function inferIntervalMinutes(points: IntervalPoint[]) {
  if (points.length < 2) return 15;
  const minutes = (Date.parse(points[1].timestamp) - Date.parse(points[0].timestamp)) / 60_000;
  if (![15, 30, 60].includes(minutes)) {
    throw new Error("Profiles must use consistent 15, 30, or 60-minute intervals.");
  }
  for (let index = 2; index < Math.min(points.length, 200); index += 1) {
    const delta =
      (Date.parse(points[index].timestamp) - Date.parse(points[index - 1].timestamp)) / 60_000;
    if (delta !== minutes)
      throw new Error("The profile contains missing or inconsistent intervals.");
  }
  return minutes;
}

function applies(window: RestrictionWindow | null, date: Date) {
  if (!window) return true;
  const hour = date.getUTCHours();
  const inDay = window.weekdays.length === 0 || window.weekdays.includes(date.getUTCDay());
  const inHour =
    window.startHour <= window.endHour
      ? hour >= window.startHour && hour < window.endHour
      : hour >= window.startHour || hour < window.endHour;
  return inDay && inHour;
}

export function analyseFca(
  points: IntervalPoint[],
  mode: string,
  maxImportMw: number | null,
  maxExportMw: number | null,
  window: RestrictionWindow | null,
  energyValueEurMwh: number,
): FcaAnalysis {
  const intervalMinutes = inferIntervalMinutes(points);
  const duration = intervalMinutes / 60;
  let restrictedIntervals = 0;
  let requestedImportMwh = 0;
  let requestedExportMwh = 0;
  let servedImportMwh = 0;
  let servedExportMwh = 0;
  for (const point of points) {
    const restrictionApplies =
      mode !== "unrestricted" && applies(window, new Date(point.timestamp));
    const importLimit = restrictionApplies && maxImportMw != null ? maxImportMw : point.importMw;
    const exportLimit = restrictionApplies && maxExportMw != null ? maxExportMw : point.exportMw;
    const servedImport = Math.min(point.importMw, importLimit);
    const servedExport = Math.min(point.exportMw, exportLimit);
    if (servedImport < point.importMw || servedExport < point.exportMw) restrictedIntervals += 1;
    requestedImportMwh += point.importMw * duration;
    requestedExportMwh += point.exportMw * duration;
    servedImportMwh += servedImport * duration;
    servedExportMwh += servedExport * duration;
  }
  const constrainedImportMwh = requestedImportMwh - servedImportMwh;
  const constrainedExportMwh = requestedExportMwh - servedExportMwh;
  return {
    intervalCount: points.length,
    intervalMinutes,
    coveredHours: points.length * duration,
    restrictedIntervals,
    restrictedHours: restrictedIntervals * duration,
    requestedImportMwh: round(requestedImportMwh),
    requestedExportMwh: round(requestedExportMwh),
    servedImportMwh: round(servedImportMwh),
    servedExportMwh: round(servedExportMwh),
    constrainedImportMwh: round(constrainedImportMwh),
    constrainedExportMwh: round(constrainedExportMwh),
    estimatedGrossImpactEur: round(
      (constrainedImportMwh + constrainedExportMwh) * energyValueEurMwh,
    ),
    calculationVersion: "fca-profile-v1",
  };
}

export function summarizeProfile(points: IntervalPoint[]) {
  const intervalMinutes = inferIntervalMinutes(points);
  return {
    intervalCount: points.length,
    intervalMinutes,
    periodStart: points[0].timestamp,
    periodEnd: points.at(-1)?.timestamp ?? points[0].timestamp,
    peakImportMw: round(Math.max(...points.map((point) => point.importMw))),
    peakExportMw: round(Math.max(...points.map((point) => point.exportMw))),
  };
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
