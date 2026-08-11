import type { AnonymousProperty } from "../anonymous-workspace/schema";
import { projectOperatorQuestions } from "../power-finder/finder-project";
import type { CapacityDossierProjection } from "./capacity-dossier";
import { isAcceptedLocalCapacityEvidence } from "../anonymous-workspace/local-evidence-state";

export function buildLocalCapacityDossier(property: AnonymousProperty): CapacityDossierProjection {
  const evidence = property.evidence;
  const failClosed = !isAcceptedLocalCapacityEvidence(evidence);
  const metric = (value: number | null | undefined) => (failClosed ? null : (value ?? null));
  return {
    property: {
      id: property.id,
      name: property.name,
      external_property_id: property.externalPropertyId,
      latitude: property.project.latitude!,
      longitude: property.project.longitude!,
      property_type: property.propertyType ?? property.project.type,
      confidentiality_classification: "stored_on_device",
    },
    requirements: {
      requested_import_mw: property.project.importMw,
      requested_export_mw: property.project.exportMw,
      required_it_load_mw: property.requiredItLoadMw,
      required_total_site_load_mw: property.requiredTotalSiteLoadMw,
      target_energisation_year: property.project.targetEnergisationYear,
    },
    property_readiness: {
      land_control_status: property.landControlStatus,
      planning_status:
        property.qualification?.find((item) => item.key === "planning")?.status ?? "unknown",
      development_phase: property.developmentPhase,
    },
    dossier: {
      status: evidence?.status ?? "not_calculated",
      evidence_class: evidence?.evidenceClass ?? "public_mapping",
      validation_status: evidence?.validationStatus ?? "unverified",
      n0_capacity_mw: metric(evidence?.n0CapacityMw),
      n1_firm_capacity_mw: metric(evidence?.n1FirmCapacityMw),
      flexible_capacity_mw: metric(evidence?.flexibleCapacityMw),
      bess_assisted_capacity_mw: metric(evidence?.bessAssistedCapacityMw),
      model_version: evidence?.modelVersion ?? null,
      study_version: evidence?.studyVersion ?? null,
      valid_from: evidence?.validFrom ?? null,
      valid_to: evidence?.validTo ?? null,
      assumptions: evidence?.assumptions ?? [
        "Candidate ranking uses mapped context and does not establish capacity.",
      ],
      unresolved_evidence: evidence?.unresolvedEvidence ?? [
        "Available demand headroom is not established.",
        "Responsible operator and connection point require confirmation.",
      ],
      operator_questions: projectOperatorQuestions(property.project),
      claims_and_limitations: evidence?.claimsAndLimitations ?? [
        "This dossier is stored locally and is not a connection offer, reservation, approval, queue statement, or timing guarantee.",
      ],
      fail_closed: failClosed,
    },
    alternatives: property.candidateSnapshots.map((candidate) => ({
      id: candidate.id,
      name: candidate.nodeName,
      distance_km: candidate.distanceKm,
      voltage_kv: candidate.voltageKv.length ? Math.max(...candidate.voltageKv) : null,
      operator: candidate.operator,
      status: "screening",
      capacity_state: candidate.capacityState,
      context_score: candidate.screeningRank,
    })),
  };
}
