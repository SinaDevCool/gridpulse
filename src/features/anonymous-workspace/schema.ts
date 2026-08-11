import type { MultiPolygon, Polygon } from "geojson";
import type { CandidateOpportunity } from "@/features/power-finder/candidate-intelligence";
import type { FinderProject } from "@/features/power-finder/finder-project";

export const ANONYMOUS_WORKSPACE_SCHEMA_VERSION = 3;

export type AnonymousDecisionStatus = "unreviewed" | "advance" | "hold" | "reject";

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
  preferredCandidateId: string | null;
  dataCentreProfile?: DataCentrePropertyProfile;
  qualification?: QualificationDimension[];
  evidenceRegister?: AnonymousEvidenceItem[];
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
