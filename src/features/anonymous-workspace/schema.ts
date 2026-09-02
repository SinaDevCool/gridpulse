import type { MultiPolygon, Polygon } from "geojson";
import type { CandidateOpportunity } from "@/features/power-finder/candidate-intelligence";
import type { FinderProject } from "@/features/power-finder/finder-project";

export const ANONYMOUS_WORKSPACE_SCHEMA_VERSION = 6;

export type AnonymousDecisionStatus = "unreviewed" | "advance" | "hold" | "reject";

export type AnonymousDecisionEvent = {
  id: string;
  previousStatus: AnonymousDecisionStatus;
  status: AnonymousDecisionStatus;
  provisional: boolean;
  rationale: string | null;
  preferredCandidateId: string | null;
  evidenceIds: string[];
  actorLabel: string;
  recordedAt: string;
};

export type QualificationDimensionKey =
  | "land"
  | "planning"
  | "grid"
  | "fibre"
  | "water_cooling"
  | "environment"
  | "neighbours"
  | "access_logistics"
  | "backup_generation"
  | "heat_reuse"
  | "municipality";

export type QualificationDimension = {
  key: QualificationDimensionKey;
  status: "unknown" | "favourable" | "conditional" | "adverse";
  summary: string | null;
  evidenceIds: string[];
  reviewedAt: string | null;
};

export type AnonymousEvidenceItem = {
  id: string;
  category:
    | "property"
    | "planning"
    | "grid"
    | "operator"
    | "fibre"
    | "environment"
    | "commercial"
    | "municipality";
  title: string;
  evidenceClass: "customer_declared" | "public_source" | "derived" | "operator_confirmed";
  validationStatus: "unverified" | "collected" | "validated" | "rejected" | "expired";
  sourceOrganisation: string | null;
  sourceReference: string | null;
  sourceUrl: string | null;
  documentId: string | null;
  issuedAt: string | null;
  validFrom: string | null;
  validTo: string | null;
  claim: string;
  limitations: string[];
  relatedDimensionKeys: QualificationDimensionKey[];
  createdAt: string;
  updatedAt: string;
};

export type EnrichmentSource =
  | "bkg_admin"
  | "osm_context"
  | "bfn_protected"
  | "mastr"
  | "bkg_heavy_rain"
  | "power_finder";

export type AnonymousEnrichmentFinding = {
  id: string;
  propertyId: string;
  source: EnrichmentSource;
  category: QualificationDimensionKey;
  fieldPath: "municipality" | "dataCentreProfile.federalState" | "dataCentreProfile.address" | null;
  title: string;
  displayValue: string;
  proposedValue: string | number | boolean | null;
  status: "proposed" | "accepted" | "edited" | "rejected" | "superseded";
  confidence: "high" | "medium" | "low";
  method: "point_in_polygon" | "intersection" | "nearest" | "radius_aggregate";
  sourceOrganisation: string;
  sourceReference: string;
  sourceUrl: string;
  licence: string;
  releaseId: string;
  observedAt: string | null;
  retrievedAt: string;
  coverage: "available" | "not_covered" | "unavailable";
  limitations: string[];
  reviewedAt: string | null;
  findingKey: string;
  polarity: "positive" | "neutral" | "constraint" | "unknown";
  screeningEffect: "supports" | "constraint" | "context" | "none";
  distanceMetres: number | null;
  geometryRelation: "contains" | "intersects" | "nearest" | "within_radius" | "none" | null;
  supersedesFindingId: string | null;
  automaticallyDerived: boolean;
};

export type SourceRunResult = {
  source: EnrichmentSource;
  status: "succeeded" | "unavailable" | "timed_out" | "not_covered" | "failed";
  findingCount: number;
  releaseId: string | null;
  checkedAt: string;
  limitation: string | null;
};

export type AnonymousEnrichmentRun = {
  id: string;
  status: "running" | "complete" | "partial" | "failed";
  releaseFingerprint: string;
  screeningStatus:
    | "queued"
    | "enriching"
    | "screening_grid"
    | "deriving"
    | "review_required"
    | "complete"
    | "partial"
    | "failed";
  sourceResults: SourceRunResult[];
  startedBy: "import" | "manual_refresh" | "finder_save";
  requestedSources: EnrichmentSource[];
  completedSources: EnrichmentSource[];
  failedSources: EnrichmentSource[];
  startedAt: string;
  completedAt: string | null;
};

export type ScreeningAssessment = {
  dimensionKey: QualificationDimensionKey;
  state: "screened" | "constraint_detected" | "unknown";
  summary: string;
  sourceFindingIds: string[];
  confidence: "high" | "medium" | "low";
  derivedAt: string;
  ruleVersion: string;
  requiresConfirmation: boolean;
};

export type GridScreeningSnapshot = {
  id: string;
  propertyId: string;
  status: "complete" | "partial" | "failed";
  candidateIds: string[];
  recommendedCandidateId: string | null;
  shortlistedCandidateId: string | null;
  calculationVersion: string;
  releaseFingerprint: string;
  screenedAt: string;
};

export type AnonymousOperatorEngagement = {
  operatorName: string | null;
  operatorLevel: "dso" | "tso" | "unknown";
  responsibilityStatus: "screening_only" | "customer_confirmed" | "operator_confirmed";
  enquiryStatus:
    | "not_started"
    | "preparing"
    | "submitted"
    | "acknowledged"
    | "response_received"
    | "closed";
  enquiryReference: string | null;
  submittedAt: string | null;
  acknowledgedAt: string | null;
  respondedAt: string | null;
  requestedImportMw: number | null;
  requestedExportMw: number | null;
  requestedVoltageKv: number | null;
  indicatedConnectionPoint: string | null;
  indicatedCapacityMw: number | null;
  indicatedCostEur: number | null;
  indicatedDeliveryDate: string | null;
  evidenceIds: string[];
  nextAction: string | null;
  nextActionDueAt: string | null;
  correspondence: Array<{
    id: string;
    occurredAt: string;
    channel: "email" | "letter" | "call" | "meeting" | "portal";
    direction: "outbound" | "inbound" | "internal";
    subject: string;
    summary: string;
  }>;
};

export type DataCentrePropertyProfile = {
  address: string | null;
  federalState: string | null;
  cadastralReference: string | null;
  siteAreaHectares: number | null;
  developableAreaHectares: number | null;
  expansionAreaHectares: number | null;
  transactionStructure: "unknown" | "purchase" | "lease" | "option" | "joint_venture";
  minimumViableLoadMw: number | null;
  targetEnergisationDate: string | null;
};

export type AnonymousDocumentMetadata = {
  id: string;
  propertyId: string;
  name: string;
  mimeType: string;
  size: number;
  hash: string;
  sourceClassification: string;
  reviewStatus: "unreviewed" | "reviewed" | "accepted" | "rejected";
  createdAt: string;
};

export type AnonymousWorkspaceSettings = {
  organisationName: string;
  preparedFor: string;
  confidentialityLabel: string;
  reportFooter: string;
  accentColour: string;
};

export const qualificationDimensionKeys: QualificationDimensionKey[] = [
  "land",
  "planning",
  "grid",
  "fibre",
  "water_cooling",
  "environment",
  "neighbours",
  "access_logistics",
  "backup_generation",
  "heat_reuse",
  "municipality",
];

export function emptyQualificationDimensions(): QualificationDimension[] {
  return qualificationDimensionKeys.map((key) => ({
    key,
    status: "unknown",
    summary: null,
    evidenceIds: [],
    reviewedAt: null,
  }));
}

export const defaultWorkspaceSettings: AnonymousWorkspaceSettings = {
  organisationName: "GridPulse",
  preparedFor: "",
  confidentialityLabel: "Confidential",
  reportFooter: "Preliminary decision support — not a connection offer or capacity reservation.",
  accentColour: "#22d3ee",
};

export type AnonymousPropertySource =
  | "power_finder"
  | "csv_import"
  | "xlsx_import"
  | "geojson_import"
  | "workspace_restore";

export type AnonymousCandidateSnapshot = Pick<
  CandidateOpportunity,
  | "id"
  | "siteName"
  | "nodeName"
  | "operator"
  | "voltageKv"
  | "distanceKm"
  | "screeningRank"
  | "evidenceScore"
  | "missingEvidence"
  | "calculationVersion"
> & {
  capacityState: string;
  evidenceClass: string;
  capturedAt: string;
};

export type LocalCapacityEvidence = {
  status: "not_calculated" | "calculated" | "validated" | "stale" | "failed";
  validationStatus: "unverified" | "validated" | "rejected" | "expired";
  evidenceClass: string;
  n0CapacityMw: number | null;
  n1FirmCapacityMw: number | null;
  flexibleCapacityMw: number | null;
  bessAssistedCapacityMw: number | null;
  modelVersion: string | null;
  studyVersion: string | null;
  validFrom: string | null;
  validTo: string | null;
  assumptions: unknown[];
  unresolvedEvidence: unknown[];
  claimsAndLimitations: unknown[];
};

export type AnonymousProperty = {
  id: string;
  schemaVersion: number;
  name: string;
  externalPropertyId: string | null;
  project: FinderProject;
  boundary: Polygon | MultiPolygon | null;
  propertyType: string | null;
  propertyCondition: "greenfield" | "brownfield" | "existing" | null;
  requiredItLoadMw: number | null;
  requiredTotalSiteLoadMw: number | null;
  exportRequirementMw: number | null;
  developmentPhase: string | null;
  landControlStatus: "unknown" | "identified" | "optioned" | "controlled";
  municipality: string | null;
  siteLabel: string | null;
  decisionStatus: AnonymousDecisionStatus;
  decisionRationale: string | null;
  decisionEvents?: AnonymousDecisionEvent[];
  preferredCandidateId: string | null;
  dataCentreProfile?: DataCentrePropertyProfile;
  qualification?: QualificationDimension[];
  evidenceRegister?: AnonymousEvidenceItem[];
  enrichmentFindings?: AnonymousEnrichmentFinding[];
  enrichmentRuns?: AnonymousEnrichmentRun[];
  screeningAssessments?: ScreeningAssessment[];
  gridScreeningSnapshots?: GridScreeningSnapshot[];
  recommendedCandidateId?: string | null;
  operatorEngagement?: AnonymousOperatorEngagement;
  selectedCandidateIds: string[];
  candidateSnapshots: AnonymousCandidateSnapshot[];
  evidence: LocalCapacityEvidence | null;
  source: AnonymousPropertySource;
  createdAt: string;
  updatedAt: string;
};

export type AnonymousWorkspaceBackup = {
  product: "gridpulse-anonymous-workspace";
  schemaVersion: number;
  exportedAt: string;
  properties: AnonymousProperty[];
  settings?: AnonymousWorkspaceSettings;
  documents?: AnonymousDocumentMetadata[];
  documentFiles?: Array<{ metadata: AnonymousDocumentMetadata; base64: string }>;
};

export function isAnonymousProperty(value: unknown): value is AnonymousProperty {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AnonymousProperty>;
  return Boolean(
    item.id &&
    item.name &&
    item.project &&
    typeof item.project === "object" &&
    Array.isArray(item.selectedCandidateIds) &&
    Array.isArray(item.candidateSnapshots) &&
    item.createdAt &&
    item.updatedAt,
  );
}

export function migrateAnonymousProperty(value: unknown): AnonymousProperty {
  if (!isAnonymousProperty(value)) throw new Error("The property record is invalid.");
  const property = value as AnonymousProperty;
  const candidate = property.candidateSnapshots?.find(
    (item) => item.id === property.preferredCandidateId,
  );
  const qualification = emptyQualificationDimensions().map((fallback) => {
    const existing = property.qualification?.find((item) => item.key === fallback.key);
    return existing
      ? { ...fallback, ...existing, evidenceIds: existing.evidenceIds ?? [] }
      : fallback;
  });
  const migrateFinding = (item: AnonymousEnrichmentFinding): AnonymousEnrichmentFinding => ({
    ...item,
    findingKey:
      item.findingKey ??
      `${item.source}:${item.propertyId}:${item.category}:${item.sourceReference}:${item.title}`,
    polarity: item.polarity ?? "neutral",
    screeningEffect: item.screeningEffect ?? "context",
    distanceMetres: item.distanceMetres ?? null,
    geometryRelation: item.geometryRelation ?? null,
    supersedesFindingId: item.supersedesFindingId ?? null,
    automaticallyDerived: item.automaticallyDerived ?? true,
  });
  return {
    ...property,
    schemaVersion: ANONYMOUS_WORKSPACE_SCHEMA_VERSION,
    municipality: typeof property.municipality === "string" ? property.municipality : null,
    siteLabel: typeof property.siteLabel === "string" ? property.siteLabel : null,
    decisionStatus: ["advance", "hold", "reject"].includes(property.decisionStatus)
      ? property.decisionStatus
      : "unreviewed",
    decisionRationale:
      typeof property.decisionRationale === "string" ? property.decisionRationale : null,
    decisionEvents: Array.isArray(property.decisionEvents) ? property.decisionEvents : [],
    preferredCandidateId:
      typeof property.preferredCandidateId === "string" ? property.preferredCandidateId : null,
    dataCentreProfile: {
      address: property.dataCentreProfile?.address ?? property.siteLabel ?? null,
      federalState: property.dataCentreProfile?.federalState ?? null,
      cadastralReference: property.dataCentreProfile?.cadastralReference ?? null,
      siteAreaHectares: property.dataCentreProfile?.siteAreaHectares ?? null,
      developableAreaHectares: property.dataCentreProfile?.developableAreaHectares ?? null,
      expansionAreaHectares: property.dataCentreProfile?.expansionAreaHectares ?? null,
      transactionStructure: property.dataCentreProfile?.transactionStructure ?? "unknown",
      minimumViableLoadMw:
        property.dataCentreProfile?.minimumViableLoadMw ?? property.project.minimumFirmMw ?? null,
      targetEnergisationDate: property.dataCentreProfile?.targetEnergisationDate ?? null,
    },
    qualification,
    evidenceRegister: Array.isArray(property.evidenceRegister) ? property.evidenceRegister : [],
    enrichmentFindings: Array.isArray(property.enrichmentFindings)
      ? property.enrichmentFindings.map(migrateFinding)
      : [],
    enrichmentRuns: Array.isArray(property.enrichmentRuns)
      ? property.enrichmentRuns.map((run) => ({
          ...run,
          releaseFingerprint: run.releaseFingerprint ?? "legacy",
          screeningStatus:
            run.screeningStatus ?? (run.status === "complete" ? "complete" : run.status),
          sourceResults:
            run.sourceResults ??
            run.requestedSources.map((source) => ({
              source,
              status: run.completedSources.includes(source)
                ? ("succeeded" as const)
                : ("unavailable" as const),
              findingCount: 0,
              releaseId: null,
              checkedAt: run.completedAt ?? run.startedAt,
              limitation: "Migrated from a legacy enrichment run without explicit coverage.",
            })),
          startedBy: run.startedBy ?? "manual_refresh",
        }))
      : [],
    screeningAssessments: Array.isArray(property.screeningAssessments)
      ? property.screeningAssessments
      : [],
    gridScreeningSnapshots: Array.isArray(property.gridScreeningSnapshots)
      ? property.gridScreeningSnapshots
      : [],
    recommendedCandidateId:
      typeof property.recommendedCandidateId === "string" ? property.recommendedCandidateId : null,
    operatorEngagement: {
      operatorName: property.operatorEngagement?.operatorName ?? candidate?.operator ?? null,
      operatorLevel: property.operatorEngagement?.operatorLevel ?? "unknown",
      responsibilityStatus: property.operatorEngagement?.responsibilityStatus ?? "screening_only",
      enquiryStatus: property.operatorEngagement?.enquiryStatus ?? "not_started",
      enquiryReference: property.operatorEngagement?.enquiryReference ?? null,
      submittedAt: property.operatorEngagement?.submittedAt ?? null,
      acknowledgedAt: property.operatorEngagement?.acknowledgedAt ?? null,
      respondedAt: property.operatorEngagement?.respondedAt ?? null,
      requestedImportMw:
        property.operatorEngagement?.requestedImportMw ??
        property.requiredTotalSiteLoadMw ??
        property.project.importMw,
      requestedExportMw:
        property.operatorEngagement?.requestedExportMw ??
        property.exportRequirementMw ??
        property.project.exportMw,
      requestedVoltageKv:
        property.operatorEngagement?.requestedVoltageKv ?? property.project.preferredVoltageKv,
      indicatedConnectionPoint: property.operatorEngagement?.indicatedConnectionPoint ?? null,
      indicatedCapacityMw: property.operatorEngagement?.indicatedCapacityMw ?? null,
      indicatedCostEur: property.operatorEngagement?.indicatedCostEur ?? null,
      indicatedDeliveryDate: property.operatorEngagement?.indicatedDeliveryDate ?? null,
      evidenceIds: property.operatorEngagement?.evidenceIds ?? [],
      nextAction: property.operatorEngagement?.nextAction ?? null,
      nextActionDueAt: property.operatorEngagement?.nextActionDueAt ?? null,
      correspondence: property.operatorEngagement?.correspondence ?? [],
    },
  };
}
