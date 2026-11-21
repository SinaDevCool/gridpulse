import { FinderResultsDock } from "./FinderResultsDock";
import { candidateExport, downloadFinderResult } from "./finder-result-export";
import type { FinderControllerContract } from "./controller-contract";
import { distanceFormatter, formatScore, type CandidateSort } from "./page-formatting";
import { formatOperatorNames } from "./operator-normalization";
import { selectFinderCandidate } from "./select-finder-candidate";

export function FinderResultsTable({ model }: { model: FinderControllerContract }) {
  const columns = (model.search.tableColumns ?? "voltage,distance,operator,fit,capacity")
    .split(",")
    .filter((key) => key !== "none");
  const has = (key: string) => columns.includes(key);
  const presets = {
    Compact: "distance,fit",
    Technical: "voltage,distance,operator",
    Evidence: "voltage,distance,operator,fit,capacity",
  };
  const tools = (
    <div className="finder-view-options">
      <div role="group" aria-label="Table column presets">
        {Object.entries(presets).map(([label, value]) => (
          <button
            key={label}
            type="button"
            onClick={() => void model.updateSearch({ tableColumns: value })}
          >
            {label}
          </button>
        ))}
      </div>
      <fieldset>
        <legend>Visible columns (candidate identity always shown)</legend>
        {["voltage", "distance", "operator", "fit", "capacity"].map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={has(key)}
              onChange={() => {
                const next = has(key) ? columns.filter((c) => c !== key) : [...columns, key];
                void model.updateSearch({ tableColumns: next.join(",") || "none" });
              }}
            />
            {key}
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        disabled={model.rankingState !== "ready" || !model.candidates.length}
        onClick={() =>
          downloadFinderResult(
            candidateExport(model.candidates, model.rankingCollection, model.project),
            "gridpulse-candidates",
            "csv",
          )
        }
      >
        Export candidates CSV
      </button>
      <button
        type="button"
        disabled={model.rankingState !== "ready" || !model.candidates.length}
        onClick={() =>
          downloadFinderResult(
            candidateExport(model.candidates, model.rankingCollection, model.project),
            "gridpulse-candidates",
            "json",
          )
        }
      >
        Export candidates JSON
      </button>
      <p>
        Exports include all filtered retrieved matches and their evidence limits, regardless of
        column visibility.
      </p>
    </div>
  );
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
        candidateSort === sort
          ? ["name", "operator", "distance"].includes(sort)
            ? "ascending"
            : "descending"
          : undefined
      }
    >
      <button type="button" onClick={() => void updateSearch({ sort })}>
        {label}
        {candidateSort === sort ? (
          <span aria-hidden="true">
            {" "}
            {["name", "operator", "distance"].includes(sort) ? "↑" : "↓"}
          </span>
        ) : null}
      </button>
    </th>
  );
  return (
    <FinderResultsDock
      title="Candidate table"
      summary={
        rankingState === "loading"
          ? "Updating candidates…"
          : candidates.length + " retrieved site-to-node matches · investigation only"
      }
      onClose={close}
      tools={tools}
    >
      {rankingCollection?.metadata.retrieval_capped && (
        <p role="status">Incomplete candidate sample: retrieval limit reached.</p>
      )}
      <table>
        <caption>
          Current ranked candidate matches. Mapped evidence and investigation fit do not establish
          available capacity.
        </caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            {sortHeader("Candidate", "name")}
            {has("voltage") && sortHeader("Mapped voltage", "voltage")}
            {has("distance") && sortHeader("Distance", "distance")}
            {has("operator") && sortHeader("Mapped operator", "operator")}
            {has("fit") && sortHeader("Investigation fit", "context")}
            {has("capacity") && <th scope="col">Import capacity</th>}
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
              {has("voltage") && (
                <td>
                  {candidate.voltageKv.length
                    ? `${Math.max(...candidate.voltageKv)} kV`
                    : "Unknown"}
                </td>
              )}
              {has("distance") && <td>{distanceFormatter.format(candidate.distanceKm)} km</td>}
              {has("operator") && (
                <td>{formatOperatorNames(candidate.operator) ?? "Unconfirmed"}</td>
              )}
              {has("fit") && <td>{formatScore(candidate.screeningRank)}/100</td>}
              {has("capacity") && <td>Unverified</td>}
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
    </FinderResultsDock>
  );
}
