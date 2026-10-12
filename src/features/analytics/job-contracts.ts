import { z } from "zod";

export const analyticsJobStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export type AnalyticsJobStatus = z.infer<typeof analyticsJobStatusSchema>;
export const jobAcceptedSchema = z.object({
  job_id: z.string().uuid(),
  status: analyticsJobStatusSchema,
});
export type JobAccepted = z.infer<typeof jobAcceptedSchema>;

export const analyticsJobSummarySchema = z.object({
  id: z.string().uuid(),
  job_type: z.string(),
  status: analyticsJobStatusSchema,
  result_payload: z.record(z.unknown()).nullable(),
  error: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
  completed_at: z.string().datetime({ offset: true }).nullable(),
});
export type AnalyticsJobSummary = z.infer<typeof analyticsJobSummarySchema>;
export const analyticsJobSchema = analyticsJobSummarySchema.extend({
  owner_id: z.string().uuid(),
  input_payload: z.record(z.unknown()),
  input_fingerprint: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable()
    .optional(),
  started_at: z.string().datetime({ offset: true }).nullable(),
  attempt_count: z.number().int().nonnegative(),
  lease_owner: z.string().nullable(),
  lease_expires_at: z.string().datetime({ offset: true }).nullable(),
  heartbeat_at: z.string().datetime({ offset: true }).nullable(),
  checkpoint_payload: z.record(z.unknown()),
  cancellation_requested: z.boolean(),
});
export type AnalyticsJob = z.infer<typeof analyticsJobSchema>;
