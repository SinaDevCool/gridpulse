import type { OperationalMeasurement, OperationsAssessment, OperationsInput } from "./contracts";

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

function median(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function percentile(values: number[], probability: number) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * probability))];
}

function meanAbsoluteError(actual: number[], predicted: number[]) {
  return actual.reduce((sum, value, index) => sum + Math.abs(value - predicted[index]), 0) / actual.length;
}

function buildForecast(measurements: OperationalMeasurement[], limit: number) {
  if (measurements.length < 24) return null;
  const values = measurements.map((point) => point.gridImportMw);
  const testSize = Math.max(4, Math.floor(values.length * 0.2));
  const training = values.slice(0, -testSize);
  const actual = values.slice(-testSize);
  const persistencePrediction = actual.map((_, index) => index ? actual[index - 1] : training.at(-1)!);
  const seasonalLag = training.length >= 96 ? Math.min(96, Math.max(4, Math.round(24 * 60 / inferIntervalMinutes(measurements)))) : 0;
  const seasonalPrediction = actual.map((_, index) => {
    const source = training.length + index - seasonalLag;
    return source >= training.length ? actual[source - training.length] : values[Math.max(0, source)];
  });
  const baselineMae = meanAbsoluteError(actual, persistencePrediction);
  const seasonalMae = seasonalLag ? meanAbsoluteError(actual, seasonalPrediction) : Number.POSITIVE_INFINITY;
  const useSeasonal = seasonalMae < baselineMae;
  const accepted = useSeasonal && seasonalMae <= Math.max(0.5, limit * 0.08);
  const residuals = actual.map((value, index) => Math.abs(value - (useSeasonal ? seasonalPrediction[index] : persistencePrediction[index])));
  const error90 = percentile(residuals, 0.9);
  const horizon = Math.min(12, measurements.length);
  const projected = Array.from({ length: horizon }, (_, index) => {
    if (useSeasonal && seasonalLag) return values[Math.max(0, values.length - seasonalLag + index)] ?? values.at(-1)!;
    return values.at(-1)!;
  });
  const peak = Math.max(...projected);
  const exceedance = peak <= limit - error90 ? 5 : peak > limit + error90 ? 95 : Math.round(50 + ((peak - limit) / Math.max(error90, 0.01)) * 45);
  return {
    method: useSeasonal ? "seasonal_naive" as const : "persistence" as const,
    horizonIntervals: horizon,
    peakMw: round(peak),
    exceedanceProbabilityPercent: Math.max(0, Math.min(100, exceedance)),
    maeMw: round(useSeasonal ? seasonalMae : baselineMae),
    baselineMaeMw: round(baselineMae),
    accepted,
    reason: accepted
      ? "The chronological seasonal baseline beat persistence and passed the error gate."
      : "No candidate beat persistence and the publication error gate; monitoring remains available.",
  };
}

function inferIntervalMinutes(measurements: OperationalMeasurement[]) {
  const gaps = measurements.slice(1).map((point, index) =>
    (new Date(point.timestamp).getTime() - new Date(measurements[index].timestamp).getTime()) / 60_000,
  ).filter((gap) => gap > 0);
  return gaps.length ? median(gaps) : 0;
}

export function assessOperations(input: OperationsInput): OperationsAssessment {
  const measurements = [...input.measurements].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const intervalMinutes = inferIntervalMinutes(measurements);
  const values = measurements.map((point) => point.gridImportMw);
  const violationPoints = measurements.filter((point) => point.gridImportMw > input.contractedLimitMw);
  const maximumViolationMw = Math.max(0, ...values.map((value) => value - input.contractedLimitMw));
  const forecast = buildForecast(measurements, input.contractedLimitMw);
  const requiredReductionMw = Math.max(0, (forecast?.accepted ? forecast.peakMw : Math.max(...values)) - input.contractedLimitMw);
  const latest = measurements.at(-1)!;
  const availableBatteryEnergyMwh = input.bess
    ? Math.max(0, input.bess.energyMwh * (((latest.bessSocPercent ?? input.bess.minimumReservePercent) - input.bess.minimumReservePercent) / 100))
    : 0;
  const durationMinutes = Math.max(intervalMinutes || 15, (forecast?.horizonIntervals ?? 1) * (intervalMinutes || 15));
  const batteryEnergyLimitedMw = durationMinutes ? availableBatteryEnergyMwh / (durationMinutes / 60) : 0;
  const bessDischargeMw = round(Math.min(requiredReductionMw, input.bess?.powerMw ?? 0, batteryEnergyLimitedMw));
  const workloadShiftMw = round(Math.min(Math.max(0, requiredReductionMw - bessDischargeMw), latest.shiftableLoadMw ?? 0));
  const residualViolationMw = round(Math.max(0, requiredReductionMw - bessDischargeMw - workloadShiftMw));
  const expectedPeak = forecast?.accepted ? forecast.peakMw : Math.max(...values);
  const expectedCount = intervalMinutes > 0
    ? Math.max(1, Math.round((new Date(measurements.at(-1)!.timestamp).getTime() - new Date(measurements[0].timestamp).getTime()) / (intervalMinutes * 60_000)) + 1)
    : measurements.length;
  return {
    status: "historical",
    sampleCount: measurements.length,
    startAt: measurements[0].timestamp,
    endAt: measurements.at(-1)!.timestamp,
    intervalMinutes: intervalMinutes ? round(intervalMinutes) : null,
    currentImportMw: round(latest.gridImportMw),
    currentHeadroomMw: round(input.contractedLimitMw - latest.gridImportMw),
    peakImportMw: round(Math.max(...values)),
    violationCount: violationPoints.length,
    violationHours: round(violationPoints.length * (intervalMinutes || 0) / 60),
    maximumViolationMw: round(maximumViolationMw),
    p95ImportMw: round(percentile(values, 0.95)),
    dataCompletenessPercent: round(Math.min(100, measurements.length / expectedCount * 100), 1),
    forecast,
    recommendation: requiredReductionMw > 0 ? {
      requiredReductionMw: round(requiredReductionMw),
      bessDischargeMw,
      workloadShiftMw,
      residualViolationMw,
      expectedImportMw: round(expectedPeak - bessDischargeMw - workloadShiftMw),
      durationMinutes: round(durationMinutes),
      feasible: residualViolationMw === 0,
    } : null,
  };
}

export function parseOperationsCsv(text: string): OperationalMeasurement[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("The file must contain a header and at least one data row.");
  const header = lines[0].split(",").map((value) => value.trim().toLowerCase());
  const timestampIndex = header.indexOf("timestamp");
  const importIndex = header.indexOf("grid_import_mw");
  if (timestampIndex < 0 || importIndex < 0) throw new Error("Required columns: timestamp, grid_import_mw.");
  const optional = (name: string) => header.indexOf(name);
  const valueAt = (cells: string[], index: number) => index < 0 || cells[index]?.trim() === "" ? null : Number(cells[index]);
  return lines.slice(1).map((line, row) => {
    const cells = line.split(",");
    const timestamp = new Date(cells[timestampIndex]?.trim());
    const gridImportMw = Number(cells[importIndex]);
    if (!Number.isFinite(timestamp.getTime()) || !Number.isFinite(gridImportMw) || gridImportMw < 0)
      throw new Error(`Invalid timestamp or grid_import_mw on row ${row + 2}.`);
    return {
      timestamp: timestamp.toISOString(), gridImportMw,
      gpuPowerMw: valueAt(cells, optional("gpu_power_mw")),
      itLoadMw: valueAt(cells, optional("it_load_mw")),
      coolingPowerMw: valueAt(cells, optional("cooling_power_mw")),
      bessPowerMw: valueAt(cells, optional("bess_power_mw")),
      bessSocPercent: valueAt(cells, optional("bess_soc_percent")),
      shiftableLoadMw: valueAt(cells, optional("shiftable_load_mw")),
    };
  });
}
