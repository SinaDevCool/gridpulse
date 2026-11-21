import type { FinderControllerContract } from "./controller-contract";
import { pointCoordinates } from "./fixture-data";
import { canonicalOperatorName, knownOperatorRole } from "./operator-normalization";
import { sourcePublicationDate } from "./source-provenance";

export function FinderRecordContext({ model }: { model: FinderControllerContract }) {
  const f = model.selectedDetailFeature;
  if (!f) return null;
  const operator = canonicalOperatorName(f.properties.operator);
  const point = pointCoordinates(f);
  const published = model.collection
    ? sourcePublicationDate(model.collection, f)
    : f.properties.source_published_at;
  return (
    <details className="finder-record-context">
      <summary>Record provenance &amp; connected exploration</summary>
      {model.selectedOpportunity && (
        <details>
          <summary>Why this candidate matches</summary>
          <p>{model.selectedOpportunity.suitabilityNote}</p>
          <p>
            Mapped voltage relevance: {model.selectedOpportunity.voltageFit}; straight-line
            distance: {model.selectedOpportunity.distanceKm} km. Investigation fit does not
            establish capacity or probability.
          </p>
          {model.selectedOpportunity.rankComponents && (
            <dl>
              {Object.entries(model.selectedOpportunity.rankComponents).map(([key, value]) => (
                <div key={key}>
                  <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
                  <dd>{value}/100 component</dd>
                </div>
              ))}
            </dl>
          )}
          <p>
            Missing evidence:{" "}
            {model.selectedOpportunity.missingEvidence.join("; ") ||
              "No additional fields listed; capacity still requires operator confirmation."}
          </p>
        </details>
      )}
      <dl>
        <div>
          <dt>Source record</dt>
          <dd>{f.id}</dd>
        </div>
        <div>
          <dt>Evidence class</dt>
          <dd>{f.properties.evidence_class.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt>Source publication</dt>
          <dd>{published || "Not established"}</dd>
        </div>
      </dl>
      {f.properties.source_url && /^https?:\/\//i.test(f.properties.source_url) && (
        <a href={f.properties.source_url} target="_blank" rel="noreferrer">
          Original record source
        </a>
      )}
      {operator && (
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            model.setSelected(null);
            model.setSelectedOpportunitySnapshot(null);
            model.navigateMapToOperator(operator);
            void model.updateSearch({
              dso: knownOperatorRole(operator) === "TSO" ? undefined : operator,
              tso: knownOperatorRole(operator) === "TSO" ? operator : undefined,
              operator: undefined,
              candidate: undefined,
              compare: undefined,
              resultsView: "assets",
              mapArea: undefined,
            });
          }}
        >
          Explore mapped operator: {operator}
        </button>
      )}
      {point && (
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            model.setSelected(null);
            model.setSelectedOpportunitySnapshot(null);
            model.setActiveProperty(null);
            model.setFinderWorkflow("screen");
            model.updateProject({ latitude: point[1], longitude: point[0] });
            void model.updateSearch({
              lat: point[1],
              lng: point[0],
              site: undefined,
              mapArea: undefined,
              propertyId: undefined,
              workflow: "screen",
              resultsView: "table",
              candidate: undefined,
              compare: undefined,
            });
          }}
        >
          Use mapped point in screening brief
        </button>
      )}
      <p>Using a mapped point does not establish land control or a buildable property.</p>
      <p>
        Mapped operator labels and extents do not establish company ownership or responsibility for
        a new connection. Filtered records remain a retrieved sample.
      </p>
    </details>
  );
}
