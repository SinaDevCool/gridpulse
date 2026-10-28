import { z } from "zod";
import { facilityPlanRequestSchema } from "./contracts";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const common = {
  engine_version: z.string(),
  input_fingerprint: hash,
  result_fingerprint: hash,
  automatic_live_dispatch_authorized: z.literal(false),
};
export const chronologicalShadowRequestSchema = z
  .object({
    schema_version: z.literal("gridpulse-chronological-shadow-request-v1"),
    facility_plan: facilityPlanRequestSchema,
    windows: z
      .array(
        z
          .object({
            cutoff: z.string().datetime({ offset: true }),
            available_at: z.string().datetime({ offset: true }),
            changes: z
              .array(
                z
                  .object({
                    field: z.literal("generation_multiplier"),
                    value: z.number().min(0).max(2),
                  })
                  .strict(),
              )
              .max(1),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict();
export const uncertaintyAnalysisResultSchema = z
  .object({
    ...common,
    schema_version: z.literal(
      "gridpulse-facility-uncertainty-application-result-v1",
    ),
    truth_class: z.string(),
    capacity_claim: z.literal(false),
    result: z.discriminatedUnion("evaluation_method", [
      z
        .object({
          evaluation_method: z.literal("independent_scenario_benchmark"),
          accepted: z.boolean(),
          common_plan_validated: z.literal(false),
          feasibility_probability: z.number().min(0).max(1),
          dependable_reduction_mw: z.number().nonnegative(),
          outcomes: z.array(z.record(z.unknown())).max(32),
        })
        .passthrough(),
      z
        .object({
          evaluation_method: z.literal("common_command_scenario_milp"),
          accepted: z.boolean(),
          common_plan_validated: z.boolean(),
          scenario_weights_basis: z.literal(
            "assumed_not_calibrated_probability",
          ),
          outcomes: z.array(z.record(z.unknown())).max(4),
        })
        .passthrough(),
    ]),
  })
  .strict();
export const chronologicalShadowResultSchema = z
  .object({
    ...common,
    schema_version: z.literal("gridpulse-chronological-shadow-result-v1"),
    state_source: z.literal("model_replay_not_measured"),
    limitations: z.array(z.string()),
    fallback_policy: z.literal("stop_on_failure_no_stale_plan"),
    revisions: z
      .array(
        z
          .object({
            cutoff: z.string(),
            available_at: z.string(),
            input_fingerprint: hash,
            accepted: z.boolean(),
            initial_state: z.record(z.unknown()),
            plan: z.record(z.unknown()),
          })
          .passthrough(),
      )
      .min(1)
      .max(4),
  })
  .strict();
