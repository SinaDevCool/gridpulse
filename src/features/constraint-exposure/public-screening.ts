import type { ConstraintExposureItem } from "./contracts";

const sharedPublicBoundary = {
  validationStatus: "needs_review" as const,
  sourceEvidenceIds: [] as string[],
  assumptions: ["Regional evidence is not a connection-point capacity assessment."],
  limitations: ["Equipment ratings and operator security criteria are not public in this view."],
  operatorValidationRequired: true as const,
};

/**
 * Product demonstration records owned by the constraint domain. They are never
 * operator-confirmed and are shared by map, ranked list, details, and reports.
 */
export const publicConstraintScreening: readonly ConstraintExposureItem[] = [
  {
    id: "regional-redispatch",
    name: "Regional redispatch signal",
    category: "generation",
    severity: "high",
    locationPrecision: "regional",
    affectedAssetOrRegion: "North-west Germany",
    loadingPercent: null,
    remainingMarginMw: null,
    bindingFrequencyPercent: null,
    siteSensitivity: null,
    direction: "unknown",
    scenario: "Observed public context",
    requiredAction: "Request operator confirmation for the proposed connection point.",
    provenance: {
      ...sharedPublicBoundary,
      evidenceClass: "public_source",
      confidence: "indicative",
      method: "Regional public-signal screening",
    },
  },
  {
    id: "n1-corridor",
    name: "N-1 corridor exposure",
    category: "thermal",
    severity: "moderate",
    locationPrecision: "regional",
    affectedAssetOrRegion: "Illustrative study corridor",
    loadingPercent: null,
    remainingMarginMw: null,
    bindingFrequencyPercent: null,
    siteSensitivity: null,
    direction: "aggravating",
    scenario: "Illustrative contingency scenario",
    requiredAction: "Run a project-specific canonical network assessment.",
    provenance: {
      ...sharedPublicBoundary,
      evidenceClass: "derived",
      confidence: "indicative",
      method: "Illustrative N-1 screening",
    },
  },
  {
    id: "data-gap",
    name: "Equipment rating gap",
    category: "data_uncertainty",
    severity: "critical",
    locationPrecision: "unknown",
    affectedAssetOrRegion: "Candidate connection context",
    loadingPercent: null,
    remainingMarginMw: null,
    bindingFrequencyPercent: null,
    siteSensitivity: null,
    direction: "unknown",
    scenario: "Evidence completeness check",
    requiredAction: "Obtain accepted ratings and applicable security criteria.",
    provenance: {
      ...sharedPublicBoundary,
      evidenceClass: "derived",
      confidence: "unverified",
      method: "Evidence gap detection",
    },
  },
] as const;
