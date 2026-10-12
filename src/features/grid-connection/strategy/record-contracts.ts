import { z } from "zod";
export const pilotMetricRecordSchema = z.object({ observed_at: z.string() }).passthrough();
export type PilotMetricRecord = z.infer<typeof pilotMetricRecordSchema>;
export const operatorEngagementRecordSchema = z.object({
  estimated_connection_cost_eur: z.number().nullable(),
  indicated_connection_date: z.string().nullable(),
});
export const recordedVersionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
});
export function recordedVersionReply(response: {
  data: unknown;
  error: { message: string } | null;
}):
  | { data: z.infer<typeof recordedVersionSchema>; error: null }
  | { data: null; error: { message: string } } {
  return response.error
    ? { data: null, error: response.error }
    : { data: recordedVersionSchema.parse(response.data), error: null };
}
