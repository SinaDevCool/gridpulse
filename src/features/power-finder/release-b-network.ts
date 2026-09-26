import type { CandidateOpportunity } from "./candidate-intelligence";
import type { CapacityScenarioResult } from "./capacity-scenario";
import type { FinderProject } from "./finder-project";
import { SYNTHETIC_FIXTURE_METADATA, SYNTHETIC_OPERATING_FACTORS } from "./synthetic-fixtures";

export const RELEASE_B_NETWORK_VERSION = "de-bb-synthetic-reference-network-v1";
export const RELEASE_B_RANKING_VERSION = "release-b-security-ranking-v1";

export type ReleaseBConstraint =
  | "transformer"
  | "upstream_branch"
  | "connection_branch"
  | "voltage_proxy";

export type ReleaseBBranch = {
  id: string;
  from: string;
  to: string;
  voltageKv: number;
  syntheticRatingMw: number;
  syntheticBaseLoadingMw: number;
  reactanceProxy: number;
  evidenceStatus: "synthetic";
};

export type ReleaseBSensitivity = {
  key: "base" | "high_system_load" | "largest_branch_outage" | "target_year_stress";
  label: string;
  transferLimitMw: number;
  residualMarginMw: number;
  voltageProxyPu: number;
  passesDeclaredFirmRequirement: boolean;
  bindingConstraint: ReleaseBConstraint;
};

export type ReleaseBNetworkResult = {
  source: "synthetic_fixture";
  replaceBeforeProduction: true;
  fixtureVersion: string;
  candidateId: string;
  evidenceStatus: "synthetic";
  networkVersion: typeof RELEASE_B_NETWORK_VERSION;
  rankingVersion: typeof RELEASE_B_RANKING_VERSION;
  validationStatus: "unvalidated_reference_model";
  notForConnectionDecision: true;
  topology: { buses: number; branches: number; source: string; connectionBus: string };
  branches: ReleaseBBranch[];
  n0TransferLimitMw: number;
  n1TransferLimitMw: number;
  selectedSecurityLimitMw: number;
  declaredFirmRequirementMw: number;
  residualSecurityMarginMw: number;
  voltageProxyPu: number;
  bindingConstraint: ReleaseBConstraint;
  sensitivities: ReleaseBSensitivity[];
  topologyQualityScore: number;
  securityScore: number;
  rankingAdjustment: number;
  replacementTarget: string;
  assumptions: string[];
  limitations: string[];
};

function round(value: number, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function seededUnit(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function makeBranches(candidate: CandidateOpportunity): ReleaseBBranch[] {
  const voltageKv = Math.max(20, ...candidate.voltageKv.filter((value) => value <= 500));
  const voltageBase = voltageKv >= 380 ? 620 : voltageKv >= 220 ? 330 : voltageKv >= 110 ? 145 : 38;
  const seed = seededUnit(candidate.nodeId);
  const distanceDerate = Math.max(0.7, 1 - candidate.distanceKm * 0.008);
  const ratings = [
    voltageBase * (0.78 + seed * 0.18),
    voltageBase * (0.66 + ((seed * 7.3) % 1) * 0.2),
    voltageBase * distanceDerate * (0.58 + ((seed * 13.1) % 1) * 0.22),
  ];
  return ratings.map((rating, index) => ({
    id: `${candidate.nodeId}-synthetic-branch-${index + 1}`,
    from: index === 0 ? "synthetic-source" : `synthetic-bus-${index}`,
    to: index === 2 ? candidate.nodeId : `synthetic-bus-${index + 1}`,
    voltageKv,
    syntheticRatingMw: round(rating),
    syntheticBaseLoadingMw: round(rating * (0.38 + ((seed * (index + 3) * 5.7) % 1) * 0.28)),
    reactanceProxy: round(0.04 + candidate.distanceKm * 0.0015 + index * 0.012, 3),
    evidenceStatus: "synthetic",
  }));
}

function evaluateCase(
  key: ReleaseBSensitivity["key"],
  label: string,
  branches: ReleaseBBranch[],
  firmRequirement: number,
  loadMultiplier: number,
  outage = false,
): ReleaseBSensitivity {
  const available = branches.map((branch) =>
    Math.max(0, branch.syntheticRatingMw - branch.syntheticBaseLoadingMw * loadMultiplier),
  );
  const transformer = available[0];
  const upstream = outage ? Math.min(available[1], available[0] * 0.52) : available[1];
  const connection = outage ? Math.min(available[2], available[1] * 0.55) : available[2];
  const distance = branches[2].reactanceProxy;
  const voltageLimit = Math.max(0, branches[2].syntheticRatingMw * (0.86 - distance * 0.9));
  const constraints: Record<ReleaseBConstraint, number> = {
    transformer,
    upstream_branch: upstream,
    connection_branch: connection,
    voltage_proxy: voltageLimit,
  };
  const [bindingConstraint, transferLimit] = Object.entries(constraints).sort(
    (left, right) => left[1] - right[1],
  )[0] as [ReleaseBConstraint, number];
  const voltageProxyPu = Math.max(
    SYNTHETIC_OPERATING_FACTORS.minimumVoltageIndicator,
    1 - (firmRequirement / Math.max(voltageLimit, 1)) * 0.045,
  );
  return {
    key,
    label,
    transferLimitMw: round(transferLimit),
    residualMarginMw: round(transferLimit - firmRequirement),
    voltageProxyPu: round(voltageProxyPu, 3),
    passesDeclaredFirmRequirement:
      transferLimit >= firmRequirement &&
      voltageProxyPu >= SYNTHETIC_OPERATING_FACTORS.demonstrationVoltagePassIndicator,
    bindingConstraint,
  };
}

export function calculateReleaseBNetwork(
  project: FinderProject,
  candidate: CandidateOpportunity,
  releaseA: CapacityScenarioResult,
): ReleaseBNetworkResult {
  const branches = makeBranches(candidate);
  const firmRequirement = Math.min(project.ultimateImportMw, Math.max(0, project.minimumFirmMw));
  const targetStress = 1 + Math.max(0, project.targetEnergisationYear - 2028) * 0.012;
  const sensitivities = [
    evaluateCase("base", "Base synthetic system state", branches, firmRequirement, 1),
    evaluateCase(
      "high_system_load",
      "+15% synthetic system loading",
      branches,
      firmRequirement,
      SYNTHETIC_OPERATING_FACTORS.highSystemLoad,
    ),
    evaluateCase(
      "largest_branch_outage",
      "Largest-branch outage proxy",
      branches,
      firmRequirement,
      1,
      true,
    ),
    evaluateCase(
      "target_year_stress",
      `${project.targetEnergisationYear} synthetic demand-growth stress`,
      branches,
      firmRequirement,
      targetStress,
    ),
  ];
  const base = sensitivities[0];
  const outage = sensitivities[2];
  const selected = project.redundancy === "single_feed" ? base : outage;
  const topologyQualityScore = clamp(
    candidate.evidenceScore * 0.55 +
      (candidate.operator ? 20 : 0) +
      (candidate.voltageKv.length ? 20 : 0),
  );
  const marginScore = clamp(50 + (selected.residualMarginMw / Math.max(firmRequirement, 1)) * 50);
  const sensitivityPasses = sensitivities.filter(
    (item) => item.passesDeclaredFirmRequirement,
  ).length;
  const securityScore = round(
    clamp(marginScore * 0.55 + sensitivityPasses * 10 + topologyQualityScore * 0.05),
  );
  const rankingAdjustment = round((securityScore - 50) * 0.2);
  return {
    ...SYNTHETIC_FIXTURE_METADATA,
    candidateId: candidate.id,
    evidenceStatus: "synthetic",
    networkVersion: RELEASE_B_NETWORK_VERSION,
    rankingVersion: RELEASE_B_RANKING_VERSION,
    validationStatus: "unvalidated_reference_model",
    notForConnectionDecision: true,
    topology: {
      buses: 4,
      branches: 3,
      source: "synthetic-source",
      connectionBus: candidate.nodeId,
    },
    branches,
    n0TransferLimitMw: base.transferLimitMw,
    n1TransferLimitMw: outage.transferLimitMw,
    selectedSecurityLimitMw: selected.transferLimitMw,
    declaredFirmRequirementMw: round(firmRequirement),
    residualSecurityMarginMw: selected.residualMarginMw,
    voltageProxyPu: selected.voltageProxyPu,
    bindingConstraint: selected.bindingConstraint,
    sensitivities,
    topologyQualityScore: round(topologyQualityScore),
    securityScore,
    rankingAdjustment,
    replacementTarget:
      "Operator-supplied CGMES/planning topology, impedances, equipment ratings, loading snapshots, contingency list, protection and connection queue",
    assumptions: [
      "Three synthetic series branches represent source, upstream and connection constraints.",
      "Ratings, loading and reactance proxies are deterministic demonstration values.",
      project.redundancy === "single_feed"
        ? "The base N-0 screen controls the selected security limit."
        : "The largest-branch outage proxy controls the selected security limit.",
      `Release A firm envelope remains ${releaseA.firmImportEnvelopeMw} MW and is not overwritten.`,
    ],
    limitations: [
      "This is not AC or DC power flow and does not solve Kirchhoff network equations.",
      "No operator topology, loading, fault level, protection setting or queue position is used.",
      "N-1 is a conservative outage proxy, not an operator security assessment.",
      "Outputs are not free, available, reserved, connectable or confirmed grid capacity.",
    ],
  };
}

export function applyReleaseBNetworks(project: FinderProject, candidates: CandidateOpportunity[]) {
  return candidates
    .map((candidate) => {
      if (!candidate.capacityScenario) return candidate;
      const networkScenario = calculateReleaseBNetwork(
        project,
        candidate,
        candidate.capacityScenario,
      );
      return {
        ...candidate,
        networkScenario,
        screeningRank: round(clamp(candidate.screeningRank + networkScenario.rankingAdjustment)),
      };
    })
    .sort(
      (left, right) =>
        right.screeningRank - left.screeningRank || left.distanceKm - right.distanceKm,
    );
}
