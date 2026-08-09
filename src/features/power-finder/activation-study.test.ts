import { describe, expect, it } from "vitest";
import { createActivationStudyContext, resolveActivationStudyMode } from "./activation-study";
import { calculateCapacityScenario } from "./capacity-scenario";
import type { CandidateOpportunity } from "./candidate-intelligence";
import { defaultFinderProject } from "./finder-project";
import { calculateReleaseBNetwork } from "./release-b-network";

const candidate: CandidateOpportunity = {
  id: "site:node",
  siteId: "site",
  nodeId: "node",
  siteName: "Site",
  nodeName: "Node",
  operator: "Operator",
  voltageKv: [110],
  distanceKm: 4,
  contextScore: 70,
  evidenceScore: 60,
  screeningRank: 73,
  voltageFit: "compatible",
  confidence: "medium",
  missingEvidence: [],
  constraints: [],
  calculationVersion: "test",
  source: "published_artifact",
};

describe("Activation Study orchestration", () => {
  it("keeps synthetic option fit separate from public investigation priority", () => {
    const capacityScenario = calculateCapacityScenario(defaultFinderProject, candidate);
    const networkScenario = calculateReleaseBNetwork(
      defaultFinderProject,
      candidate,
      capacityScenario,
    );
    const context = createActivationStudyContext({
      project: defaultFinderProject,
      candidate: { ...candidate, capacityScenario, networkScenario },
      registeredStudy: null,
    });
    expect(context.mode).toBe("synthetic_demonstration");
    expect(context.candidate.screeningRank).toBe(73);
    expect(context.options).toHaveLength(6);
    expect(context.options.every((option) => option.evidenceStatus === "customer_hypothesis")).toBe(
      true,
    );
  });

  it("uses a linked reviewed model without promoting benchmark evidence", () => {
    expect(
      resolveActivationStudyMode({
        node_study: { available: true, validation_class: "operator_reviewed" },
        benchmark_validation: { available: true },
        evidence_boundary: "test",
      }),
    ).toBe("operator_reviewed");
  });
});
