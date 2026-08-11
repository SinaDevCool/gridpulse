import { describe, expect, it } from "vitest";
import type { CandidateOpportunity } from "@/features/power-finder/candidate-intelligence";
import { defaultFinderProject } from "@/features/power-finder/finder-project";
import { propertyFromFinder, propertyFromImport } from "./factory";
import { migrateAnonymousProperty } from "./schema";

const candidate = (id: string, operator = "Example DSO"): CandidateOpportunity => ({
  id,
  siteId: `site-${id}`,
  nodeId: `node-${id}`,
  siteName: `Site ${id}`,
  nodeName: `Node ${id}`,
  operator,
  voltageKv: [110],
  distanceKm: 2,
  contextScore: 50,
  evidenceScore: 60,
  screeningRank: 70,
  voltageFit: "compatible",
  confidence: "medium",
  missingEvidence: ["Available capacity"],
  constraints: [],
  calculationVersion: "test",
  source: "published_artifact",
});

const imported = () =>
  propertyFromImport(
    {
      externalPropertyId: "EXT-1",
      propertyName: "Bremen Campus",
      latitude: 53.1,
      longitude: 8.8,
      boundary: null,
      propertyType: "data_centre",
      propertyCondition: "brownfield",
      requiredItLoadMw: 60,
      requiredTotalSiteLoadMw: 100,
      minimumViableLoadMw: 40,
      exportRequirementMw: 0,
      developmentPhase: "screening",
      landControlStatus: "optioned",
      municipality: "Bremen",
      siteLabel: "Port industrial area",
      address: "Example quay",
      federalState: "Bremen",
      cadastralReference: "TEST-1",
      siteAreaHectares: 20,
      developableAreaHectares: 15,
      targetEnergisationYear: 2030,
      confidentialityClassification: "confidential",
      clientOrganisation: null,
      projectOwner: null,
      notes: null,
      sourceRow: 2,
    },
    "xlsx",
  );

describe("anonymous property factory", () => {
  it("maps the imported minimum viable load into Finder", () => {
    expect(imported().project.minimumFirmMw).toBe(40);
  });

  it("preserves site intelligence when Finder results are saved", () => {
    const existing = migrateAnonymousProperty(imported());
    existing.qualification![0] = {
      ...existing.qualification![0],
      status: "conditional",
      summary: "Option agreement under review",
    };
    existing.evidenceRegister!.push({
      id: "evidence-1",
      category: "property",
      title: "Option agreement",
      evidenceClass: "customer_declared",
      validationStatus: "collected",
      sourceOrganisation: "Client",
      sourceReference: null,
      sourceUrl: null,
      documentId: null,
      issuedAt: null,
      validFrom: null,
      validTo: null,
      claim: "Land option exists",
      limitations: ["Not independently reviewed"],
      relatedDimensionKeys: ["land"],
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    });
    existing.operatorEngagement!.operatorName = "Confirmed DSO";
    existing.decisionStatus = "hold";
    existing.decisionRationale = "Await operator response";

    const result = propertyFromFinder(
      { ...existing.project, importMw: 110, name: "Bremen Campus Updated" },
      [candidate("candidate-1")],
      existing,
    );

    expect(result.id).toBe(existing.id);
    expect(result.dataCentreProfile).toEqual(existing.dataCentreProfile);
    expect(result.qualification).toEqual(existing.qualification);
    expect(result.evidenceRegister).toEqual(existing.evidenceRegister);
    expect(result.operatorEngagement).toEqual(existing.operatorEngagement);
    expect(result.decisionStatus).toBe("hold");
    expect(result.decisionRationale).toBe("Await operator response");
    expect(result.project.importMw).toBe(110);
  });

  it("retains prior candidates and clears a dangling preference", () => {
    const existing = imported();
    existing.candidateSnapshots = [];
    existing.preferredCandidateId = "missing";
    const result = propertyFromFinder(existing.project, [candidate("new")], existing);
    expect(result.preferredCandidateId).toBeNull();
    expect(result.candidateSnapshots.map((item) => item.id)).toEqual(["new"]);
  });
});
