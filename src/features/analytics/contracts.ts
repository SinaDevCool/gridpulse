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
