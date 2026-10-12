import {
  removeComparisonCandidate,
  serializeComparison,
} from "@/features/power-finder/candidate-comparison";
import { resolveCandidateOperatorContext } from "@/features/power-finder/candidate-detail-model";
import { voltageFitLabels } from "@/features/power-finder/candidate-intelligence";
import { formatOperatorNames } from "@/features/power-finder/operator-normalization";
import { GitCompareArrows } from "lucide-react";
import type { FinderControllerContract } from "./controller-contract";
import { formatScore } from "./page-formatting";
export function FinderComparisonPanel({ model }: { model: FinderControllerContract }) {
  const {
    project,
    updateSearch,
    setInteractionNotice,
    comparisonOpen,
    setComparisonOpen,
    operatorCatalog,
    comparisonIds,
    comparedCandidates,
    comparedActivation,
  } = model;
  return (
    <section
      className={`candidate-comparison ${comparisonOpen ? "open" : ""}`}
      aria-label="Candidate comparison"
    >
      <header>
        <span>
          <GitCompareArrows aria-hidden="true" />
          <b>
            Compare {comparedCandidates.length}{" "}
            {comparedCandidates.length === 1 ? "Candidate" : "Candidates"}
          </b>
        </span>
        <button
          type="button"
          aria-expanded={comparisonOpen}
          onClick={() => setComparisonOpen((current) => !current)}
        >
          {comparisonOpen ? "Close" : "Open comparison"}
        </button>
      </header>
      {comparisonOpen && (
        <div>
          {comparedCandidates.map((candidate) => (
            <article key={candidate.id}>
              <strong>{candidate.siteName}</strong>
              <span>{candidate.nodeName}</span>
              <button
                type="button"
                className="candidate-comparison-remove"
                aria-label={`Remove ${candidate.nodeName} from comparison`}
                onClick={() => {
                  const next = removeComparisonCandidate(comparisonIds, candidate.id);
                  setInteractionNotice("Candidate removed from comparison.");
                  void updateSearch({ compare: serializeComparison(next) });
                }}
              >
                Remove
              </button>
              <dl>
                <div>
                  <dt>Rank</dt>
                  <dd>{formatScore(candidate.screeningRank)}/100</dd>
                </div>
                <div>
                  <dt>Distance</dt>
                  <dd>{candidate.distanceKm} km</dd>
                </div>
                <div>
                  <dt>Voltage screen</dt>
                  <dd>{voltageFitLabels[candidate.voltageFit]}</dd>
                </div>
                <div>
                  <dt>Evidence</dt>
                  <dd>{candidate.confidence} completeness</dd>
                </div>
                <div>
                  <dt>Operator</dt>
                  <dd>
                    {formatOperatorNames(candidate.operator) ?? "Confirm"}
                    {candidate.operator ? (
                      <small>
                        {resolveCandidateOperatorContext(candidate, operatorCatalog).mappedRole ??
                          "Unknown"}
                      </small>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>Import / export</dt>
                  <dd>
                    {project.importMw} / {project.exportMw} MW
                  </dd>
                </div>
                <div>
                  <dt>Evidence gaps</dt>
                  <dd>{candidate.missingEvidence.length}</dd>
                </div>
                <div>
                  <dt>Activation strategy</dt>
                  <dd>
                    {comparedActivation.get(candidate.id)?.recommendedOption?.title ??
                      "Not established"}
                  </dd>
                </div>
                <div>
                  <dt>Initial / eventual benchmark</dt>
                  <dd>
                    {(() => {
                      const option = comparedActivation.get(candidate.id)?.recommendedOption;
                      return option
                        ? `${option.initialImportMw.toFixed(1)} / ${option.eventualImportMw.toFixed(1)} MW`
                        : "—";
                    })()}
                  </dd>
                </div>
                <div>
                  <dt>Representative restrictions</dt>
                  <dd>
                    {comparedActivation.get(candidate.id)?.recommendedOption?.analysis
                      ?.restrictedHours ?? "—"}{" "}
                    h
                  </dd>
                </div>
                <div>
                  <dt>Primary validation blocker</dt>
                  <dd>
                    {comparedActivation.get(candidate.id)?.recommendedOption?.nextAction ??
                      "Confirm operator evidence"}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
      {comparisonOpen && (
        <button
          type="button"
          className="candidate-comparison-clear"
          onClick={() => {
            if (!window.confirm("Clear every candidate from this comparison?")) return;
            setComparisonOpen(false);
            setInteractionNotice("Candidate comparison cleared.");
            void updateSearch({ compare: undefined });
          }}
        >
          Clear comparison
        </button>
      )}
    </section>
  );
}
