import { candidateSnapshot } from "@/features/anonymous-workspace/factory";
import { saveAnonymousProperty } from "@/features/anonymous-workspace/repository";
import { applyScreeningAssessments } from "@/features/anonymous-workspace/screening-assessment";
import type {
  AnonymousEnrichmentRun,
  AnonymousProperty,
  GridScreeningSnapshot,
} from "@/features/anonymous-workspace/schema";
import { rankCandidatesForLocation } from "@/features/power-finder/candidate-intelligence";
import { loadPowerFinderViewport } from "@/features/power-finder/data-source";
import { enrichProperties, mergeEnrichment } from "./property-enrichment";

export type PropertyScreeningProgress = {
  propertyId: string;
  propertyName: string;
  status: AnonymousEnrichmentRun["screeningStatus"];
  completed: number;
  total: number;
  message: string;
};

function rankingBounds(property: AnonymousProperty) {
  const latitude = property.project.latitude!;
  const longitude = property.project.longitude!;
  const radius = property.project.maxDistanceKm;
  const latitudeRadius = Math.max(0.08, radius / 111);
  const longitudeRadius = Math.max(
    0.08,
    radius / (111 * Math.max(0.3, Math.cos((latitude * Math.PI) / 180))),
  );
  return {
    west: longitude - longitudeRadius,
    south: latitude - latitudeRadius,
    east: longitude + longitudeRadius,
    north: latitude + latitudeRadius,
  };
}

function pendingRun(
  property: AnonymousProperty,
  startedBy: AnonymousEnrichmentRun["startedBy"],
): AnonymousEnrichmentRun {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    status: "running",
    releaseFingerprint: "pending",
    screeningStatus: "queued",
    sourceResults: [],
    startedBy,
    requestedSources: [
      "bkg_admin",
      "osm_context",
      "bfn_protected",
      "mastr",
      "bkg_heavy_rain",
      "power_finder",
    ],
    completedSources: [],
    failedSources: [],
    startedAt: now,
    completedAt: null,
  };
}

export async function screenProperty(
  input: AnonymousProperty,
  startedBy: AnonymousEnrichmentRun["startedBy"] = "manual_refresh",
  onStatus?: (status: AnonymousEnrichmentRun["screeningStatus"], message: string) => void,
  sources?: AnonymousEnrichmentRun["requestedSources"],
): Promise<AnonymousProperty> {
  if (input.project.latitude == null || input.project.longitude == null) {
    throw new Error(`${input.name} requires coordinates before screening.`);
  }
  const latitude = input.project.latitude;
  const longitude = input.project.longitude;
  let property: AnonymousProperty = {
    ...input,
    enrichmentRuns: [{ ...pendingRun(input, startedBy) }, ...(input.enrichmentRuns ?? [])].slice(
      0,
      20,
    ),
  };
  await saveAnonymousProperty(property);
  const updateRun = (screeningStatus: AnonymousEnrichmentRun["screeningStatus"]) => {
    property = {
      ...property,
      enrichmentRuns: property.enrichmentRuns!.map((run, index) =>
        index === 0 ? { ...run, screeningStatus } : run,
      ),
    };
  };
  try {
    updateRun("enriching");
    onStatus?.("enriching", "Checking accepted public-source releases");
    const startedAt = property.enrichmentRuns![0].startedAt;
    const enrichment = await enrichProperties([property], sources);
    property = mergeEnrichment(property, enrichment, startedAt, startedBy);
    property = {
      ...property,
      enrichmentRuns: property.enrichmentRuns?.filter(
        (run, index) => index === 0 || run.releaseFingerprint !== "pending",
      ),
    };

    updateRun("screening_grid");
    onStatus?.("screening_grid", "Ranking mapped connection hypotheses");
    const { collection } = await loadPowerFinderViewport(rankingBounds(property), undefined, {
      fallbackAllowed: true,
    });
    const ranked = rankCandidatesForLocation(
      collection,
      longitude,
      latitude,
      property.project.importMw,
      property.project.maxDistanceKm,
      property.name,
    );
    const top = ranked.candidates.slice(0, 3);
    const captured = top.map(candidateSnapshot);
    const capturedIds = new Set(captured.map((item) => item.id));
    const retained = property.candidateSnapshots.filter((item) => !capturedIds.has(item.id));
    const screenedAt = new Date().toISOString();
    const gridSnapshot: GridScreeningSnapshot = {
      id: crypto.randomUUID(),
      propertyId: property.id,
      status: top.length ? "complete" : "partial",
      candidateIds: captured.map((item) => item.id),
      recommendedCandidateId: captured[0]?.id ?? null,
      shortlistedCandidateId: property.preferredCandidateId,
      calculationVersion: top[0]?.calculationVersion ?? "unavailable",
      releaseFingerprint: enrichment.releaseFingerprint,
      screenedAt,
    };

    updateRun("deriving");
    onStatus?.("deriving", "Deriving reviewable screening assessments");
    property = applyScreeningAssessments({
      ...property,
      candidateSnapshots: [...captured, ...retained],
      selectedCandidateIds: Array.from(new Set([...property.selectedCandidateIds, ...capturedIds])),
      recommendedCandidateId: gridSnapshot.recommendedCandidateId,
      gridScreeningSnapshots: [gridSnapshot, ...(property.gridScreeningSnapshots ?? [])].slice(
        0,
        20,
      ),
      operatorEngagement: {
        ...property.operatorEngagement!,
        operatorName: property.operatorEngagement?.operatorName ?? top[0]?.operator ?? null,
        responsibilityStatus: property.operatorEngagement?.responsibilityStatus ?? "screening_only",
      },
      updatedAt: screenedAt,
    });
    const reviewRequired = (property.enrichmentFindings ?? []).some(
      (item) => item.status === "proposed",
    );
    property = {
      ...property,
      enrichmentRuns: property.enrichmentRuns!.map((run, index) =>
        index === 0
          ? {
              ...run,
              screeningStatus: reviewRequired ? "review_required" : "complete",
              status: run.failedSources.length ? "partial" : "complete",
              completedAt: screenedAt,
            }
          : run,
      ),
    };
    await saveAnonymousProperty(property);
    onStatus?.(
      reviewRequired ? "review_required" : "complete",
      "Screening saved to the site workspace",
    );
    return property;
  } catch (error) {
    const failedAt = new Date().toISOString();
    property = {
      ...property,
      enrichmentRuns: property.enrichmentRuns!.map((run, index) =>
        index === 0
          ? { ...run, status: "failed", screeningStatus: "failed", completedAt: failedAt }
          : run,
      ),
      updatedAt: failedAt,
    };
    await saveAnonymousProperty(property);
    throw error;
  }
}

export async function screenPropertyPortfolio(
  properties: AnonymousProperty[],
  onProgress?: (progress: PropertyScreeningProgress) => void,
) {
  const results: AnonymousProperty[] = [];
  const failures: Array<{ property: AnonymousProperty; error: string }> = [];
  for (let index = 0; index < properties.length; index += 1) {
    const property = properties[index];
    try {
      const result = await screenProperty(property, "import", (status, message) =>
        onProgress?.({
          propertyId: property.id,
          propertyName: property.name,
          status,
          completed: index,
          total: properties.length,
          message,
        }),
      );
      results.push(result);
      onProgress?.({
        propertyId: property.id,
        propertyName: property.name,
        status: result.enrichmentRuns?.[0]?.screeningStatus ?? "complete",
        completed: index + 1,
        total: properties.length,
        message: "Site screening complete",
      });
    } catch (error) {
      failures.push({
        property,
        error: error instanceof Error ? error.message : "Screening failed",
      });
      onProgress?.({
        propertyId: property.id,
        propertyName: property.name,
        status: "failed",
        completed: index + 1,
        total: properties.length,
        message: "Screening requires retry",
      });
    }
  }
  return { results, failures };
}
