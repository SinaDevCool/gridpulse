export type IntervalPoint = {
  timestamp: string;
  importMw: number;
  exportMw: number;
  flexibleLoadMw?: number;
  onsiteGenerationMw?: number;
  /** Optional time-varying connection envelope supplied by a benchmark or operator model. */
  connectionLimitMw?: number;
  /** Optional multiplier for a declared firm-plus-conditional envelope. */
  connectionLimitFactor?: number;
};

export type ProfileQuality = {
  valid: boolean;
  intervalMinutes: number;
  duplicateTimestamps: string[];
  missingIntervals: number;
  warnings: string[];
};

export type DispatchSettings = {
  firmImportMw: number;
  conditionalImportMw: number;
  minimumCriticalLoadMw: number;
  shiftableLoadMw: number;
  batteryPowerMw: number;
  batteryEnergyMwh: number;
  batteryRoundTripEfficiency: number;
  batteryMinimumSoc: number;
  initialBatterySoc: number;
  energyValueEurMwh: number;
  batteryDegradationEurMwh: number;
  minimumViableImportMw?: number;
};

export type DispatchInterval = {
  timestamp: string;
  baselineImportMw: number;
  connectionLimitMw: number;
  workloadResponseMw: number;
  batteryResponseMw: number;
  batteryChargeMw: number;
  residualShortfallMw: number;
  batterySocMwh: number;
};

export type DispatchAnalysis = {
  calculationVersion: "de-fca-interval-v3";
  intervalMinutes: number;
  intervalCount: number;
  peakBaselineImportMw: number;
  restrictedIntervals: number;
  restrictedHours: number;
  restrictionEvents: number;
  longestRestrictionHours: number;
  minimumViableBreaches: number;
  maximumShortfallMw: number;
  residualUnservedMwh: number;
  constrainedEnergyMwh: number;
  shiftedWorkloadMwh: number;
  batteryDischargeMwh: number;
  equivalentBatteryCycles: number;
  demandServedPercent: number;
  estimatedAnnualExposureEur: number;
  classification:
    | "operationally_feasible"
    | "feasible_with_constraints"
    | "fails_minimum_viable_capacity"
    | "operator_validation_required";
  timeline: DispatchInterval[];
  warnings: string[];
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
  const flexibleIndex = findColumn(headers, [
    "flexible_load_mw",
    "flexible load mw",
    "shiftable_mw",
  ]);
  const generationIndex = findColumn(headers, [
    "onsite_generation_mw",
    "onsite generation mw",
    "generation_mw",
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
      flexibleLoadMw: flexibleIndex >= 0 ? parseNumber(cells[flexibleIndex]) : undefined,
      onsiteGenerationMw: generationIndex >= 0 ? parseNumber(cells[generationIndex]) : undefined,
    };
  });
  if (points.length > 40_000) throw new Error("Upload at most 40,000 intervals per profile.");
  return [...points].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function validateIntervalProfile(points: IntervalPoint[]): ProfileQuality {
  if (!points.length) throw new Error("The profile contains no intervals.");
  const sorted = [...points].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const duplicates: string[] = [];
  const deltas: number[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const delta =
      (Date.parse(sorted[index].timestamp) - Date.parse(sorted[index - 1].timestamp)) / 60_000;
    if (delta === 0) duplicates.push(sorted[index].timestamp);
    else if (delta > 0) deltas.push(delta);
  }
  const intervalMinutes = deltas.length ? Math.min(...deltas) : 15;
  if (![15, 30, 60].includes(intervalMinutes)) {
    throw new Error("Profiles must use 15, 30, or 60-minute intervals.");
  }
  const missingIntervals = deltas.reduce(
    (total, delta) =>
      total + (delta > intervalMinutes ? Math.round(delta / intervalMinutes) - 1 : 0),
    0,
  );
  const warnings = [
    intervalMinutes !== 15
      ? `${intervalMinutes}-minute data is accepted, but 15-minute data is preferred.`
      : null,
    missingIntervals ? `${missingIntervals} expected intervals are missing.` : null,
    duplicates.length ? `${duplicates.length} duplicate timestamps were found.` : null,
  ].filter((item): item is string => Boolean(item));
  return {
    valid: !duplicates.length && !missingIntervals,
    intervalMinutes,
    duplicateTimestamps: duplicates,
    missingIntervals,
    warnings,
  };
}

export function simulateFlexibleConnection(
  points: IntervalPoint[],
  settings: DispatchSettings,
): DispatchAnalysis {
  const quality = validateIntervalProfile(points);
  if (!quality.valid) throw new Error(quality.warnings.join(" "));
  const duration = quality.intervalMinutes / 60;
  const efficiency = Math.min(1, Math.max(0.01, settings.batteryRoundTripEfficiency));
  const usableBatteryMwh = Math.max(
    0,
    settings.batteryEnergyMwh * (1 - settings.batteryMinimumSoc),
  );
  let batterySocMwh = Math.min(usableBatteryMwh, usableBatteryMwh * settings.initialBatterySoc);
  let restrictedIntervals = 0;
  let maximumShortfallMw = 0;
  let residualUnservedMwh = 0;
  let constrainedEnergyMwh = 0;
  let shiftedWorkloadMwh = 0;
  let batteryDischargeMwh = 0;
  let totalDemandMwh = 0;
  let restrictionEvents = 0;
  let currentRestrictionIntervals = 0;
  let longestRestrictionIntervals = 0;
  let minimumViableBreaches = 0;
  const timeline = points.map((point) => {
    const baselineImportMw = Math.max(0, point.importMw - (point.onsiteGenerationMw ?? 0));
    const connectionLimitMw = Math.max(
      0,
      point.connectionLimitMw ??
        (settings.firmImportMw + settings.conditionalImportMw) *
          Math.max(0, point.connectionLimitFactor ?? 1),
    );
    const grossShortfallMw = Math.max(0, baselineImportMw - connectionLimitMw);
    const declaredShiftableMw = Math.min(
      point.flexibleLoadMw ?? settings.shiftableLoadMw,
      settings.shiftableLoadMw,
    );
    const criticalFloorMw = Math.max(0, baselineImportMw - settings.minimumCriticalLoadMw);
    const workloadResponseMw = Math.min(grossShortfallMw, declaredShiftableMw, criticalFloorMw);
    const afterWorkloadMw = grossShortfallMw - workloadResponseMw;
    const availableBatteryMw = duration ? (batterySocMwh * efficiency) / duration : 0;
    const batteryResponseMw = Math.min(
      afterWorkloadMw,
      settings.batteryPowerMw,
      availableBatteryMw,
    );
    const batteryEnergyUsedMwh = batteryResponseMw * duration;
    batterySocMwh = Math.max(0, batterySocMwh - batteryEnergyUsedMwh / efficiency);
    const connectionHeadroomMw = Math.max(0, connectionLimitMw - baselineImportMw);
    const batteryStorageHeadroomMwh = Math.max(0, usableBatteryMwh - batterySocMwh);
    const batteryChargeMw = Math.min(
      grossShortfallMw > 0 ? 0 : connectionHeadroomMw,
      settings.batteryPowerMw,
      duration ? batteryStorageHeadroomMwh / (duration * efficiency) : 0,
    );
    batterySocMwh = Math.min(
      usableBatteryMwh,
      batterySocMwh + batteryChargeMw * duration * efficiency,
    );
    const residualShortfallMw = Math.max(0, afterWorkloadMw - batteryResponseMw);
    if (grossShortfallMw > 0) {
      restrictedIntervals += 1;
      currentRestrictionIntervals += 1;
      if (currentRestrictionIntervals === 1) restrictionEvents += 1;
      longestRestrictionIntervals = Math.max(
        longestRestrictionIntervals,
        currentRestrictionIntervals,
      );
    } else currentRestrictionIntervals = 0;
    if (
      settings.minimumViableImportMw != null &&
      connectionLimitMw < settings.minimumViableImportMw
    )
      minimumViableBreaches += 1;
    maximumShortfallMw = Math.max(maximumShortfallMw, grossShortfallMw);
    constrainedEnergyMwh += grossShortfallMw * duration;
    shiftedWorkloadMwh += workloadResponseMw * duration;
    batteryDischargeMwh += batteryEnergyUsedMwh;
    residualUnservedMwh += residualShortfallMw * duration;
    totalDemandMwh += baselineImportMw * duration;
    return {
      timestamp: point.timestamp,
      baselineImportMw: round(baselineImportMw),
      connectionLimitMw: round(connectionLimitMw),
      workloadResponseMw: round(workloadResponseMw),
      batteryResponseMw: round(batteryResponseMw),
      batteryChargeMw: round(batteryChargeMw),
      residualShortfallMw: round(residualShortfallMw),
      batterySocMwh: round(batterySocMwh),
    };
  });
  const equivalentBatteryCycles = settings.batteryEnergyMwh
    ? batteryDischargeMwh / settings.batteryEnergyMwh
    : 0;
  const demandServedPercent = totalDemandMwh
    ? ((totalDemandMwh - residualUnservedMwh) / totalDemandMwh) * 100
    : 100;
  const classification =
    minimumViableBreaches > 0
      ? "fails_minimum_viable_capacity"
      : residualUnservedMwh > 0
        ? "feasible_with_constraints"
        : restrictedIntervals > 0
          ? "operator_validation_required"
          : "operationally_feasible";
  return {
    calculationVersion: "de-fca-interval-v3",
    intervalMinutes: quality.intervalMinutes,
    intervalCount: points.length,
    peakBaselineImportMw: round(Math.max(...timeline.map((item) => item.baselineImportMw))),
    restrictedIntervals,
    restrictedHours: round(restrictedIntervals * duration),
    restrictionEvents,
    longestRestrictionHours: round(longestRestrictionIntervals * duration),
    minimumViableBreaches,
    maximumShortfallMw: round(maximumShortfallMw),
    residualUnservedMwh: round(residualUnservedMwh),
    constrainedEnergyMwh: round(constrainedEnergyMwh),
    shiftedWorkloadMwh: round(shiftedWorkloadMwh),
    batteryDischargeMwh: round(batteryDischargeMwh),
    equivalentBatteryCycles: round(equivalentBatteryCycles),
    demandServedPercent: round(demandServedPercent),
    estimatedAnnualExposureEur: round(
      residualUnservedMwh * settings.energyValueEurMwh +
        batteryDischargeMwh * settings.batteryDegradationEurMwh,
    ),
    classification,
    timeline,
    warnings: [
      "Connection limits are declared or operator-supplied inputs; GridPulse does not infer available capacity.",
      settings.conditionalImportMw > 0
        ? "Conditional capacity must be confirmed in a written operator agreement."
        : "No conditional capacity is assumed.",
    ],
  };
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
