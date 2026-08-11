import type { CandidateOpportunity } from "@/features/power-finder/candidate-intelligence";
import type { FinderProject } from "@/features/power-finder/finder-project";
import type { PropertyImportValue } from "@/features/properties/property-import";
import { ANONYMOUS_WORKSPACE_SCHEMA_VERSION, type AnonymousCandidateSnapshot, type AnonymousProperty } from "./schema";

function candidateSnapshot(candidate: CandidateOpportunity): AnonymousCandidateSnapshot {
  return { id: candidate.id, siteName: candidate.siteName, nodeName: candidate.nodeName, operator: candidate.operator, voltageKv: candidate.voltageKv, distanceKm: candidate.distanceKm, screeningRank: candidate.screeningRank, evidenceScore: candidate.evidenceScore, missingEvidence: candidate.missingEvidence, calculationVersion: candidate.calculationVersion, capacityState: "not_established", evidenceClass: "open_mapping", capturedAt: new Date().toISOString() };
}

export function propertyFromFinder(project: FinderProject, candidates: CandidateOpportunity[], existing?: AnonymousProperty | null): AnonymousProperty {
  if (project.latitude == null || project.longitude == null) throw new Error("Declare a property location before saving.");
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? crypto.randomUUID(), schemaVersion: ANONYMOUS_WORKSPACE_SCHEMA_VERSION,
    name: project.name, externalPropertyId: existing?.externalPropertyId ?? null, project,
    boundary: existing?.boundary ?? null, propertyType: existing?.propertyType ?? project.type,
    propertyCondition: existing?.propertyCondition ?? null, requiredItLoadMw: existing?.requiredItLoadMw ?? null,
    requiredTotalSiteLoadMw: project.importMw, exportRequirementMw: project.exportMw,
    developmentPhase: existing?.developmentPhase ?? null, landControlStatus: existing?.landControlStatus ?? "unknown",
    selectedCandidateIds: candidates.map((item) => item.id), candidateSnapshots: candidates.map(candidateSnapshot),
    evidence: existing?.evidence ?? null, source: "power_finder", createdAt: existing?.createdAt ?? now, updatedAt: now,
  };
}

export function propertyFromImport(value: PropertyImportValue, extension: string): AnonymousProperty {
  const now = new Date().toISOString();
  const importedType = value.propertyType?.toLowerCase().replace(/[\s-]+/g, "_");
  const projectType: FinderProject["type"] =
    importedType === "battery_storage" || importedType === "bess" ? "battery_storage"
    : importedType === "co_location" ? "co_location"
    : importedType === "electrolyser" || importedType === "hydrogen" ? "electrolyser"
    : importedType === "charging_hub" || importedType === "ev_charging" ? "charging_hub"
    : importedType === "industrial_load" || importedType === "large_load" ? "industrial_load"
    : "data_centre";
  const project: FinderProject = {
    name: value.propertyName, type: projectType, latitude: value.latitude, longitude: value.longitude,
    importMw: value.requiredTotalSiteLoadMw!, ultimateImportMw: value.requiredTotalSiteLoadMw!, exportMw: value.exportRequirementMw ?? 0,
    minimumFirmMw: value.requiredTotalSiteLoadMw!, flexibleLoadMw: 0, targetEnergisationYear: value.targetEnergisationYear ?? new Date().getFullYear() + 3,
    preferredVoltageKv: null, redundancy: "single_feed", loadProfile: "flat", annualConsumptionGwh: 0,
    maxInterruptionHours: 0, annualInterruptionLimit: 0, batteryPowerMw: 0, batteryEnergyMwh: 0,
    batteryRoundTripEfficiencyPct: 88, batteryReservePct: 20, onsiteGenerationMw: 0, maxDistanceKm: 20, updatedAt: now,
  };
  return { id: crypto.randomUUID(), schemaVersion: ANONYMOUS_WORKSPACE_SCHEMA_VERSION, name: value.propertyName,
    externalPropertyId: value.externalPropertyId, project, boundary: value.boundary, propertyType: value.propertyType,
    propertyCondition: value.propertyCondition, requiredItLoadMw: value.requiredItLoadMw, requiredTotalSiteLoadMw: value.requiredTotalSiteLoadMw,
    exportRequirementMw: value.exportRequirementMw, developmentPhase: value.developmentPhase, landControlStatus: value.landControlStatus,
    selectedCandidateIds: [], candidateSnapshots: [], evidence: null,
    source: extension === "geojson" || extension === "json" ? "geojson_import" : extension === "xlsx" ? "xlsx_import" : "csv_import",
    createdAt: now, updatedAt: now };
}
