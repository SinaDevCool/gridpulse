import type { FinderControllerContract } from "./controller-contract";
import { collectionPublicationDate } from "./source-provenance";

export function FinderEvidenceSummary({ model }: { model: FinderControllerContract }) {
  const {
    collection,
    mapSourceSummary: summary,
    runtimeSourceStatus,
    activeCoverage,
    rankingCollection,
  } = model;
  const meta = collection?.metadata;
  return (
    <div className="finder-evidence-summary__body">
      <p>
        {activeCoverage.regionName} · {activeCoverage.status}. {activeCoverage.evidenceBoundary}
      </p>
      <dl>
        <div>
          <dt>Grid tiles</dt>
          <dd>{runtimeSourceStatus.grid ?? "loading"}</dd>
        </div>
        <div>
          <dt>Registry tiles</dt>
          <dd>{runtimeSourceStatus.registry ?? "idle"}</dd>
        </div>
        <div>
          <dt>Public release</dt>
          <dd>{meta?.dataset_release ?? "Not established"}</dd>
        </div>
        <div>
          <dt>Source publication</dt>
          <dd>{(collection && collectionPublicationDate(collection)) || "Not established"}</dd>
        </div>
        <div>
          <dt>Last viewport response</dt>
          <dd>
            {collection
              ? `${collection.features.length} records in a bounded response`
              : "Not loaded"}
          </dd>
        </div>
        <div>
          <dt>Query time</dt>
          <dd>{meta?.queried_at ?? "Not recorded"}</dd>
        </div>
      </dl>
      {(meta?.retrieval_capped || rankingCollection?.metadata.retrieval_capped) && (
        <p role="status">
          Retrieval limit reached. Counts and candidates are an incomplete sample; narrow the
          search.
        </p>
      )}
      <p>
        Tile status describes rendering, not complete source coverage. Viewport records and rendered
        map features are different populations; neither is a national total.
      </p>
      {summary && (
        <ul>
          {Object.entries(summary.layerSources).map(([key, source]) => (
            <li key={key}>
              <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                {source.publisher} · {source.datasetName}
              </a>
              <small>{source.licence}</small>
            </li>
          ))}
        </ul>
      )}
      <p>
        Mapped voltage and registered generation/storage ratings do not establish available import
        MW.
      </p>
      <a href="/data-sources">Source catalogue and methodology</a>
    </div>
  );
}
