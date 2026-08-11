import type { MultiPolygon, Polygon } from "geojson";
import type { CandidateOpportunity } from "@/features/power-finder/candidate-intelligence";
import type { FinderProject } from "@/features/power-finder/finder-project";

export const ANONYMOUS_WORKSPACE_SCHEMA_VERSION = 1;

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
