import { z } from "zod";

const evidenceSchema = z.enum([
  "customer_declared",
  "contract_reviewed",
  "operator_confirmed",
  "measured",
  "derived",
  "forecast",
  "reference",
  "simulated",
  "unavailable",
  "unknown",
  "expired",
]);

export const operationsWorkspaceSchema = z.object({
  schemaVersion: z.literal("gridpulse-operations-workspace-v1"),
  generatedAt: z.string().datetime(),
  automaticDispatchAuthorized: z.literal(false),
  facility: z.object({
    id: z.string().uuid(),
    name: z.string(),
    timezone: z.string(),
    contractedImportLimitMw: z.number(),
    limitEvidence: evidenceSchema,
    limitValidUntil: z.string().datetime().nullable(),
  }),
  sources: z.array(z.object({
    id: z.string().uuid(),
    type: z.string(),
    name: z.string(),
    health: z.string(),
    readOnly: z.boolean(),
    lastReceivedAt: z.string().datetime().nullable(),
    latestEventAt: z.string().datetime().nullable(),
    consecutiveFailures: z.number().int().nonnegative(),
    lastErrorCode: z.string().nullable(),
  })),
  measurements: z.array(z.object({
    metricKey: z.string(),
    assetId: z.string(),
    eventAt: z.string().datetime(),
    value: z.number(),
    unit: z.string(),
    valueKind: z.string(),
    quality: z.string(),
    sourceId: z.string().uuid(),
  })),
  batteryAssets: z.array(z.record(z.string(), z.unknown())),
  workloads: z.array(z.record(z.string(), z.unknown())),
  latestForecast: z.record(z.string(), z.unknown()).nullable(),
  latestRecommendation: z.record(z.string(), z.unknown()).nullable(),
  latestVerification: z.record(z.string(), z.unknown()).nullable(),
  dataQuality: z.record(z.string(), z.unknown()).nullable(),
  operatingAgreements: z.array(z.record(z.string(), z.unknown())).default([]),
  calculationRuns: z.array(z.record(z.string(), z.unknown())).default([]),
  dispatchApprovals: z.array(z.record(z.string(), z.unknown())).default([]),
  readiness: z.object({
    mode: z.enum(["scenario", "historical", "shadow", "live_monitoring"]),
    blockers: z.array(z.string()),
    freshestEvidenceAt: z.string().datetime().nullable(),
  }),
});

export type OperationsWorkspace = z.infer<typeof operationsWorkspaceSchema>;
