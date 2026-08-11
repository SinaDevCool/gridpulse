import type { AnonymousProperty } from "@/features/anonymous-workspace/schema";
import { projectAnonymousProperty } from "@/features/anonymous-workspace/portfolio-projection";
import type { ExportableProperty } from "@/features/properties/property-export";

export function portfolioExportRow(property: AnonymousProperty): ExportableProperty | null {
  if (property.project.latitude == null || property.project.longitude == null) return null;
  const site = projectAnonymousProperty(property);
  return {
    id: property.id,
    name: property.name,
    project_type: site.projectType,
    latitude: property.project.latitude,
    longitude: property.project.longitude,
    requested_import_mw: site.requiredMw,
    requested_export_mw: property.exportRequirementMw ?? property.project.exportMw,
    likely_network_operator: site.operator,
    operator_status: site.operator ? "screening_context" : "not_assessed",
    planning_status: "not_assessed",
    land_status: property.landControlStatus,
    assessment_status: property.decisionStatus,
    qualification_readiness: site.qualificationReadiness,
    operator_engagement_status: site.operatorEngagementStage,
    critical_blockers: site.criticalBlockers,
    boundary: property.boundary,
  };
}
