import { describe, expect, it } from "vitest";
import { defaultFinderProject } from "../power-finder/finder-project";
import type { AnonymousProperty } from "../anonymous-workspace/schema";
import { buildLocalCapacityDossier } from "./local-dossier";

function property(validTo: string): AnonymousProperty {
  const now = new Date().toISOString();
  return {
    id: "property-1", schemaVersion: 1, name: "Test property", externalPropertyId: null,
    project: { ...defaultFinderProject, latitude: 52.5, longitude: 13.4 }, boundary: null,
    propertyType: "data_centre", propertyCondition: null, requiredItLoadMw: null,
    requiredTotalSiteLoadMw: 100, exportRequirementMw: 0, developmentPhase: null,
    landControlStatus: "unknown", selectedCandidateIds: [], candidateSnapshots: [],
    evidence: { status: "validated", evidenceClass: "operator_response", validationStatus: "validated", n0CapacityMw: 80, n1FirmCapacityMw: 60, flexibleCapacityMw: null, bessAssistedCapacityMw: null, modelVersion: null, studyVersion: null, validFrom: null, validTo, assumptions: [], unresolvedEvidence: [], claimsAndLimitations: [] },
    source: "power_finder", createdAt: now, updatedAt: now,
  };
}

describe("anonymous capacity dossier", () => {
  it("fails closed when otherwise validated evidence is past its validity date", () => {
    const dossier = buildLocalCapacityDossier(property("2000-01-01T00:00:00.000Z"));
    expect(dossier.dossier.fail_closed).toBe(true);
    expect(dossier.dossier.n1_firm_capacity_mw).toBeNull();
  });
});
