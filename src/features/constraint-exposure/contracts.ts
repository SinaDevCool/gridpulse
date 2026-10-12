import { z } from "zod";

export const evidenceClassSchema = z.enum([
  "customer_declared",
  "public_source",
  "derived",
  "operator_confirmed",
]);
export const confidenceSchema = z.enum(["unverified", "indicative", "supported", "confirmed"]);
export const validationStatusSchema = z.enum([
  "missing",
  "collected",
  "needs_review",
  "validated",
  "rejected",
  "expired",
]);
export const locationPrecisionSchema = z.enum([
  "exact_published",
  "street",
  "postcode",
  "municipality",
  "regional",
  "unknown",
]);
export const provenanceSchema = z.object({
  evidenceClass: evidenceClassSchema,
  confidence: confidenceSchema,
  validationStatus: validationStatusSchema,
  sourceEvidenceIds: z.array(z.string()),
  method: z.string().optional(),
  assumptions: z.array(z.string()),
  limitations: z.array(z.string()),
  operatorValidationRequired: z.boolean(),
  observedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const constraintExposureItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum([
    "thermal",
    "transformer",
    "voltage",
    "generation",
    "data_uncertainty",
    "other",
  ]),
  severity: z.enum(["low", "moderate", "high", "critical", "unknown"]),
  locationPrecision: locationPrecisionSchema,
  affectedAssetOrRegion: z.string().min(1),
  loadingPercent: z.number().nonnegative().nullable(),
  remainingMarginMw: z.number().nullable(),
  bindingFrequencyPercent: z.number().min(0).max(100).nullable(),
  siteSensitivity: z.number().nullable(),
  direction: z.enum(["aggravating", "relieving", "neutral", "unknown"]),
  scenario: z.string().min(1),
  requiredAction: z.string().min(1),
  provenance: provenanceSchema,
});

export const mitigationComparisonSchema = z.object({
  id: z.string(),
  name: z.string(),
  requestedImportMw: z.number().nonnegative(),
  residualSeverity: z.enum(["low", "moderate", "high", "critical", "unknown"]),
  affectedConstraintCount: z.number().int().nonnegative(),
  status: z.enum(["supplied_outcome", "requires_analysis", "requires_operator_study"]),
  changedAssumptions: z.array(z.string()),
});

export const constraintExposureSchema = z.object({
  schemaVersion: z.literal("gridpulse-constraint-exposure-v1"),
  id: z.string(),
  projectId: z.string().nullable(),
  siteId: z.string().nullable(),
  status: z.enum(["available", "partial", "blocked", "not_assessed"]),
  assessmentScope: z.object({
    requestedImportMw: z.number().nonnegative(),
    horizon: z.string(),
    caseType: z.enum(["observed", "base_case", "contingency", "scenario_set"]),
  }),
  constraints: z.array(constraintExposureItemSchema),
  mitigations: z.array(mitigationComparisonSchema),
  blockers: z.array(z.string()),
  provenance: provenanceSchema,
  generatedAt: z.string().datetime(),
  fingerprint: z.string().regex(/^[a-fA-F0-9]{64}$/),
});

export type ConstraintExposure = z.infer<typeof constraintExposureSchema>;
export type ConstraintExposureItem = z.infer<typeof constraintExposureItemSchema>;
