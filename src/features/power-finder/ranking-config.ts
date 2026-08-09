import type { FinderProjectType } from "./finder-project";

export const RANKING_MODEL_VERSION = "public-investigation-priority-v3";

export type RankingDimension =
  | "evidenceReadiness"
  | "mappedVoltageRelevance"
  | "proximity"
  | "operatorAttribution"
  | "sourceFreshness";

export type RankingWeights = Record<RankingDimension, number>;

export const baseRankingWeights: RankingWeights = {
  evidenceReadiness: 0.3,
  mappedVoltageRelevance: 0.25,
  proximity: 0.25,
  operatorAttribution: 0.1,
  sourceFreshness: 0.1,
};

export const projectRankingProfiles: Record<FinderProjectType, RankingWeights> = {
  data_centre: { ...baseRankingWeights, mappedVoltageRelevance: 0.3, proximity: 0.2 },
  industrial_load: baseRankingWeights,
  battery_storage: { ...baseRankingWeights, evidenceReadiness: 0.25, mappedVoltageRelevance: 0.3 },
  co_location: { ...baseRankingWeights, evidenceReadiness: 0.25, mappedVoltageRelevance: 0.3 },
  electrolyser: { ...baseRankingWeights, mappedVoltageRelevance: 0.3, proximity: 0.2 },
  charging_hub: { ...baseRankingWeights, proximity: 0.3, evidenceReadiness: 0.25 },
};

export function validateRankingWeights(weights: RankingWeights) {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 0.000001) throw new Error("Ranking weights must sum to one.");
  if (Object.values(weights).some((value) => value < 0 || value > 1)) {
    throw new Error("Ranking weights must be between zero and one.");
  }
  return weights;
}

export function weightedInvestigationPriority(
  components: Record<RankingDimension, number>,
  weights: RankingWeights = baseRankingWeights,
) {
  validateRankingWeights(weights);
  return Object.entries(weights).reduce(
    (sum, [dimension, weight]) => sum + components[dimension as RankingDimension] * weight,
    0,
  );
}

export function rankingSensitivity(
  components: Record<RankingDimension, number>,
  profiles = projectRankingProfiles,
) {
  const scores = Object.entries(profiles).map(([profile, weights]) => ({
    profile: profile as FinderProjectType,
    score: Math.round(weightedInvestigationPriority(components, weights) * 10) / 10,
  }));
  return {
    scores,
    minimum: Math.min(...scores.map((item) => item.score)),
    maximum: Math.max(...scores.map((item) => item.score)),
  };
}
