import { selectFinderCandidate } from "./select-finder-candidate";
import { classifyCapacityOpportunity } from "@/features/power-finder/capacity-opportunity";

import { formatOperatorNames } from "@/features/power-finder/operator-normalization";
import { distanceFormatter, formatScore, type CandidateSort } from "./page-formatting";
import type { FinderControllerContract } from "./controller-contract";
export function FinderCandidates({ model }: { model: FinderControllerContract }) {
  const {
    project,
    candidateSort,
    maxDistanceKm,
    showAllCandidates,
    setShowAllCandidates,
    updateSearch,
    setPreviewCandidateId,
    ranking,
    rankingCollection,
    rankingState,
    mapMode,
    capacityMetric,
    requiredCapacityMw,
    activeCapacityNodes,
    candidateSelection,
    candidates,
    visibleCandidates,
    selectedOpportunity,
  } = model;
  return (
    <section className="power-finder-candidates">
      <header>
        <span>
          <h2>Grid candidates</h2>
          <small role="status" aria-live="polite">
            {project.latitude == null || project.longitude == null
              ? "Choose a site to rank candidates"
              : rankingState === "loading"
                ? "Calculating…"
                : `${candidates.length} candidate site-to-node matches`}
          </small>
        </span>
        <label>
          <span>Sort by</span>
          <select
            name="candidate-sort"
            value={candidateSort}
            onChange={(event) => void updateSearch({ sort: event.target.value as CandidateSort })}
          >
            <option value="context">Best investigation match</option>
            <option value="voltage">Mapped voltage</option>
            <option value="name">Name</option>
            <option value="distance">Distance</option>
            <option value="operator">Mapped operator</option>
          </select>
        </label>
      </header>
      <div className="finder-results-switch" role="group" aria-label="Candidate presentation">
        <button
          type="button"
          data-finder-view="cards"
          aria-pressed={!model.search.resultsView || model.search.resultsView === "cards"}
          onClick={() => void updateSearch({ resultsView: undefined })}
        >
          Cards
        </button>
        <button
          type="button"
          aria-pressed={model.search.resultsView === "table"}
          onClick={() => void updateSearch({ resultsView: "table" })}
        >
          Table
        </button>
        <button
          type="button"
          aria-pressed={model.search.resultsView === "assets"}
          onClick={() => void updateSearch({ resultsView: "assets" })}
        >
          Infrastructure
        </button>
      </div>
      {(project.latitude == null || project.longitude == null) && (
        <div className="finder-site-empty" role="status">
          <strong>No declared site yet</strong>
          <p>
            Click an empty map location or enter coordinates above. GridPulse will then rank mapped
            candidate connection points within your selected distance.
          </p>
        </div>
      )}
      {project.latitude != null && project.longitude != null && rankingState === "error" && (
        <p className="power-finder-no-results" role="status">
          Candidate ranking is unavailable. Change the map view or try again.
        </p>
      )}
      {(candidateSelection.tsoFallback || candidateSelection.dsoFallback) && (
        <p className="candidate-boundary" role="status">
          No nearby candidate matches the selected mapped operator context. Showing valid distance
          and voltage matches; verify operator responsibility before relying on it.
        </p>
      )}
      {project.latitude != null &&
        project.longitude != null &&
        rankingState === "ready" &&
        candidates.length === 0 && (
          <p className="power-finder-no-results">
            No retrieved candidates match these filters within {maxDistanceKm} km. This does not
            establish that no connection options exist.
          </p>
        )}
      {rankingCollection?.metadata.retrieval_capped && (
        <p role="status">
          Candidate retrieval reached its limit. Narrow the search area; this shortlist is
          incomplete.
        </p>
      )}
      <p className="finder-evidence-boundary">
        Investigation priority only. Capacity and connection suitability are unverified.
      </p>
      {(!model.search.resultsView || model.search.resultsView === "cards") &&
        visibleCandidates.map((candidate, index) => {
          const capacityNode = activeCapacityNodes.find(
            (node) => node.publicNodeId === candidate.nodeId,
          );
          const capacityFit = classifyCapacityOpportunity(
            capacityNode,
            capacityMetric,
            requiredCapacityMw,
          );
          return (
            <button
              type="button"
              key={candidate.id}
              data-candidate-id={candidate.id}
              className={selectedOpportunity?.id === candidate.id ? "active" : ""}
              aria-pressed={selectedOpportunity?.id === candidate.id}
              onClick={() => void selectFinderCandidate(model, candidate)}
              onMouseEnter={() => setPreviewCandidateId(candidate.id)}
              onMouseLeave={() => setPreviewCandidateId(null)}
              onFocus={() => setPreviewCandidateId(candidate.id)}
              onBlur={() => setPreviewCandidateId(null)}
              aria-label={`Show ${candidate.nodeName} on map, ${formatScore(candidate.screeningRank)}/100`}
            >
              <span className="candidate-rank">{index + 1}</span>
              <span>
                <b>{candidate.nodeName}</b>
                <small>
                  {candidate.voltageKv.length
                    ? `${Math.max(...candidate.voltageKv)} kV`
                    : "Voltage unknown"}{" "}
                  · {distanceFormatter.format(candidate.distanceKm)} km ·{" "}
                  {formatOperatorNames(candidate.operator) ?? "Operator unconfirmed"}
                </small>
                <span className="candidate-fit-summary">
                  <strong>{formatScore(candidate.screeningRank)}/100</strong>
                  <span>investigation fit</span>
                  <small>Capacity unknown</small>
                  {candidate.infrastructureClass === "possible_customer_asset" ||
                  candidate.infrastructureClass === "specialised" ? (
                    <small>{candidate.suitabilityNote}</small>
                  ) : null}
                </span>
                {mapMode === "capacity" && (
                  <span className={`candidate-capacity-fit is-${capacityFit.fit}`}>
                    {capacityFit.fit === "meets" &&
                      `${capacityFit.valueMw?.toLocaleString("en-GB", { maximumFractionDigits: 1 })} MW · meets ${requiredCapacityMw} MW`}
                    {capacityFit.fit === "activation" &&
                      `${capacityFit.valueMw?.toLocaleString("en-GB", { maximumFractionDigits: 1 })} MW firm · ${capacityFit.alternative} pathway`}
                    {capacityFit.fit === "below" &&
                      `${capacityFit.valueMw?.toLocaleString("en-GB", { maximumFractionDigits: 1 })} MW · below requirement`}
                    {capacityFit.fit === "stale" && "Recalculation required"}
                    {capacityFit.fit === "unknown" && "Capacity not calculated"}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      {(!model.search.resultsView || model.search.resultsView === "cards") &&
      !showAllCandidates &&
      candidates.length > 5 ? (
        <button
          type="button"
          className="candidate-show-more"
          onClick={() => setShowAllCandidates(true)}
        >
          Show all {candidates.length} candidates
        </button>
      ) : (!model.search.resultsView || model.search.resultsView === "cards") &&
        showAllCandidates &&
        candidates.length > 5 ? (
        <button
          type="button"
          className="candidate-show-more"
          onClick={() => setShowAllCandidates(false)}
        >
          Show top 5 candidates
        </button>
      ) : null}
      {ranking && project.latitude != null && project.longitude != null && (
        <>
          <details className="finder-ranking-method">
            <summary>How this ranking works</summary>
            <p>
              Data-centre investigation fit: proximity 30%, mapped-voltage relevance 25%, operator
              attribution 15%, asset specificity 15%, evidence readiness 10% and source freshness
              5%. Capacity, cost and delivery timing are excluded because they require operator
              evidence.
            </p>
          </details>
          <p className="candidate-boundary">{ranking.evidenceBoundary}</p>
        </>
      )}
    </section>
  );
}
