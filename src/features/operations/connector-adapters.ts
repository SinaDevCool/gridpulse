import { computeWorkloadSchema, type ComputeWorkload } from "./workload-intelligence";

export type ConnectorMeasurement = {
  metricKey:
    | "facility_grid_import_mw"
    | "gpu_power_mw"
    | "gpu_utilization_percent"
    | "bess_power_mw"
    | "bess_soc_percent"
    | "it_load_mw"
    | "cooling_power_mw"
    | "auxiliary_power_mw"
    | "ups_output_mw"
    | "shiftable_load_mw"
    | "onsite_generation_mw"
    | "renewable_energy_mwh"
    | "waste_heat_mwh"
    | "waste_heat_temperature_c";
  assetId: string;
  eventAt: string;
  intervalSeconds: number | null;
  value: number;
  unit: string;
  sourceRecordId: string;
  sampleKind?: "instantaneous";
  observedAt?: string;
};

const dcgmMetrics: Record<
  string,
  { metricKey: ConnectorMeasurement["metricKey"]; scale: number; unit: string }
> = {
  DCGM_FI_DEV_POWER_USAGE: { metricKey: "gpu_power_mw", scale: 1 / 1_000_000, unit: "MW" },
  DCGM_FI_DEV_GPU_UTIL: { metricKey: "gpu_utilization_percent", scale: 1, unit: "%" },
};

export function parseDcgmPrometheus(text: string, observedAt = new Date().toISOString()) {
  iso(observedAt);
  const seen = new Set<string>();
  return text.split(/\r?\n/).flatMap((line): ConnectorMeasurement[] => {
    if (!line || line.startsWith("#")) return [];
    const match = line.match(/^([A-Z0-9_]+)(?:\{([^}]*)\})?\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(?:\s+(\d+))?$/i);
    if (!match) return [];
    const definition = dcgmMetrics[match[1]];
    if (!definition) return [];
    const labels = parseLabels(match[2] ?? "");
    const gpu = [labels.UUID ?? labels.gpu ?? labels.device, labels.GPU_I_ID].filter(Boolean).join(":");
    if (!gpu) return [];
    const value = Number(match[3]);
    if (!Number.isFinite(value) || value < 0 || value >= 9e18 || (definition.unit === "%" && value > 100)) return [];
    const eventAt = match[4] ? new Date(Number(match[4])).toISOString() : observedAt;
    const identity = `${match[1]}:${gpu}:${eventAt}`;
    if (seen.has(identity)) throw new Error("Duplicate DCGM measurement.");
    seen.add(identity);
    return [
      {
        metricKey: definition.metricKey,
        assetId: `gpu:${gpu}`,
        eventAt,
        observedAt, sampleKind: "instantaneous",
        intervalSeconds: null,
        value: Number((value * definition.scale).toFixed(9)),
        unit: definition.unit,
        sourceRecordId: identity,
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
    if (row.job_id == null || String(row.job_id).trim() === "") throw new Error("Slurm job identity is required.");
    const start = iso(row.start_time ?? row.submit_time);
    const duration = requiredPositive(row.expected_duration_minutes ?? row.time_limit_minutes, "expected runtime");
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
      deadline: row.deadline ? iso(row.deadline) : new Date(
        Date.parse(start) + (duration + positive(row.maximum_delay_minutes, 0) + 60) * 60_000,
      ).toISOString(),
      expectedDurationMinutes: duration,
      requestedGpuCount: Math.max(1, Math.round(requiredCount(row.gpu_count))),
      minimumGpuCount: Math.max(
        1,
        Math.round(positive(row.minimum_gpu_count, positive(row.gpu_count, 1))),
      ),
      gpuModel: row.gpu_model ? String(row.gpu_model) : null,
      checkpointable: permission(row.checkpointable),
      preemptible: permission(row.preemptible),
      geographicallyPortable: false,
      maximumDelayMinutes: Math.max(0, Math.round(positive(row.maximum_delay_minutes, 0))),
      measuredPowerMw: optionalPower(row.measured_power_mw),
    });
  });
}

export function normalizeOpenEmsSnapshot(
  input: Record<string, unknown>,
  observedAt = new Date().toISOString(),
) {
  iso(observedAt);
  const fields: Array<[string, ConnectorMeasurement["metricKey"], number, string]> = [
    ["gridActivePowerW", "facility_grid_import_mw", 1 / 1_000_000, "MW"],
    ["essActivePowerW", "bess_power_mw", 1 / 1_000_000, "MW"],
    ["essSocPercent", "bess_soc_percent", 1, "%"],
  ];
  return fields.flatMap(([field, metricKey, scale, unit]): ConnectorMeasurement[] => {
    const value = input[field];
    if (value == null || typeof value === "boolean" || typeof value === "string" && !value.trim()) return [];
    const raw = Number(value);
    if (!Number.isFinite(raw) || field === "essSocPercent" && (raw < 0 || raw > 100)) return [];
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
    typeof value === "number" ? value * 1_000 : String(value ?? ""),
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

function permission(value: unknown): boolean {
  if (value == null || value === false || value === "false" || value === 0 || value === "0") return false;
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  throw new Error("Ambiguous workload permission.");
}
function requiredPositive(value: unknown, name: string) {
  if (value == null || typeof value === "boolean" || value === "") throw new Error(`Missing ${name}.`);
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`Invalid ${name}.`);
  return number;
}
export type ConnectorReview<T> = { records: T[]; issues: { record: string; reason: string }[]; assumptions: string[]; qualifiedForPlanning: false };
/** Preview import is never evidence of scheduler permission or measured qualification. */
export function reviewSlurmJobs(rows: Array<Record<string, unknown>>): ConnectorReview<ComputeWorkload> {
  const records: ComputeWorkload[] = [], issues: ConnectorReview<ComputeWorkload>["issues"] = [];
  const assumptions = new Set<string>();
  rows.forEach((row, index) => {
    try {
      records.push(...normalizeSlurmJobs([row]));
      if(row.checkpointable==null || row.preemptible==null) assumptions.add("Missing scheduler permissions remain unverified; preview disables them.");
      if (!row.deadline) assumptions.add("Preview deadline constructed from scheduler time limit; requires explicit operator review.");
      if (row.expected_duration_minutes == null) assumptions.add("Scheduler time limit is not a measured runtime prediction.");
    } catch (error) { issues.push({ record: String(row.job_id ?? index), reason: error instanceof Error ? error.message : "Invalid record" }); }
  });
  return { records, issues, assumptions: [...assumptions], qualifiedForPlanning: false };
}
export function reviewOpenEmsSnapshot(input: Record<string, unknown>, observedAt: string): ConnectorReview<ConnectorMeasurement> {
  const records = normalizeOpenEmsSnapshot(input, observedAt);
  return { records, issues: ["gridActivePowerW", "essActivePowerW", "essSocPercent"].filter(field => !records.some(r => r.sourceRecordId.startsWith(`openems:${field}:`)))
    .map(record => ({ record, reason: "Missing or invalid measurement; not zero-filled." })),
    assumptions: ["Instantaneous snapshot; verify source timestamp, meter boundary and battery sign convention."], qualifiedForPlanning: false };
}

function requiredCount(value:unknown){const count=requiredPositive(value,"GPU count");if(!Number.isInteger(count))throw new Error("GPU count must be an integer.");return count;}
function optionalPower(value:unknown){if(value==null||value==="")return null;const power=Number(value);if(typeof value==="boolean"||!Number.isFinite(power)||power<0)throw new Error("Invalid measured power.");return power;}
export function reviewDcgmCapture(text:string,observedAt:string):ConnectorReview<ConnectorMeasurement>{
 try{const records=parseDcgmPrometheus(text,observedAt);return {records,issues:records.length?[]:[{record:"capture",reason:"No valid supported DCGM samples; no zero-filled measurements."}],assumptions:["Device snapshot only; confirm collector version, metric identity, cadence and measurement boundary."],qualifiedForPlanning:false};}
 catch(error){return {records:[],issues:[{record:"capture",reason:error instanceof Error?error.message:"Invalid capture"}],assumptions:[],qualifiedForPlanning:false};}
}
