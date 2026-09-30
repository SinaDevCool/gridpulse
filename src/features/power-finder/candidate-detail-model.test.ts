import { describe, expect, it } from "vitest";
import type { CandidateOpportunity } from "./candidate-intelligence";
import {
  buildCandidateDetailModel,
  resolveCandidateOperatorContext,
} from "./candidate-detail-model";
import type { PowerFinderFeature } from "./fixture-data";
import type { GridOperatorOption } from "./operator-catalog";

const candidate: CandidateOpportunity = {
  id: "site:node",
  siteId: "site",
  nodeId: "node",
  siteName: "Bremen site",
  nodeName: "Umspannwerk Neuenkirchen",
  operator: "TenneT",
  voltageKv: [380],
  distanceKm: 1.6,
  contextScore: 80,
  evidenceScore: 35,
  screeningRank: 94.1,
  voltageFit: "compatible",
  confidence: "medium",
  missingEvidence: ["available import capacity"],
  constraints: [],
  calculationVersion: "test",
  source: "published_artifact",
};

const feature: PowerFinderFeature = {
  type: "Feature",
  id: "node",
  geometry: { type: "Point", coordinates: [8.5, 53.1] },
  properties: {
    kind: "node",
    name: "Umspannwerk Neuenkirchen",
    operator: "TenneT",
    voltage_kv: [380],
    evidence_class: "open_mapping",
    capacity_state: "not_established",
  },
};

const tso: GridOperatorOption = {
  name: "TenneT TSO GmbH",
  type: "TSO",
  featureCount: 1,
  bounds: null,
  tsoNames: ["TenneT TSO GmbH"],
  relationshipBasis: null,
};

describe("candidate detail model", () => {
  it("identifies a directly mapped TSO without inventing a DSO", () => {
    const context = resolveCandidateOperatorContext(candidate, [tso]);
    expect(context.mappedOperator).toBe("TenneT TSO GmbH");
    expect(context.mappedRole).toBe("TSO");
    expect(context.likelyUpstreamTso).toBeNull();
  });

  it("labels a proximity-derived upstream TSO as likely", () => {
    const dsoCandidate = { ...candidate, operator: "E.DIS" };
    const context = resolveCandidateOperatorContext(dsoCandidate, [
      {
        name: "E.DIS Netz GmbH",
        type: "DSO / other",
        featureCount: 1,
        bounds: null,
        tsoNames: ["50Hertz Transmission GmbH"],
        relationshipBasis: "mapped_proximity",
      },
    ]);
    expect(context.mappedRole).toBe("DSO");
    expect(context.likelyUpstreamTso).toBe("50Hertz Transmission GmbH");
    expect(context.relationshipBasis).toBe("mapped_proximity");
  });

  it("keeps fit, evidence completeness and capacity evidence distinct", () => {
    const model = buildCandidateDetailModel(candidate, feature, [tso]);
    expect(model.score).toBe(94.1);
    expect(model.evidenceCompleteness).toBe("Medium");
    expect(model.capacityStatus).toBe("Not available");
    expect(model.nextStep).toContain("TenneT TSO GmbH (TSO)");
  });
});
