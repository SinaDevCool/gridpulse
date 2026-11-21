import { useState } from "react";
import type { FinderControllerContract } from "./controller-contract";
import { distanceFormatter, formatScore, type CandidateSort } from "./page-formatting";
import { formatOperatorNames } from "./operator-normalization";
import { selectFinderCandidate } from "./select-finder-candidate";

export function FinderResultsTable({ model }: { model: FinderControllerContract }) {
  const [expanded, setExpanded] = useState(false);
  const {
    candidates,
    selectedOpportunity,
    candidateSort,
    updateSearch,
    rankingState,
    rankingCollection,
    project,
    setPreviewCandidateId,
  } = model;
  const close = () => {
    void updateSearch({ resultsView: undefined });
    window.requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>('[data-finder-view="cards"]')?.focus(),
    );
  };
  const sortHeader = (label: string, sort: CandidateSort) => (
    <th
      scope="col"
      aria-sort={
        candidateSort === sort ? (sort === "name" ? "ascending" : "descending") : undefined
      }
    >
      <button type="button" onClick={() => void updateSearch({ sort })}>
        {label}
        {candidateSort === sort ? (
          <span aria-hidden="true"> {sort === "name" ? "↑" : "↓"}</span>
        ) : null}
      </button>
    </th>
  );
  return (
    <section
      className={`finder-results-dock${expanded ? " is-expanded" : ""}`}
      aria-labelledby="finder-results-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
    >
      <header>
        <div>
          <h2 id="finder-results-title">Candidate table</h2>
          <p>
            {rankingState === "loading"
              ? "Updating candidates…"
              : `${candidates.length} retrieved site-to-node matches`}{" "}
            · investigation only
          </p>
        </div>
        <div className="finder-results-dock__actions">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="finder-results-scroll"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Compact table" : "Expand table"}
          </button>
          <button type="button" onClick={close}>
            Return to cards
          </button>
        </div>
      </header>
      {rankingCollection?.metadata.retrieval_capped && (
        <p role="status">Incomplete candidate sample: retrieval limit reached.</p>
      )}
      <div
        id="finder-results-scroll"
        className="finder-results-scroll"
        tabIndex={0}
        role="region"
        aria-label="Scrollable candidate table"
      >
        <table>
          <caption>
            Current ranked candidate matches. Mapped evidence and investigation fit do not establish
            available capacity.
          </caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              {sortHeader("Candidate", "name")}
              {sortHeader("Mapped voltage", "voltage")}
              <th scope="col">Distance</th>
              <th scope="col">Mapped operator</th>
              {sortHeader("Investigation fit", "context")}
              <th scope="col">Import capacity</th>
            </tr>
          </thead>
          <tbody>
            {(rankingState === "ready" ? candidates : []).map((candidate, index) => (
              <tr
                key={candidate.id}
                data-selected={selectedOpportunity?.id === candidate.id ? "true" : undefined}
              >
                <td>{index + 1}</td>
                <th scope="row">
                  <button
                    type="button"
                    aria-label={`Show ${candidate.nodeName} on map, ${formatScore(candidate.screeningRank)}/100`}
                    aria-pressed={selectedOpportunity?.id === candidate.id}
                    onClick={() => void selectFinderCandidate(model, candidate)}
                    onMouseEnter={() => setPreviewCandidateId(candidate.id)}
                    onMouseLeave={() => setPreviewCandidateId(null)}
                    onFocus={() => setPreviewCandidateId(candidate.id)}
                    onBlur={() => setPreviewCandidateId(null)}
                  >
                    {candidate.nodeName}
                    <small>{candidate.siteName}</small>
                  </button>
                </th>
                <td>
                  {candidate.voltageKv.length
                    ? `${Math.max(...candidate.voltageKv)} kV`
                    : "Unknown"}
                </td>
                <td>{distanceFormatter.format(candidate.distanceKm)} km</td>
                <td>{formatOperatorNames(candidate.operator) ?? "Unconfirmed"}</td>
                <td>{formatScore(candidate.screeningRank)}/100</td>
                <td>Unverified</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!candidates.length || rankingState === "error") && (
          <p role="status">
            {project.latitude == null || project.longitude == null
              ? "Choose a site to rank candidates."
              : rankingState === "error"
                ? "Candidate retrieval is unavailable. Try again; no absence of infrastructure is established."
                : rankingState === "loading"
                  ? "Loading candidate evidence…"
                  : "No retrieved candidates match. Adjust the search filters; this is not evidence of no connection options."}
          </p>
        )}
      </div>
    </section>
  );
}
