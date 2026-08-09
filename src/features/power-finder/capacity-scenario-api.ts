import type { CandidateOpportunity } from "./candidate-intelligence";
import { applyReleaseAScenarios, type CapacityScenarioResult } from "./capacity-scenario";
import type { FinderProject } from "./finder-project";
import { applyReleaseBNetworks, type ReleaseBNetworkResult } from "./release-b-network";

export async function loadReleaseAScenarios(
  project: FinderProject,
  candidates: CandidateOpportunity[],
  signal?: AbortSignal,
) {
  if (!candidates.length) return [];
  try {
    const response = await fetch("/api/power-finder/scenario", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project, candidates }),
      signal,
    });
    if (!response.ok) throw new Error(`Scenario endpoint returned ${response.status}.`);
    const payload = (await response.json()) as {
      scenarios?: Array<{
        capacityScenario: CapacityScenarioResult;
        networkScenario: ReleaseBNetworkResult;
      }>;
    };
    const byId = new Map(
      (payload.scenarios ?? []).map((scenario) => [
        scenario.capacityScenario.candidateId,
        scenario,
      ]),
    );
    if (byId.size !== candidates.length) throw new Error("Scenario response is incomplete.");
    return candidates
      .map((candidate) => {
        const result = byId.get(candidate.id)!;
        const screeningRank = Math.min(
          100,
          Math.max(0, result.capacityScenario.score + result.networkScenario.rankingAdjustment),
        );
        return {
          ...candidate,
          screeningRank,
          capacityScenario: result.capacityScenario,
          networkScenario: result.networkScenario,
        };
      })
      .sort(
        (left, right) =>
          right.screeningRank - left.screeningRank || left.distanceKm - right.distanceKm,
      );
  } catch (error) {
    if (signal?.aborted) throw error;
    return applyReleaseBNetworks(project, applyReleaseAScenarios(project, candidates));
  }
}
