import { describe, expect, it } from "vitest";
import { calculateCapacityScenario } from "./capacity-scenario";
import type { CandidateOpportunity } from "./candidate-intelligence";
import { defaultFinderProject } from "./finder-project";
import { calculateReleaseBNetwork } from "./release-b-network";

const candidate: CandidateOpportunity = {
  id: "site-a::node-a",
  siteId: "site-a",
  nodeId: "node-a",
  siteName: "Site A",
  nodeName: "Node A",
  operator: "Example operator",
  voltageKv: [110],
  distanceKm: 3.2,
  contextScore: 72,
  evidenceScore: 65,
  screeningRank: 68,
  voltageFit: "compatible",
  confidence: "medium",
  missingEvidence: [],
  constraints: [],
  calculationVersion: "test",
  source: "published_artifact",
};

describe("Release B reference-network screen", () => {
  it("is deterministic and explicitly unvalidated", () => {
    const releaseA = calculateCapacityScenario(defaultFinderProject, candidate);
    const first = calculateReleaseBNetwork(defaultFinderProject, candidate, releaseA);
    const second = calculateReleaseBNetwork(defaultFinderProject, candidate, releaseA);
    expect(first).toEqual(second);
    expect(first.validationStatus).toBe("unvalidated_reference_model");
    expect(first.notForConnectionDecision).toBe(true);
    expect(first.branches).toHaveLength(3);
  });

  it("makes an N-1 requirement use the outage limit", () => {
    const n0Project = { ...defaultFinderProject, minimumFirmMw: 20, ultimateImportMw: 20 };
    const n1Project = { ...n0Project, redundancy: "n_minus_one" as const };
    const releaseA = calculateCapacityScenario(n0Project, candidate);
    const n0 = calculateReleaseBNetwork(n0Project, candidate, releaseA);
    const n1 = calculateReleaseBNetwork(n1Project, candidate, releaseA);
    expect(n0.selectedSecurityLimitMw).toBe(n0.n0TransferLimitMw);
    expect(n1.selectedSecurityLimitMw).toBe(n1.n1TransferLimitMw);
    expect(n1.n1TransferLimitMw).toBeLessThanOrEqual(n1.n0TransferLimitMw);
  });

  it("reacts to target-year stress without changing the source evidence", () => {
    const project = { ...defaultFinderProject, targetEnergisationYear: 2040 };
    const releaseA = calculateCapacityScenario(project, candidate);
    const result = calculateReleaseBNetwork(project, candidate, releaseA);
    const base = result.sensitivities.find((item) => item.key === "base")!;
    const target = result.sensitivities.find((item) => item.key === "target_year_stress")!;
    expect(target.transferLimitMw).toBeLessThanOrEqual(base.transferLimitMw);
    expect(result.evidenceStatus).toBe("synthetic");
  });
});
