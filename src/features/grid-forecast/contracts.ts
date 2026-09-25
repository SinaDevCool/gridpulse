import { z } from "zod";

export const gridStressForecastSchema = z.object({
  schemaVersion: z.literal("gridpulse-grid-stress-public-v1"),
  status: z.enum(["available", "unavailable"]),
  regionCode: z.string(),
  regionName: z.string().optional(),
  issueTime: z.string().datetime().optional(),
  deliveryDay: z.string().date().optional(),
  highStressProbability: z.number().min(0).max(1).optional(),
  redispatchMwhP50: z.number().nonnegative().optional(),
  redispatchMwhP90: z.number().nonnegative().optional(),
  severity: z.enum(["low", "moderate", "high", "critical"]).optional(),
  confidence: z.enum(["high", "medium", "low", "unavailable"]),
  drivers: z.array(z.object({ metric: z.string(), value: z.number(), label: z.string().optional() })).default([]),
  caveats: z.array(z.string()).default([]),
  sourceFreshness: z.record(z.string(), z.unknown()).default({}),
  model: z.object({ name: z.string(), version: z.string(), trainingCutoff: z.string().optional() }).optional(),
  decisionBoundary: z.string(),
  message: z.string().optional(),
});

export type GridStressForecast = z.infer<typeof gridStressForecastSchema>;
