import { z } from "zod";
import type { OperationsOverviewModel } from "./scenario-engine";

export const workloadClassSchema = z.enum(["training", "inference", "batch", "critical"]);
export const workloadStatusSchema = z.enum(["running", "queued", "held", "completed"]);
export const workloadSourceSchema = z.enum(["scenario", "csv", "slurm", "kueue"]);

export const computeWorkloadSchema = z
  .object({
    workloadId: z.string().trim().min(1).max(160),
    name: z.string().trim().min(1).max(160),
    source: workloadSourceSchema,
    sourceWorkloadId: z.string().trim().min(1).max(160),
    workloadClass: workloadClassSchema,
    status: workloadStatusSchema,
    priority: z.number().int().min(0).max(10_000),
    submittedAt: z.string().datetime(),
    earliestStart: z.string().datetime(),
    deadline: z.string().datetime(),
    expectedDurationMinutes: z.number().positive().max(100_000),
    requestedGpuCount: z.number().int().positive().max(1_000_000),
    minimumGpuCount: z.number().int().positive().max(1_000_000),
    gpuModel: z.string().trim().max(120).nullable(),
    checkpointable: z.boolean(),
    preemptible: z.boolean(),
    geographicallyPortable: z.boolean(),
    maximumDelayMinutes: z.number().int().nonnegative().max(100_000),
    measuredPowerMw: z.number().nonnegative().max(5_000).nullable(),
  })
  .superRefine((value, context) => {
    if (value.minimumGpuCount > value.requestedGpuCount)
      context.addIssue({
        code: "custom",
        path: ["minimumGpuCount"],
        message: "Minimum GPUs cannot exceed requested GPUs.",
      });
    if (Date.parse(value.deadline) <= Date.parse(value.earliestStart))
      context.addIssue({
        code: "custom",
        path: ["deadline"],
        message: "Deadline must follow earliest start.",
      });
  });

export const gpuTelemetrySchema = z.object({
  timestamp: z.string().datetime(),
  workloadId: z.string().trim().min(1),
  gpuUuid: z.string().trim().min(1),
  utilizationPercent: z.number().min(0).max(100).nullable(),
  smActivityPercent: z.number().min(0).max(100).nullable(),
  memoryUtilizationPercent: z.number().min(0).max(100).nullable(),
  powerWatts: z.number().nonnegative().nullable(),
  energyJoules: z.number().nonnegative().nullable(),
  temperatureC: z.number().min(-50).max(200).nullable(),
  powerLimitWatts: z.number().positive().nullable(),
  throttleReason: z.string().trim().max(160).nullable(),
});

export type ComputeWorkload = z.infer<typeof computeWorkloadSchema>;
export type GpuTelemetry = z.infer<typeof gpuTelemetrySchema>;
export type WorkloadDecision = ComputeWorkload & {
  estimatedPowerMw: number;
  powerEvidence: "measured" | "reference";
  deadlineSlackMinutes: number;
  eligible: boolean;
  recommended: boolean;
  reason: string;
  proposedStart: string;
  peakReductionMw: number;
};

export type WorkloadAssessment = {
  source: ComputeWorkload["source"];
  decisions: WorkloadDecision[];
  affectedJobs: number;
  eligibleJobs: number;
  flexiblePowerMw: number;
  flexibleEnergyMwh: number;
  recommendedJobs: number;
  recommendedPowerMw: number;
  recommendedEnergyMwh: number;
  requiredWorkloadResponseMw: number;
  deadlinesAtRisk: number;
  telemetryCompletenessPercent: number;
};

const booleanValue = (value: string) =>
  ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
const numberValue = (value: string, field: string, row: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${field} on row ${row}.`);
  return parsed;
};

export function parseWorkloadCsv(text: string, source: "csv" | "slurm" = "csv"): ComputeWorkload[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2)
    throw new Error("The workload file must contain a header and at least one row.");
  const headers = lines[0].split(",").map((value) => value.trim().toLowerCase());
  const required = [
    "workload_id",
    "name",
    "workload_class",
    "status",
    "priority",
    "earliest_start",
    "deadline",
    "expected_duration_minutes",
    "requested_gpu_count",
  ];
  const missing = required.filter((field) => !headers.includes(field));
  if (missing.length) throw new Error(`Missing workload columns: ${missing.join(", ")}.`);
  const at = (cells: string[], key: string) => cells[headers.indexOf(key)]?.trim() ?? "";
  return lines.slice(1).map((line, index) => {
    const row = index + 2;
    const cells = line.split(",");
    const requested = numberValue(at(cells, "requested_gpu_count"), "requested_gpu_count", row);
    const earliest = new Date(at(cells, "earliest_start"));
    const deadline = new Date(at(cells, "deadline"));
    if (!Number.isFinite(earliest.getTime()) || !Number.isFinite(deadline.getTime()))
      throw new Error(`Invalid workload date on row ${row}.`);
    return computeWorkloadSchema.parse({
      workloadId: at(cells, "workload_id"),
      name: at(cells, "name"),
      source,
      sourceWorkloadId: at(cells, "workload_id"),
      workloadClass: at(cells, "workload_class"),
      status: at(cells, "status"),
      priority: numberValue(at(cells, "priority"), "priority", row),
      submittedAt: new Date(at(cells, "submitted_at") || earliest).toISOString(),
      earliestStart: earliest.toISOString(),
      deadline: deadline.toISOString(),
      expectedDurationMinutes: numberValue(
        at(cells, "expected_duration_minutes"),
        "expected_duration_minutes",
        row,
      ),
      requestedGpuCount: requested,
      minimumGpuCount: Number(at(cells, "minimum_gpu_count") || requested),
      gpuModel: at(cells, "gpu_model") || null,
      checkpointable: booleanValue(at(cells, "checkpointable")),
      preemptible: booleanValue(at(cells, "preemptible")),
      geographicallyPortable: booleanValue(at(cells, "geographically_portable")),
      maximumDelayMinutes: Number(at(cells, "maximum_delay_minutes") || 0),
      measuredPowerMw: at(cells, "measured_power_mw")
        ? numberValue(at(cells, "measured_power_mw"), "measured_power_mw", row)
        : null,
    });
  });
}

export function parseGpuTelemetryCsv(text: string): GpuTelemetry[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2)
    throw new Error("The telemetry file must contain a header and at least one row.");
  const headers = lines[0].split(",").map((value) => value.trim().toLowerCase());
  const required = ["timestamp", "workload_id", "gpu_uuid", "power_watts"];
  const missing = required.filter((field) => !headers.includes(field));
  if (missing.length) throw new Error(`Missing telemetry columns: ${missing.join(", ")}.`);
  const at = (cells: string[], key: string) => cells[headers.indexOf(key)]?.trim() ?? "";
  const optionalNumber = (cells: string[], key: string) =>
    at(cells, key) ? Number(at(cells, key)) : null;
  return lines.slice(1).map((line, index) => {
    const cells = line.split(",");
    const timestamp = new Date(at(cells, "timestamp"));
    if (!Number.isFinite(timestamp.getTime()))
      throw new Error(`Invalid telemetry timestamp on row ${index + 2}.`);
    return gpuTelemetrySchema.parse({
      timestamp: timestamp.toISOString(),
      workloadId: at(cells, "workload_id"),
      gpuUuid: at(cells, "gpu_uuid"),
      utilizationPercent: optionalNumber(cells, "gpu_utilization_percent"),
      smActivityPercent: optionalNumber(cells, "sm_activity_percent"),
      memoryUtilizationPercent: optionalNumber(cells, "memory_utilization_percent"),
      powerWatts: optionalNumber(cells, "power_watts"),
      energyJoules: optionalNumber(cells, "energy_joules"),
      temperatureC: optionalNumber(cells, "temperature_c"),
      powerLimitWatts: optionalNumber(cells, "power_limit_watts"),
      throttleReason: at(cells, "throttle_reason") || null,
    });
  });
}

export function buildScenarioWorkloads(model: OperationsOverviewModel): ComputeWorkload[] {
  const base = Date.parse(model.intervals[0].timestamp);
  const iso = (minutes: number) => new Date(base + minutes * 60_000).toISOString();
  return [
    [
      "train-1042",
      "Foundation model training",
      "training",
      "running",
      70,
      32_000,
      420,
      true,
      true,
      180,
    ],
    [
      "infer-prod",
      "Production inference",
      "critical",
      "running",
      100,
      28_000,
      1440,
      false,
      false,
      0,
    ],
    ["train-1048", "Vision fine-tuning", "training", "queued", 45, 12_000, 180, true, true, 240],
    ["batch-218", "Embedding refresh", "batch", "queued", 30, 8_000, 120, true, true, 360],
    ["eval-912", "Model evaluation", "batch", "held", 20, 4_000, 90, true, true, 480],
  ].map((item, index) =>
    computeWorkloadSchema.parse({
      workloadId: item[0],
      name: item[1],
      source: "scenario",
      sourceWorkloadId: item[0],
      workloadClass: item[2],
      status: item[3],
      priority: item[4],
      submittedAt: iso(index * 20),
      earliestStart: iso(360 + index * 20),
      deadline: iso(960 + Number(item[6])),
      expectedDurationMinutes: item[6],
      requestedGpuCount: item[5],
      minimumGpuCount: item[5],
      gpuModel: model.scenario.gpuModel,
      checkpointable: item[7],
      preemptible: item[8],
      geographicallyPortable: false,
      maximumDelayMinutes: item[9],
      measuredPowerMw: null,
    }),
  );
}

export function assessWorkloads(
  workloads: ComputeWorkload[],
  telemetry: GpuTelemetry[],
  model: OperationsOverviewModel,
): WorkloadAssessment {
  const referenceMwPerGpu = (model.scenario.gpuActivePowerWatts * model.scenario.pue) / 1_000_000;
  const telemetryByWorkload = new Map<string, number[]>();
  telemetry.forEach((point) => {
    if (point.powerWatts != null)
      telemetryByWorkload.set(point.workloadId, [
        ...(telemetryByWorkload.get(point.workloadId) ?? []),
        point.powerWatts,
      ]);
  });
  const decisions = workloads.map((workload): WorkloadDecision => {
    const samples = telemetryByWorkload.get(workload.workloadId) ?? [];
    const measured =
      workload.source === "scenario"
        ? null
        : (workload.measuredPowerMw ??
          (samples.length
            ? samples.reduce((sum, value) => sum + value, 0) / samples.length / 1_000_000
            : null));
    const estimatedPowerMw = measured ?? workload.requestedGpuCount * referenceMwPerGpu;
    const windowMinutes =
      (Date.parse(workload.deadline) - Date.parse(workload.earliestStart)) / 60_000;
    const deadlineSlackMinutes = Math.max(0, windowMinutes - workload.expectedDurationMinutes);
    const delay = Math.min(workload.maximumDelayMinutes, model.scenario.maximumDelayMinutes);
    const eligible =
      workload.workloadClass !== "critical" &&
      workload.checkpointable &&
      workload.preemptible &&
      delay > 0 &&
      deadlineSlackMinutes >= delay;
    const reason =
      workload.workloadClass === "critical"
        ? "Protected critical workload"
        : !workload.checkpointable
          ? "No checkpoint support"
          : !workload.preemptible
            ? "Preemption is disabled"
            : delay <= 0
              ? "No declared delay window"
              : deadlineSlackMinutes < delay
                ? "Insufficient deadline slack"
                : "Eligible within declared deadline";
    return {
      ...workload,
      estimatedPowerMw: Number(estimatedPowerMw.toFixed(2)),
      powerEvidence: measured == null ? "reference" : "measured",
      deadlineSlackMinutes: Math.round(deadlineSlackMinutes),
      eligible,
      recommended: false,
      reason,
      proposedStart: new Date(
        Date.parse(workload.earliestStart) + (eligible ? delay : 0) * 60_000,
      ).toISOString(),
      peakReductionMw: eligible ? Number(estimatedPowerMw.toFixed(2)) : 0,
    };
  });
  const eligible = decisions.filter((workload) => workload.eligible);
  const batteryCase = model.summaries.find((summary) => summary.kind === "battery");
  const safeFacilityTargetMw = model.scenario.importLimitMw - model.scenario.safetyReserveMw;
  const baselinePeakMw = Math.max(...model.intervals.map((interval) => interval.baselineDemandMw));
  const requiredWorkloadResponseMw = Number(
    Math.max(0, (batteryCase?.peakDemandMw ?? baselinePeakMw) - safeFacilityTargetMw).toFixed(1),
  );
  let remainingResponseMw = requiredWorkloadResponseMw;
  const rankedEligible = [...eligible].sort(
    (a, b) => a.priority - b.priority || a.estimatedPowerMw - b.estimatedPowerMw,
  );
  const singleWorkloadMatch = rankedEligible.find(
    (workload) => workload.estimatedPowerMw >= requiredWorkloadResponseMw,
  );
  const recommendationPool = singleWorkloadMatch ? [singleWorkloadMatch] : rankedEligible;
  recommendationPool.forEach((workload) => {
    if (remainingResponseMw <= 0) return;
    const decision = decisions.find((candidate) => candidate.workloadId === workload.workloadId);
    if (!decision) return;
    decision.recommended = true;
    decision.peakReductionMw = Number(
      Math.min(decision.estimatedPowerMw, remainingResponseMw).toFixed(2),
    );
    remainingResponseMw = Math.max(0, remainingResponseMw - decision.estimatedPowerMw);
  });
  const recommended = decisions.filter((workload) => workload.recommended);
  const telemetryFields = telemetry.flatMap((point) => [
    point.utilizationPercent,
    point.smActivityPercent,
    point.memoryUtilizationPercent,
    point.powerWatts,
    point.energyJoules,
    point.temperatureC,
    point.powerLimitWatts,
  ]);
  const populated = telemetryFields.filter((value) => value != null).length;
  return {
    source: workloads[0]?.source ?? "scenario",
    decisions,
    affectedJobs: decisions.filter(
      (workload) => workload.status === "running" || workload.status === "queued",
    ).length,
    eligibleJobs: eligible.length,
    flexiblePowerMw: Number(
      eligible.reduce((sum, workload) => sum + workload.estimatedPowerMw, 0).toFixed(1),
    ),
    flexibleEnergyMwh: Number(
      eligible
        .reduce(
          (sum, workload) =>
            sum +
            (workload.estimatedPowerMw *
              Math.min(workload.maximumDelayMinutes, model.scenario.maximumDelayMinutes)) /
              60,
          0,
        )
        .toFixed(1),
    ),
    recommendedJobs: recommended.length,
    recommendedPowerMw: Number(
      recommended.reduce((sum, workload) => sum + workload.peakReductionMw, 0).toFixed(1),
    ),
    recommendedEnergyMwh: Number(
      Math.min(
        recommended.reduce(
          (sum, workload) =>
            sum +
            (workload.peakReductionMw *
              Math.min(workload.maximumDelayMinutes, model.scenario.maximumDelayMinutes)) /
              60,
          0,
        ),
        model.recommendation.workloadMwh,
      ).toFixed(1),
    ),
    requiredWorkloadResponseMw,
    deadlinesAtRisk: decisions.filter(
      (workload) => workload.deadlineSlackMinutes < workload.expectedDurationMinutes * 0.1,
    ).length,
    telemetryCompletenessPercent: telemetryFields.length
      ? Number(((populated / telemetryFields.length) * 100).toFixed(1))
      : 0,
  };
}

export type OperationsConnector = {
  id: "prometheus_dcgm" | "kueue" | "slurm";
  label: string;
  status: "not_connected" | "connected" | "degraded";
  capabilities: string[];
};
export const operationsConnectors: OperationsConnector[] = [
  {
    id: "prometheus_dcgm",
    label: "NVIDIA DCGM / Prometheus",
    status: "not_connected",
    capabilities: ["GPU power", "GPU utilisation", "energy", "thermal and throttle state"],
  },
  {
    id: "kueue",
    label: "Kubernetes / Kueue",
    status: "not_connected",
    capabilities: ["workload queue", "priority", "resource requests", "admission state"],
  },
  {
    id: "slurm",
    label: "Slurm",
    status: "not_connected",
    capabilities: ["job accounting", "GPU allocation", "GPU utilisation", "job timing"],
  },
];
