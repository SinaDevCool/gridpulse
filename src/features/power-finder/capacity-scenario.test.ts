import { describe, expect, it } from "vitest";
import {
  applyReleaseAScenarios,
  calculateCapacityScenario,
  RELEASE_A_SCENARIO_VERSION,
} from "./capacity-scenario";
import { defaultFinderProject } from "./finder-project";
import type { CandidateOpportunity } from "./candidate-intelligence";

const candidate: CandidateOpportunity = {
  id: "site:node-110",
  siteId: "site",
  nodeId: "node-110",
  siteName: "Demo site",
  nodeName: "Demo node",
  operator: "Demo operator",
  voltageKv: [110],
  distanceKm: 4,
  contextScore: 65,
  evidenceScore: 60,
  screeningRank: 0,
  voltageFit: "compatible",
  confidence: "medium",
  missingEvidence: [],
  constraints: [],
  calculationVersion: "test",
  source: "published_artifact",
};

describe("Release A capacity scenario", () => {
  it("is deterministic and unmistakably synthetic", () => {
    const first = calculateCapacityScenario(defaultFinderProject, candidate);
    const second = calculateCapacityScenario(defaultFinderProject, candidate);
    expect(first).toEqual(second);
    expect(first.evidenceStatus).toBe("synthetic");
    expect(first.trainingStatus).toBe("untrained");
    expect(first.notForConnectionDecision).toBe(true);
    expect(first.scenarioVersion).toBe(RELEASE_A_SCENARIO_VERSION);
  });

  it("materially responds to requested import", () => {
    const smaller = calculateCapacityScenario(
      { ...defaultFinderProject, importMw: 20, ultimateImportMw: 20, minimumFirmMw: 20 },
      candidate,
    );
    const larger = calculateCapacityScenario(
      { ...defaultFinderProject, importMw: 250, ultimateImportMw: 250, minimumFirmMw: 250 },
      candidate,
    );
    expect(smaller.score).toBeGreaterThan(larger.score);
    expect(smaller.constrainedHoursPerYear).toBeLessThan(larger.constrainedHoursPerYear);
  });

  it("uses declared flexibility and storage without creating network capacity", () => {
    const inflexible = calculateCapacityScenario(
      { ...defaultFinderProject, importMw: 160, ultimateImportMw: 160, minimumFirmMw: 80 },
      candidate,
    );
    const flexible = calculateCapacityScenario(
      {
        ...defaultFinderProject,
        importMw: 160,
        ultimateImportMw: 160,
        minimumFirmMw: 80,
        flexibleLoadMw: 50,
        batteryPowerMw: 30,
        batteryEnergyMwh: 120,
      },
      candidate,
    );
    expect(flexible.constrainedHoursPerYear).toBeLessThanOrEqual(
      inflexible.constrainedHoursPerYear,
    );
    expect(flexible.firmImportEnvelopeMw).toBe(inflexible.firmImportEnvelopeMw);
  });

  it("publishes a complete explainable score", () => {
    const result = calculateCapacityScenario(defaultFinderProject, candidate);
    expect(result.scoreComponents).toHaveLength(8);
    expect(result.scoreComponents.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
    expect(result.limitingComponent).toMatch(
      /transformer|upstream_branch|voltage_security|contingency/,
    );
  });

  it("never replaces the public evidence-based investigation priority", () => {
    const [result] = applyReleaseAScenarios(defaultFinderProject, [
      { ...candidate, screeningRank: 73 },
    ]);
    expect(result.screeningRank).toBe(73);
    expect(result.capacityScenario?.score).toBeTypeOf("number");
  });
});
