import { describe, expect, it } from "vitest";
import {
  deriveQualification,
  operatorReadiness,
  updateQualificationDimension,
} from "./data-centre-qualification";
import { migrateAnonymousProperty } from "./schema";

const legacy = {
  id: "00000000-0000-4000-8000-000000000001",
  schemaVersion: 2,
  name: "Bremen Campus",
  externalPropertyId: null,
  project: {
    name: "Bremen Campus",
    type: "data_centre",
    latitude: 53,
    longitude: 8.8,
    importMw: 80,
    exportMw: 0,
    minimumFirmMw: 40,
    preferredVoltageKv: 110,
    targetEnergisationYear: 2030,
  },
  boundary: null,
  propertyType: "data_centre",
  propertyCondition: "brownfield",
  requiredItLoadMw: 60,
  requiredTotalSiteLoadMw: 80,
  exportRequirementMw: 0,
  developmentPhase: "screening",
  landControlStatus: "unknown",
  municipality: "Bremen",
  siteLabel: null,
  decisionStatus: "unreviewed",
  decisionRationale: null,
  preferredCandidateId: null,
  selectedCandidateIds: [],
  candidateSnapshots: [],
  evidence: null,
  source: "csv_import",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("data-centre qualification", () => {
  it("migrates legacy sites fail-closed", () => {
    const property = migrateAnonymousProperty(legacy);
    expect(property.schemaVersion).toBe(6);
    expect(deriveQualification(property).readiness).toBe(0);
    expect(deriveQualification(property).criticalBlockers).toHaveLength(3);
  });

  it("does not count unsupported favourable claims", () => {
    const property = migrateAnonymousProperty(legacy);
    property.qualification = updateQualificationDimension(property.qualification!, "land", {
      status: "favourable",
    });
    expect(deriveQualification(property).unsupported[0].key).toBe("land");
    expect(operatorReadiness(property).score).toBeGreaterThanOrEqual(0);
  });

  it("does not allow merely collected screening evidence to resolve a finding", () => {
    const property = migrateAnonymousProperty(legacy);
    property.evidenceRegister = [
      {
        id: "public-map",
        category: "grid",
        title: "Public grid map",
        evidenceClass: "public_source",
        validationStatus: "collected",
        sourceOrganisation: "Public source",
        sourceReference: null,
        sourceUrl: null,
        documentId: null,
        issuedAt: null,
        validFrom: null,
        validTo: null,
        claim: "A mapped substation is nearby",
        limitations: ["Does not establish capacity"],
        relatedDimensionKeys: ["grid"],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    property.qualification = updateQualificationDimension(property.qualification!, "grid", {
      status: "favourable",
      evidenceIds: ["public-map"],
    });
    expect(deriveQualification(property).unsupported.map((item) => item.key)).toContain("grid");
  });
});
