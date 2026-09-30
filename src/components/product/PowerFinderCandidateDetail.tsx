import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import {
  voltageFitLabels,
  type CandidateOpportunity,
} from "@/features/power-finder/candidate-intelligence";
import { buildCandidateDetailModel } from "@/features/power-finder/candidate-detail-model";
import type { PowerFinderFeature } from "@/features/power-finder/fixture-data";
import type { GridOperatorOption } from "@/features/power-finder/operator-catalog";

type PowerFinderCandidateDetailProps = {
  candidate: CandidateOpportunity;
  feature: PowerFinderFeature;
  operatorCatalog: GridOperatorOption[];
  actions: ReactNode;
  extraEvidence?: ReactNode;
  operatorCatalogState?: "loading" | "ready" | "unavailable";
};

export function PowerFinderCandidateDetail({
  candidate,
  feature,
  operatorCatalog,
  actions,
  extraEvidence,
  operatorCatalogState = "ready",
}: PowerFinderCandidateDetailProps) {
  const model = buildCandidateDetailModel(candidate, feature, operatorCatalog);
  const operatorType =
    operatorCatalogState === "loading"
      ? "Classifying…"
      : operatorCatalogState === "unavailable"
        ? "Unavailable"
        : (model.operator.mappedRole ?? "Unknown");

  return (
    <section className="candidate-detail" aria-label="Candidate decision summary">
      <div className="candidate-decision-summary">
        <div className="candidate-decision-score">
          <strong>{model.score.toFixed(1)}</strong>
          <span>/100 investigation fit</span>
        </div>
        <dl>
          <div>
            <dt>Capacity evidence</dt>
            <dd>{model.capacityStatus}</dd>
          </div>
          <div>
            <dt>Evidence completeness</dt>
            <dd>{model.evidenceCompleteness}</dd>
          </div>
        </dl>
        <p>{model.capacityExplanation}</p>
      </div>

      <section className="candidate-operator-card" aria-labelledby="candidate-operator-title">
        <h3 id="candidate-operator-title">Operator context</h3>
        {model.operator.mappedOperator ? (
          <dl>
            <div>
              <dt>Operator</dt>
              <dd>{model.operator.mappedOperator}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{operatorType}</dd>
            </div>
            {model.operator.upstreamTso ? (
              <div>
                <dt>Upstream TSO</dt>
                <dd>{model.operator.upstreamTso}</dd>
              </div>
            ) : null}
            <div>
              <dt>Status</dt>
              <dd>Connection responsibility not confirmed</dd>
            </div>
            <div>
              <dt>Data basis</dt>
              <dd>
                {model.operator.relationshipBasis === "mapped_proximity"
                  ? "Public mapping · geographic association"
                  : `${model.operator.sourceLabel} · confirmation required`}
              </dd>
            </div>
          </dl>
        ) : (
          <p>Operator responsibility has not been established from the available mapping.</p>
        )}
      </section>

      <section className="candidate-next-step" aria-labelledby="candidate-next-step-title">
        <h3 id="candidate-next-step-title">Next step</h3>
        <p>{model.nextStep}</p>
      </section>

      <div className="candidate-primary-actions">{actions}</div>

      <div className="candidate-detail-disclosures">
        <details>
          <summary>
            Why this candidate ranks highly <ChevronDown aria-hidden="true" />
          </summary>
          <p>{model.rankingSummary}</p>
          <dl>
            <div>
              <dt>Distance</dt>
              <dd>{candidate.distanceKm} km straight-line</dd>
            </div>
            <div>
              <dt>Voltage screen</dt>
              <dd>{voltageFitLabels[candidate.voltageFit]}</dd>
            </div>
            <div>
              <dt>Ranking model</dt>
              <dd>{candidate.calculationVersion}</dd>
            </div>
          </dl>
        </details>

        <details>
          <summary>
            Evidence &amp; provenance <ChevronDown aria-hidden="true" />
          </summary>
          <dl>
            <div>
              <dt>Infrastructure source</dt>
              <dd>
                {feature.properties.evidence_class === "open_mapping"
                  ? "OpenStreetMap-derived mapping"
                  : feature.properties.evidence_class.replaceAll("_", " ")}
              </dd>
            </div>
            <div>
              <dt>Source published</dt>
              <dd>{feature.properties.source_published_at ?? "Not published"}</dd>
            </div>
            <div>
              <dt>Capacity status</dt>
              <dd>{model.capacityStatus}</dd>
            </div>
          </dl>
          {extraEvidence}
        </details>

        <details>
          <summary>
            What must be confirmed <ChevronDown aria-hidden="true" />
          </summary>
          <ul>
            <li>Responsible connection operator and suitable connection point</li>
            <li>Available import capacity and connection feasibility</li>
            <li>Indicative programme, cost and reinforcement scope</li>
          </ul>
        </details>
      </div>
    </section>
  );
}
