import type {
  AnonymousEnrichmentFinding,
  AnonymousEnrichmentRun,
  AnonymousEvidenceItem,
  AnonymousProperty,
  EnrichmentSource,
} from "../anonymous-workspace/schema";
import { emptyQualificationDimensions } from "../anonymous-workspace/schema";

export const enrichmentSources: EnrichmentSource[] = [
  "bkg_admin",
  "osm_context",
  "bfn_protected",
  "mastr",
  "bkg_heavy_rain",
  "power_finder",
];

export type EnrichmentRequestProperty = {
  propertyId: string;
  latitude: number;
  longitude: number;
  boundary: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
};

export type EnrichmentBatchResponse = {
  releaseFingerprint: string;
  findings: AnonymousEnrichmentFinding[];
  sourceStatus: Record<EnrichmentSource, "complete" | "not_covered" | "unavailable">;
};

export function enrichmentRequest(properties: AnonymousProperty[]): EnrichmentRequestProperty[] {
  return properties.flatMap((property) =>
    property.project.latitude == null || property.project.longitude == null
      ? []
      : [
          {
            propertyId: property.id,
            latitude: property.project.latitude,
            longitude: property.project.longitude,
            boundary: property.boundary,
          },
        ],
  );
}

export async function enrichProperties(
  properties: AnonymousProperty[],
  sources: EnrichmentSource[] = enrichmentSources,
): Promise<EnrichmentBatchResponse> {
  const payload = enrichmentRequest(properties);
  if (!payload.length) throw new Error("At least one property with valid coordinates is required.");
  if (payload.length > 100) throw new Error("Enrich no more than 100 properties at a time.");
  const response = await fetch("/api/properties/enrich", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ properties: payload, sources }),
  });
  const value = (await response.json()) as EnrichmentBatchResponse & { error?: string };
  if (!response.ok) throw new Error(value.error ?? "Property enrichment is unavailable.");
  return value;
}

export function mergeEnrichment(
  property: AnonymousProperty,
  response: EnrichmentBatchResponse,
  startedAt: string,
): AnonymousProperty {
  const incoming = response.findings.filter((item) => item.propertyId === property.id);
  const incomingKeys = new Set(
    incoming.map((item) => `${item.source}:${item.category}:${item.fieldPath}`),
  );
  const retained = (property.enrichmentFindings ?? []).map((item) =>
    incomingKeys.has(`${item.source}:${item.category}:${item.fieldPath}`) &&
    ["proposed", "rejected"].includes(item.status)
      ? { ...item, status: "superseded" as const }
      : item,
  );
  const completedSources = enrichmentSources.filter(
    (source) => response.sourceStatus[source] === "complete",
  );
  const failedSources = enrichmentSources.filter(
    (source) => response.sourceStatus[source] === "unavailable",
  );
  const run: AnonymousEnrichmentRun = {
    id: crypto.randomUUID(),
    status: failedSources.length ? "partial" : "complete",
    requestedSources: enrichmentSources,
    completedSources,
    failedSources,
    startedAt,
    completedAt: new Date().toISOString(),
  };
  return {
    ...property,
    enrichmentFindings: [...incoming, ...retained],
    enrichmentRuns: [run, ...(property.enrichmentRuns ?? [])].slice(0, 20),
    updatedAt: new Date().toISOString(),
  };
}

function evidenceCategory(
  category: AnonymousEnrichmentFinding["category"],
): AnonymousEvidenceItem["category"] {
  if (category === "municipality") return "municipality";
  if (category === "grid") return "grid";
  if (category === "environment") return "environment";
  if (category === "access_logistics" || category === "land") return "property";
  return "property";
}

export function reviewEnrichmentFinding(
  property: AnonymousProperty,
  findingId: string,
  decision: "accept" | "edit" | "reject",
  editedValue?: string,
): AnonymousProperty {
  const finding = property.enrichmentFindings?.find((item) => item.id === findingId);
  if (!finding || finding.status !== "proposed")
    throw new Error("Finding is no longer reviewable.");
  const now = new Date().toISOString();
  const value = decision === "edit" ? (editedValue?.trim() ?? "") : finding.proposedValue;
  if (decision === "edit" && !value) throw new Error("Enter a reviewed value before accepting.");
  const reviewedFinding: AnonymousEnrichmentFinding = {
    ...finding,
    proposedValue: value,
    displayValue: decision === "edit" ? String(value) : finding.displayValue,
    status: decision === "reject" ? "rejected" : decision === "edit" ? "edited" : "accepted",
    reviewedAt: now,
  };
  if (decision === "reject") {
    return {
      ...property,
      evidenceRegister: property.evidenceRegister ?? [],
      enrichmentFindings: property.enrichmentFindings!.map((item) =>
        item.id === findingId ? reviewedFinding : item,
      ),
      updatedAt: now,
    };
  }
  const evidenceId = crypto.randomUUID();
  const evidence: AnonymousEvidenceItem = {
    id: evidenceId,
    category: evidenceCategory(finding.category),
    title: finding.title,
    evidenceClass: "public_source",
    validationStatus: "validated",
    sourceOrganisation: finding.sourceOrganisation,
    sourceReference: `${finding.sourceReference} · release ${finding.releaseId}`,
    sourceUrl: finding.sourceUrl,
    documentId: null,
    issuedAt: finding.observedAt,
    validFrom: null,
    validTo: null,
    claim: `${finding.title}: ${String(value)}`,
    limitations: finding.limitations,
    relatedDimensionKeys: [finding.category],
    createdAt: now,
    updatedAt: now,
  };
  const qualification = (property.qualification ?? emptyQualificationDimensions()).map(
    (dimension) =>
      dimension.key === finding.category
        ? {
            ...dimension,
            evidenceIds: Array.from(new Set([...dimension.evidenceIds, evidenceId])),
            reviewedAt: now,
          }
        : dimension,
  );
  const next: AnonymousProperty = {
    ...property,
    qualification,
    evidenceRegister: [...(property.evidenceRegister ?? []), evidence],
    enrichmentFindings: property.enrichmentFindings!.map((item) =>
      item.id === findingId ? reviewedFinding : item,
    ),
    updatedAt: now,
  };
  if (finding.fieldPath === "municipality") next.municipality = String(value);
  if (finding.fieldPath === "dataCentreProfile.federalState")
    next.dataCentreProfile = { ...next.dataCentreProfile!, federalState: String(value) };
  if (finding.fieldPath === "dataCentreProfile.address") {
    next.dataCentreProfile = { ...next.dataCentreProfile!, address: String(value) };
    next.siteLabel = String(value);
  }
  return next;
}
