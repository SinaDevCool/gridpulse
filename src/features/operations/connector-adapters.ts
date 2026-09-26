import { computeWorkloadSchema, type ComputeWorkload } from "./workload-intelligence";

export type ConnectorMeasurement = {
  metricKey:
    | "facility_grid_import_mw"
    | "gpu_power_mw"
    | "gpu_utilization_percent"
    | "bess_power_mw"
    | "bess_soc_percent";
  assetId: string;
  eventAt: string;
  intervalSeconds: number | null;
  value: number;
  unit: string;
  sourceRecordId: string;
};

const dcgmMetrics: Record<
  string,
  { metricKey: ConnectorMeasurement["metricKey"]; scale: number; unit: string }
> = {
  DCGM_FI_DEV_POWER_USAGE: { metricKey: "gpu_power_mw", scale: 1 / 1_000_000, unit: "MW" },
  DCGM_FI_DEV_GPU_UTIL: { metricKey: "gpu_utilization_percent", scale: 1, unit: "%" },
};

export function parseDcgmPrometheus(text: string, observedAt = new Date().toISOString()) {
  return text.split(/\r?\n/).flatMap((line): ConnectorMeasurement[] => {
    if (!line || line.startsWith("#")) return [];
    const match = line.match(/^([A-Z0-9_]+)(?:\{([^}]*)\})?\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)$/i);
    if (!match) return [];
    const definition = dcgmMetrics[match[1]];
    if (!definition) return [];
    const labels = parseLabels(match[2] ?? "");
    const gpu = labels.UUID ?? labels.gpu ?? labels.device;
    if (!gpu) return [];
    const value = Number(match[3]);
    if (!Number.isFinite(value) || value < 0) return [];
    return [
      {
        metricKey: definition.metricKey,
        assetId: `gpu:${gpu}`,
        eventAt: observedAt,
        intervalSeconds: null,
        value: Number((value * definition.scale).toFixed(9)),
        unit: definition.unit,
        sourceRecordId: `${match[1]}:${gpu}:${observedAt}`,
      },
    ];
  });
}

function parseLabels(input: string) {
  const result: Record<string, string> = {};
  for (const match of input.matchAll(/([A-Za-z_][A-Za-z0-9_]*)="((?:\\.|[^"])*)"/g))
    result[match[1]] = match[2].replaceAll('\\"', '"');
  return result;
}

export function normalizeSlurmJobs(rows: Array<Record<string, unknown>>): ComputeWorkload[] {
  return rows.map((row) => {
    const start = iso(row.start_time ?? row.submit_time);
    const duration = positive(row.time_limit_minutes ?? row.elapsed_minutes, 60);
    return computeWorkloadSchema.parse({
      workloadId: String(row.job_id),
      sourceWorkloadId: String(row.job_id),
      name: String(row.name ?? `Slurm job ${row.job_id}`),
      source: "slurm",
      workloadClass: classify(String(row.partition ?? row.qos ?? row.name ?? "")),
      status: slurmStatus(String(row.state ?? "queued")),
      priority: Math.max(0, Math.round(Number(row.priority ?? 0))),
      submittedAt: iso(row.submit_time ?? start),
      earliestStart: start,
      deadline: new Date(
        Date.parse(start) + (duration + positive(row.maximum_delay_minutes, 0) + 60) * 60_000,
      ).toISOString(),
      expectedDurationMinutes: duration,
      requestedGpuCount: Math.max(1, Math.round(positive(row.gpu_count, 1))),
      minimumGpuCount: Math.max(
        1,
        Math.round(positive(row.minimum_gpu_count, positive(row.gpu_count, 1))),
      ),
      gpuModel: row.gpu_model ? String(row.gpu_model) : null,
      checkpointable: Boolean(row.checkpointable),
      preemptible: Boolean(row.preemptible),
      geographicallyPortable: false,
      maximumDelayMinutes: Math.max(0, Math.round(positive(row.maximum_delay_minutes, 0))),
      measuredPowerMw: row.measured_power_mw == null ? null : Number(row.measured_power_mw),
    });
  });
}

export function normalizeOpenEmsSnapshot(
  input: Record<string, unknown>,
  observedAt = new Date().toISOString(),
) {
  const fields: Array<[string, ConnectorMeasurement["metricKey"], number, string]> = [
    ["gridActivePowerW", "facility_grid_import_mw", 1 / 1_000_000, "MW"],
    ["essActivePowerW", "bess_power_mw", 1 / 1_000_000, "MW"],
    ["essSocPercent", "bess_soc_percent", 1, "%"],
  ];
  return fields.flatMap(([field, metricKey, scale, unit]): ConnectorMeasurement[] => {
    const raw = Number(input[field]);
    if (!Number.isFinite(raw)) return [];
    return [
      {
        metricKey,
        assetId: field.startsWith("ess") ? "battery:primary" : "facility",
        eventAt: observedAt,
        intervalSeconds: null,
        value: Number((raw * scale).toFixed(9)),
        unit,
        sourceRecordId: `openems:${field}:${observedAt}`,
      },
    ];
  });
}

function iso(value: unknown) {
  const date = new Date(
    typeof value === "number" ? value * 1_000 : String(value ?? new Date().toISOString()),
  );
  if (!Number.isFinite(date.getTime())) throw new Error("Connector timestamp is invalid.");
  return date.toISOString();
}
function positive(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}
function classify(value: string): ComputeWorkload["workloadClass"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("infer") || normalized.includes("serv")) return "inference";
  if (normalized.includes("train")) return "training";
  if (normalized.includes("critical") || normalized.includes("prod")) return "critical";
  return "batch";
}
function slurmStatus(value: string): ComputeWorkload["status"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("run")) return "running";
  if (normalized.includes("complete")) return "completed";
  if (normalized.includes("hold") || normalized.includes("suspend")) return "held";
  return "queued";
}
