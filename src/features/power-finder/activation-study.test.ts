import { describe, expect, it } from "vitest";
import {
  buildRepresentativeProfile,
  calculateRepresentativeCommercialValue,
  createActivationStudyContext,
  resolveActivationStudyMode,
} from "./activation-study";
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

  it("uses governed reference capacity instead of the legacy percentage assumption", () => {
    const reference = {
      activatable_capacity_mw: 4.66,
      activation: {
        conventional_firm_mw: 0,
        immediately_energisable_mw: 3.2,
        staged: { eventual_capacity_mw: 5.8 },
        result_sha256: "a".repeat(64),
      },
    } as never;
    const context = createActivationStudyContext({
      project: {
        ...defaultFinderProject,
        importMw: 5.8,
        ultimateImportMw: 5.8,
        minimumFirmMw: 3.2,
      },
      candidate,
      registeredStudy: null,
      referenceCapacity: reference,
    });
    expect(context.mode).toBe("reference_network_calculated");
    expect(context.referenceCapacity).toBe(reference);
    expect(context.options.some((option) => option.initialImportMw <= 4.66)).toBe(true);
  });

  it("uses one deterministic annual profile and produces differentiated strategies", () => {
    const project = {
      ...defaultFinderProject,
      importMw: 20,
      ultimateImportMw: 20,
      minimumFirmMw: 10,
      flexibleLoadMw: 4,
      batteryPowerMw: 8,
      batteryEnergyMwh: 24,
    };
    const profile = buildRepresentativeProfile(project);
    const context = createActivationStudyContext({ project, candidate, registeredStudy: null });
    expect(profile).toHaveLength(8760);
    expect(buildRepresentativeProfile(project)).toEqual(profile);
    expect(
      new Set(context.options.map((option) => option.analysis?.residualUnservedMwh)).size,
    ).toBeGreaterThan(1);
    expect(context.recommendedOption).not.toBeNull();
  });

  it("keeps representative commercial value explicitly assumption-driven", () => {
    const context = createActivationStudyContext({
      project: { ...defaultFinderProject, importMw: 20, ultimateImportMw: 20 },
      candidate,
      registeredStudy: null,
    });
    const value = calculateRepresentativeCommercialValue(context);
    expect(value.grossAccelerationValueEur).toBe(0);
    expect(value.eligible).toBe(false);
    expect(value.boundary).toMatch(/not an investment return/i);
  });

  it("does not recommend a pathway when every alternative fails the declared minimum", () => {
    const project = {
      ...defaultFinderProject,
      importMw: 20,
      ultimateImportMw: 20,
      minimumFirmMw: 20,
      flexibleLoadMw: 0,
      batteryPowerMw: 0,
      batteryEnergyMwh: 0,
    };
    const context = createActivationStudyContext({ project, candidate, registeredStudy: null });
    expect(context.recommendedOption).toBeNull();
    expect(context.hasViableOption).toBe(false);
    expect(context.bestInvestigativeHypothesis).not.toBeNull();
  });

  it("preserves the full requested-firm entitlement across the representative profile", () => {
    const profile = buildRepresentativeProfile({
      ...defaultFinderProject,
      importMw: 20,
      ultimateImportMw: 20,
    });
    expect(profile.every((point) => point.connectionLimitFactor === 1)).toBe(true);
  });
});
