import { z } from "zod";

export const experimentChangeSchema = z.object({
  field: z.enum(["battery_energy_mwh", "battery_power_mw", "initial_soc_fraction", "import_limit_mw",
    "workload_duration_multiplier", "generation_multiplier", "cooling_load_multiplier", "battery_unavailable_interval", "workload_availability_delay_minutes"]),
  value: z.number().finite().nonnegative(), asset_id: z.string().max(200).optional(),
}).strict();
export const experimentRequestSchema = z.object({
  schema_version: z.literal("gridpulse-facility-experiment-request-v1"),
  baseline_job_id: z.string().uuid(), baseline_result_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  cases: z.array(z.object({ case_id: z.string().min(1).max(100), mode: z.enum(["alternative", "frozen_plan"]),
    changes: z.array(experimentChangeSchema).min(1).max(4) }).strict()).min(1).max(4),
}).strict();
export type ExperimentRequest = z.infer<typeof experimentRequestSchema>;
const violationSchema = z.object({ code: z.string(), interval_index: z.number().int().nonnegative().nullable(),
  asset_id: z.string().optional(), magnitude: z.number().finite().optional(), unit: z.string().optional() });
export const comparisonMetricsSchema = z.object({
  grid_import_mwh: z.number().finite().nonnegative(), above_target_minutes: z.number().finite().nonnegative().nullable(),
  minimum_soc_fraction: z.number().finite().nonnegative().nullable(), battery_delivered_mwh: z.number().finite().nonnegative(),
  battery_equivalent_full_cycles: z.number().finite().nonnegative(), terminal_target_met: z.boolean().nullable(),
  deadline_checks_met: z.number().int().nonnegative(), workload_count: z.number().int().nonnegative(),
  rebound_peak_mw: z.number().finite().nonnegative().nullable(), basis: z.literal("canonical_physical_replay"),
  causal_binding_constraints_assessed: z.literal(false),
}).strict();
export const experimentResultSchema = z.object({
  schema_version: z.literal("gridpulse-facility-experiment-result-v1"), engine_version: z.string(),
  input_fingerprint: z.string().regex(/^[a-f0-9]{64}$/), result_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  baseline_result_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  baseline_metrics: comparisonMetricsSchema.optional(),
  scenario_basis: z.literal("assumed_not_calibrated_probability"),
  capacity_claim: z.literal(false), automatic_live_dispatch_authorized: z.literal(false),
  cases: z.array(z.object({ case_id: z.string(), mode: z.enum(["alternative", "frozen_plan"]),
    status: z.enum(["completed", "unsupported_or_invalid"]), accepted: z.boolean(), reason: z.string().optional(),
    peak_import_mw: z.number().finite().nonnegative().optional(), above_import_limit_minutes: z.number().finite().nonnegative().optional(),
    remaining_work_hours: z.number().finite().nonnegative().optional(), first_violation_index: z.number().int().nonnegative().nullable().optional(),
    metrics: comparisonMetricsSchema.optional(),
    violations: z.array(violationSchema).optional(), unsupported_checks: z.array(z.string()).optional(),
  }).passthrough()).min(1).max(4),
});
export type ExperimentResult = z.infer<typeof experimentResultSchema>;


export const accountingRequestSchema = z.object({ schema_version: z.literal("gridpulse-facility-accounting-request-v1"),
  baseline_job_id: z.string().uuid(), baseline_result_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  prices_eur_per_mwh: z.array(z.number().finite()).min(1).max(96),
}).strict();
export const accountingResultSchema = z.object({ schema_version: z.literal("gridpulse-facility-accounting-result-v1"),
  baseline_result_fingerprint: z.string().regex(/^[a-f0-9]{64}$/), result_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  input_fingerprint: z.string().regex(/^[a-f0-9]{64}$/), engine_version: z.string(), basis: z.literal("fixed_schedule_energy_only"),
  grid_import_mwh: z.number().finite().nonnegative(), energy_cost_eur: z.number().finite(),
  baseline_energy_cost_eur: z.number().finite(), energy_cost_difference_eur: z.number().finite(),
  excluded: z.array(z.string()), automatic_live_dispatch_authorized: z.literal(false),
}).strict();
export type AccountingRequest = z.infer<typeof accountingRequestSchema>;


/** Presentation metadata for the existing engine contract; no physical calculations here. */
export const experimentFields = {
  battery_energy_mwh: { label: "Battery nominal energy", unit: "MWh", asset: "battery", min: 0.000001, max: 1000000 },
  battery_power_mw: { label: "Battery discharge limit", unit: "MW", asset: "battery", min: 0.000001, max: 1000000 },
  initial_soc_fraction: { label: "Initial SOC fraction", unit: "fraction", asset: "battery", min: 0, max: 1 },
  import_limit_mw: { label: "Facility import limit", unit: "MW", asset: "none", min: 0.000001, max: 1000000 },
  workload_duration_multiplier: { label: "Workload duration multiplier", unit: "x", asset: "workload", min: 0.5, max: 2 },
  generation_multiplier: { label: "Generation multiplier", unit: "x", asset: "none", min: 0, max: 2 },
  cooling_load_multiplier: { label: "Cooling load multiplier", unit: "x", asset: "none", min: 0.5, max: 2 },
  battery_unavailable_interval: { label: "Battery outage interval index", unit: "index", asset: "battery", min: 0, max: 95 },
  workload_availability_delay_minutes: { label: "Workload start-availability delay", unit: "min", asset: "workload", min: 0, max: 1440 },
} as const;
export type ExperimentField = keyof typeof experimentFields;
