import type { CandidateOpportunity } from "./candidate-intelligence";
import type { PowerFinderFeature } from "./fixture-data";
import {
  canonicalOperatorName,
  knownOperatorRole,
  sameOperatorIdentity,
} from "./operator-normalization";
import type { GridOperatorOption } from "./operator-catalog";

export type CandidateOperatorContext = {
  mappedOperator: string | null;
  mappedRole: "TSO" | "DSO" | null;
  upstreamTso: string | null;
  relationshipBasis: "authoritative" | "mapped_proximity" | null;
  sourceLabel: string;
};

export type CandidateDetailModel = {
  score: number;
  evidenceCompleteness: "High" | "Medium" | "Low";
  capacityStatus: string;
  capacityExplanation: string;
  operator: CandidateOperatorContext;
  rankingSummary: string;
  nextStep: string;
};

export function resolveCandidateOperatorContext(
  candidate: CandidateOpportunity,
  catalog: GridOperatorOption[],
): CandidateOperatorContext {
  const mappedOperator = canonicalOperatorName(candidate.operator);
  const catalogEntry = catalog.find((item) => sameOperatorIdentity(item.name, mappedOperator));
  const mappedRole =
    catalogEntry?.type === "TSO"
      ? "TSO"
      : catalogEntry?.type === "DSO / other"
        ? "DSO"
        : knownOperatorRole(mappedOperator) === "TSO"
          ? "TSO"
          : null;
  const upstreamTso =
    mappedRole === "DSO" && catalogEntry?.tsoNames.length === 1 ? catalogEntry.tsoNames[0] : null;

  return {
    mappedOperator,
    mappedRole,
    upstreamTso,
    relationshipBasis: upstreamTso ? (catalogEntry?.relationshipBasis ?? null) : null,
    sourceLabel: "Public infrastructure mapping",
  };
}

export function buildCandidateDetailModel(
  candidate: CandidateOpportunity,
  feature: PowerFinderFeature,
  catalog: GridOperatorOption[],
): CandidateDetailModel {
  const operator = resolveCandidateOperatorContext(candidate, catalog);
  const exactCapacity =
    feature.properties.capacity_state === "published_exact" && feature.properties.exact_mw != null
      ? `${feature.properties.exact_mw} MW published observation`
      : null;
  const bandCapacity =
    feature.properties.capacity_state === "published_band" && feature.properties.band_min_mw != null
      ? `${feature.properties.band_min_mw}–${feature.properties.band_max_mw ?? "?"} MW published band`
      : null;
  const capacityStatus = exactCapacity ?? bandCapacity ?? "Not available";
  const capacityExplanation =
    exactCapacity || bandCapacity
      ? "This is a source-attributed observation, not current available capacity or a connection offer."
      : "Mapped voltage is not available MW. The responsible operator must confirm capacity.";
  const voltageSummary =
    candidate.voltageFit === "compatible"
      ? "preferred voltage matched"
      : candidate.voltageFit === "conditional"
        ? "mapped voltage differs from the preference"
        : "voltage remains unverified";
  const operatorSummary = operator.mappedOperator ? "operator mapped" : "operator unresolved";
  const operatorTarget = operator.mappedOperator
    ? `${operator.mappedOperator}${operator.mappedRole ? ` (${operator.mappedRole})` : ""}`
    : "the responsible network operator";

  return {
    score: candidate.screeningRank,
    evidenceCompleteness:
      candidate.confidence === "high"
        ? "High"
        : candidate.confidence === "medium"
          ? "Medium"
          : "Low",
    capacityStatus,
    capacityExplanation,
    operator,
    rankingSummary: `${candidate.distanceKm} km from the site · ${voltageSummary} · ${operatorSummary}`,
    nextStep: `Verify this connection point and request an indicative capacity assessment from ${operatorTarget}.`,
  };
}
