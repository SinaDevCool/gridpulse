import { z } from "zod";
export const jobAcceptedSchema = z.object({
  job_id: z.string().uuid(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
});
export const analyticsJobSchema = z.object({
  id: z.string().uuid(),
  job_type: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  result_payload: z.record(z.unknown()).nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
});
export type AnalyticsJob = z.infer<typeof analyticsJobSchema>;
export const c3RequestSchema = z
  .object({
    network_model: z.record(z.unknown()),
    security_criteria: z.record(z.unknown()),
    portfolio: z.record(z.unknown()),
    timestamps: z.array(z.string()).min(1),
    demand_mw: z.array(z.number()).min(1),
    onsite_generation_mw: z.array(z.number()).min(1),
    import_envelope_mw: z.array(z.number()).min(1),
    export_envelope_mw: z.array(z.number()).min(1),
    price_eur_mwh: z.array(z.number()).min(1),
    contract_start: z.string(),
    contract_end: z.string(),
    fca_mode: z.enum(["dynamic", "static"]),
  })
  .superRefine((value, ctx) => {
    const n = value.timestamps.length;
    for (const key of [
      "demand_mw",
      "onsite_generation_mw",
      "import_envelope_mw",
      "export_envelope_mw",
      "price_eur_mwh",
    ] as const)
      if (value[key].length !== n)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Series length must match timestamps",
        });
  });
export type C3Request = z.infer<typeof c3RequestSchema>;

export const facilityPlanRequestSchema = z
  .object({
    schema_version: z.literal("gridpulse-facility-plan-request-v1"),
    portfolio_id: z.string().min(1).max(200),
    requirement: z.record(z.unknown()),
    intervals: z.array(z.record(z.unknown())).min(1).max(35_040),
    facility: z.record(z.unknown()),
    workloads: z.array(z.record(z.unknown())).min(1).max(5_000),
    profiles: z.array(z.record(z.unknown())).min(1).max(5_000),
    policy: z.record(z.unknown()),
    economics: z.record(z.unknown()),
    cooling: z.record(z.unknown()),
  })
  .strict();

export const facilityPlanResultSchema = z
  .object({
    schema_version: z.literal("gridpulse-facility-plan-application-result-v1"),
    engine_version: z.string().min(1),
    input_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    result_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    truth_class: z.string().min(1),
    capacity_claim: z.literal(false),
    automatic_live_dispatch_authorized: z.literal(false),
    result: z.record(z.unknown()),
  })
  .strict();

export type FacilityPlanRequest = z.infer<typeof facilityPlanRequestSchema>;
export type FacilityPlanResult = z.infer<typeof facilityPlanResultSchema>;

export const fcaIntervalRequestSchema = z.object({
  schema_version: z.literal("gridpulse-fca-interval-request-v1"),
  analysis_kind: z.literal("dispatch").default("dispatch"),
  points: z.array(z.object({
    timestamp: z.string(), import_mw: z.number().nonnegative(), export_mw: z.number().nonnegative(),
    flexible_load_mw: z.number().nonnegative().optional(), onsite_generation_mw: z.number().nonnegative().optional(),
    connection_limit_mw: z.number().nonnegative().optional(), connection_limit_factor: z.number().nonnegative().optional(),
  }).strict()).min(1).max(40_000),
  settings: z.object({
    firm_import_mw: z.number().nonnegative(), conditional_import_mw: z.number().nonnegative(),
    minimum_critical_load_mw: z.number().nonnegative(), shiftable_load_mw: z.number().nonnegative(),
    battery_power_mw: z.number().nonnegative(), battery_energy_mwh: z.number().nonnegative(),
    battery_round_trip_efficiency: z.number().positive().max(1), battery_minimum_soc: z.number().min(0).max(1),
    initial_battery_soc: z.number().min(0).max(1), energy_value_eur_mwh: z.number().nonnegative(),
    battery_degradation_eur_mwh: z.number().nonnegative(), minimum_viable_import_mw: z.number().nonnegative().optional(),
  }).strict(),
}).strict();

export const fcaIntervalResultSchema = z.object({
  schema_version: z.literal("gridpulse-fca-interval-application-result-v1"),
  engine_version: z.string(), input_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  result_fingerprint: z.string().regex(/^[a-f0-9]{64}$/), capacity_claim: z.literal(false),
  automatic_live_dispatch_authorized: z.literal(false),
  result: z.record(z.unknown()),
}).strict();

export type FcaIntervalRequest = z.infer<typeof fcaIntervalRequestSchema>;
export type FcaIntervalResult = z.infer<typeof fcaIntervalResultSchema>;

export const fcaProfileRequestSchema = z.object({
  schema_version: z.literal("gridpulse-fca-interval-request-v1"),
  analysis_kind: z.literal("envelope_profile"),
  points: z.array(z.object({ timestamp: z.string(), import_mw: z.number().nonnegative(), export_mw: z.number().nonnegative() }).passthrough()).min(1).max(40_000),
  settings: z.object({
    mode: z.string(), max_import_mw: z.number().nonnegative().nullable(), max_export_mw: z.number().nonnegative().nullable(),
    energy_value_eur_mwh: z.number().nonnegative(),
    restriction_window: z.object({ start_hour: z.number().int().min(0).max(24), end_hour: z.number().int().min(0).max(24), weekdays: z.array(z.number().int().min(1).max(7)) }).nullable(),
  }).strict(),
}).strict();

export type FcaProfileRequest = z.infer<typeof fcaProfileRequestSchema>;

export const facilityUncertaintyRequestSchema = z
  .object({
    schema_version: z.literal("gridpulse-facility-uncertainty-request-v1"),
    facility_plan: facilityPlanRequestSchema,
    bounds: z.object({
      temperature_min_c: z.number(),
      temperature_max_c: z.number(),
      onsite_generation_min_mw: z.number().nonnegative(),
      onsite_generation_max_mw: z.number().nonnegative(),
    }).strict(),
    scenario_count: z.number().int().min(1).max(1_000),
    seed: z.number().int(),
    risk_policy: z.enum(["chance_constrained", "distributionally_robust", "cvar"]),
    confidence: z.number().gt(0).lt(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.bounds.temperature_min_c > value.bounds.temperature_max_c)
      ctx.addIssue({ code: "custom", path: ["bounds"], message: "Temperature bounds are reversed" });
    if (value.bounds.onsite_generation_min_mw > value.bounds.onsite_generation_max_mw)
      ctx.addIssue({ code: "custom", path: ["bounds"], message: "Generation bounds are reversed" });
  });

export type FacilityUncertaintyRequest = z.infer<typeof facilityUncertaintyRequestSchema>;

export const marketQualificationRequestSchema = z.object({
  schema_version: z.literal("gridpulse-market-qualification-request-v1"),
  product: z.record(z.unknown()),
  requirement: z.record(z.unknown()),
  uncertainty: z.object({
    schema_version: z.literal("gridpulse-facility-uncertainty-application-result-v1"),
    engine_version: z.string().min(1),
    input_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    result_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    truth_class: z.string().min(1),
    capacity_claim: z.literal(false),
    automatic_live_dispatch_authorized: z.literal(false),
    result: z.record(z.unknown()),
  }).strict(),
  settlement: z.object({
    offered_mw: z.number().nonnegative(),
    availability_hours: z.number().nonnegative(),
    requested_mwh: z.number().nonnegative(),
    verified_delivered_mwh: z.number().nonnegative(),
  }).strict().nullable().optional(),
}).strict();

export const rollingFacilityPlanRequestSchema = z.object({
  schema_version: z.literal("gridpulse-rolling-facility-plan-request-v1"),
  facility_plan: facilityPlanRequestSchema,
  windows: z.array(z.object({
    window_id: z.string().min(1),
    cutoff: z.string().min(1),
    forecast_fingerprint: z.string().regex(/^[a-fA-F0-9]{64}$/),
    recalculation_reason: z.string().min(1),
    scenarios: z.array(z.object({
      scenario_id: z.string().min(1),
      probability: z.number().gt(0).lte(1),
      battery_temperature_c: z.array(z.number()).min(1).max(35_040),
      onsite_generation_mw: z.array(z.number().nonnegative()).min(1).max(35_040),
      assumption_ids: z.array(z.string()).default([]),
    }).strict()).min(1).max(1_000),
  }).strict()).min(1).max(100),
  confidence: z.number().gt(0).lt(1).default(0.9),
}).strict();

export const marketQualificationResultSchema = z.object({
  schema_version: z.literal("gridpulse-market-qualification-application-result-v1"),
  engine_version: z.string().min(1),
  input_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  result_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  truth_class: z.string().min(1),
  capacity_claim: z.literal(false),
  automatic_live_dispatch_authorized: z.literal(false),
  eligibility: z.record(z.unknown()),
  settlement: z.record(z.unknown()).nullable(),
}).strict();

export const rollingFacilityPlanResultSchema = z.object({
  schema_version: z.literal("gridpulse-rolling-facility-plan-application-result-v1"),
  engine_version: z.string().min(1),
  input_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  result_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  truth_class: z.string().min(1),
  capacity_claim: z.literal(false),
  automatic_live_dispatch_authorized: z.literal(false),
  result: z.record(z.unknown()),
}).strict();

export type MarketQualificationRequest = z.infer<typeof marketQualificationRequestSchema>;
export type RollingFacilityPlanRequest = z.infer<typeof rollingFacilityPlanRequestSchema>;

export const facilityHistoricalReplayRequestSchema = z.object({
  schema_version: z.literal("gridpulse-facility-historical-replay-request-v1"),
  planning_cutoff: z.string().min(1),
  intervals: z.array(z.record(z.unknown())).min(1).max(35_040),
  baseline: z.record(z.unknown()),
  planned: z.record(z.unknown()),
  portfolio: z.record(z.unknown()),
  observations: z.array(z.record(z.unknown())).min(1).max(35_040),
  tariff: z.record(z.unknown()),
  event_intervals: z.array(z.boolean()).min(1).max(35_040),
  required_reduction_mw: z.number().nonnegative().max(2_000),
  battery_throughput_mwh: z.number().nonnegative().default(0),
}).strict().superRefine((value, ctx) => {
  const size = value.intervals.length;
  if (value.observations.length !== size || value.event_intervals.length !== size)
    ctx.addIssue({ code: "custom", path: ["intervals"], message: "Replay horizons must align" });
});

export type FacilityHistoricalReplayRequest = z.infer<typeof facilityHistoricalReplayRequestSchema>;

export const operatorEnquiryPackageRequestSchema = z.object({
  schema_version: z.literal("gridpulse-operator-enquiry-package-request-v1"),
  package_id: z.string().min(1).max(200),
  artifacts: z.record(z.unknown()).refine((value) => Object.keys(value).length > 0, "Artifacts are required"),
  blockers: z.array(z.string()).max(1_000).default([]),
  assumption_ids: z.array(z.string()).max(1_000).default([]),
}).strict();

export const operatorEnquiryPackageResultSchema = z.object({
  schema_version: z.literal("gridpulse-operator-enquiry-package-application-result-v1"),
  engine_version: z.string().min(1),
  input_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  result_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  capacity_claim: z.literal(false),
  automatic_live_dispatch_authorized: z.literal(false),
  package: z.object({
    payload: z.record(z.unknown()),
    json_text: z.string(),
    markdown_text: z.string(),
    manifest: z.record(z.unknown()),
    package_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  }),
}).strict();

export type OperatorEnquiryPackageRequest = z.infer<typeof operatorEnquiryPackageRequestSchema>;
export type OperatorEnquiryPackageResult = z.infer<typeof operatorEnquiryPackageResultSchema>;

export const shadowVerificationRequestSchema = z.object({
  schema_version: z.literal("gridpulse-shadow-verification-request-v1"),
  facility_id: z.string().min(1).max(200),
  generated_at: z.string().min(1),
  plan_fingerprint: z.string().regex(/^[a-fA-F0-9]{64}$/),
  planned_grid_import_mw: z.array(z.number().nonnegative()).min(1).max(35_040),
  observed_grid_import_mw: z.array(z.number().nonnegative()).min(1).max(35_040),
  uncertainty_band_mw: z.array(z.number().nonnegative()).min(1).max(35_040),
  observations: z.array(z.record(z.unknown())).min(1).max(200_000),
  reference_times: z.array(z.string()).min(1).max(35_040),
  supplied_energy_mwh: z.number().nonnegative(),
  consumed_energy_mwh: z.number().nonnegative(),
  required_reduction_mw: z.number().nonnegative().max(2_000),
  delivered_reduction_mw: z.number().nonnegative().max(2_000),
  security_controls: z.record(z.boolean()),
  quality_thresholds: z.record(z.number()).default({}),
  warning_consecutive_intervals: z.number().int().min(1).default(2),
  safe_limit_consecutive_intervals: z.number().int().min(1).default(3),
}).strict().superRefine((value, ctx) => {
  const size = value.planned_grid_import_mw.length;
  if (value.observed_grid_import_mw.length !== size || value.uncertainty_band_mw.length !== size)
    ctx.addIssue({ code: "custom", path: ["planned_grid_import_mw"], message: "Shadow trajectories must align" });
  if (value.safe_limit_consecutive_intervals < value.warning_consecutive_intervals)
    ctx.addIssue({ code: "custom", path: ["safe_limit_consecutive_intervals"], message: "Safe-limit threshold must follow warning threshold" });
});

export type ShadowVerificationRequest = z.infer<typeof shadowVerificationRequestSchema>;

export const shadowVerificationResultSchema = z.object({
  schema_version: z.literal("gridpulse-shadow-verification-application-result-v1"),
  engine_version: z.string().min(1),
  input_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  result_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  capacity_claim: z.literal(false),
  automatic_live_dispatch_authorized: z.literal(false),
  read_only: z.literal(true),
  ready: z.boolean(),
  blockers: z.array(z.string()),
  snapshot: z.object({
    facility_id: z.string(),
    generated_at: z.string(),
    required_reduction_mw: z.number(),
    delivered_reduction_mw: z.number(),
    automatic_live_dispatch_authorized: z.literal(false),
    telemetry: z.object({ accepted: z.boolean(), maximum_clock_offset_seconds: z.number(), maximum_sampling_jitter_seconds: z.number(), energy_residual_fraction: z.number(), missing_count: z.number(), suspect_count: z.number(), blockers: z.array(z.string()) }),
    divergence: z.object({
      classification: z.string(),
      conditional_flexibility_allowed: z.boolean(),
      blockers: z.array(z.string()),
      points: z.array(z.object({ interval_index: z.number(), planned_grid_import_mw: z.number(), observed_grid_import_mw: z.number(), absolute_residual_mw: z.number(), uncertainty_band_mw: z.number(), inside_band: z.boolean(), consecutive_divergence_count: z.number() })),
    }),
  }),
  security: z.object({ ready: z.boolean(), passed_controls: z.number(), total_controls: z.number(), blockers: z.array(z.string()), live_dispatch_authorized: z.literal(false) }),
}).passthrough();

export type ShadowVerificationResult = z.infer<typeof shadowVerificationResultSchema>;

export const capacityRequirementRequestSchema = z
  .object({
    schema_version: z.literal("gridpulse-capacity-requirement-request-v1"),
    capacity_result: z.record(z.unknown()),
    site_id: z.string().min(1).max(200),
    pcc_id: z.string().min(1).max(200),
    requested_import_mw: z.number().positive().max(2_000),
    expected_provenance_fingerprint: z.string().regex(/^[a-fA-F0-9]{64}$/),
    operating_terms: z.record(z.unknown()).optional(),
    assumption_ids: z.array(z.string()).max(1_000).optional(),
    capacity_is_lower_bound: z.boolean().optional(),
  })
  .strict();

export type CapacityRequirementRequest = z.infer<typeof capacityRequirementRequestSchema>;
