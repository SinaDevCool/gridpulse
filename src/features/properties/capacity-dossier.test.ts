import { describe, expect, it } from "vitest";
import { capacityValue, parseCapacityDossier } from "./capacity-dossier";
import { defaultFinderProject } from "../power-finder/finder-project";
import { buildLocalCapacityDossier } from "./local-dossier";
import type { AnonymousProperty } from "../anonymous-workspace/schema";

describe("capacity dossier", () => {
  it("keeps absent capacity unknown", () => expect(capacityValue(null)).toBe("Unknown"));
  it("rejects an incomplete projection", () => expect(() => parseCapacityDossier({ property: {} })).toThrow(/incomplete/));
  it("fails closed when local evidence is stale", () => {
    const now = new Date().toISOString();
    const property = { id: crypto.randomUUID(), schemaVersion: 1, name: "Local", externalPropertyId: null, project: { ...defaultFinderProject, latitude: 52.5, longitude: 13.4 }, boundary: null, propertyType: null, propertyCondition: null, requiredItLoadMw: null, requiredTotalSiteLoadMw: 100, exportRequirementMw: null, developmentPhase: null, landControlStatus: "unknown", selectedCandidateIds: [], candidateSnapshots: [], evidence: { status: "stale", validationStatus: "unverified", evidenceClass: "governed_calculation", n0CapacityMw: 120, n1FirmCapacityMw: 100, flexibleCapacityMw: null, bessAssistedCapacityMw: null, modelVersion: null, studyVersion: null, validFrom: null, validTo: null, assumptions: [], unresolvedEvidence: [], claimsAndLimitations: [] }, source: "power_finder", createdAt: now, updatedAt: now } satisfies AnonymousProperty;
    const dossier = buildLocalCapacityDossier(property);
    expect(dossier.dossier.fail_closed).toBe(true);
    expect(dossier.dossier.n0_capacity_mw).toBeNull();
  });
});
