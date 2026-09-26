import { describe, expect, it } from "vitest";
import { defaultFinderProject } from "../power-finder/finder-project";
import { migrateAnonymousProperty } from "./schema";

describe("anonymous workspace schema migration", () => {
  it("upgrades a version 1 property without losing its screening data", () => {
    const now = new Date().toISOString();
    const migrated = migrateAnonymousProperty({
      id: "legacy",
      schemaVersion: 1,
      name: "Legacy Site",
      externalPropertyId: null,
      project: { ...defaultFinderProject, latitude: 52.5, longitude: 13.4 },
      boundary: null,
      propertyType: "data_centre",
      propertyCondition: null,
      requiredItLoadMw: null,
      requiredTotalSiteLoadMw: 100,
      exportRequirementMw: 0,
      developmentPhase: null,
      landControlStatus: "unknown",
      selectedCandidateIds: [],
      candidateSnapshots: [],
      evidence: null,
      source: "power_finder",
      createdAt: now,
      updatedAt: now,
    });
    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.decisionStatus).toBe("unreviewed");
    expect(migrated.preferredCandidateId).toBeNull();
    expect(migrated.qualification).toHaveLength(11);
    expect(migrated.evidenceRegister).toEqual([]);
    expect(migrated.operatorEngagement?.enquiryStatus).toBe("not_started");
    expect(migrated.project.importMw).toBe(100);
  });
});
