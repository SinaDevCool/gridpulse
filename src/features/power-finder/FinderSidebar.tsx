import { finderMvpFeatures } from "@/config/product-mode";
import { AlertTriangle, Database } from "lucide-react";
import { FinderCandidates } from "./FinderCandidates";
import { FinderCapacityCard } from "./FinderCapacityCard";
import { FinderLayersMenu } from "./FinderLayersMenu";
import { FinderRailHeader } from "./FinderRailHeader";
import { FinderScreeningControls } from "./FinderScreeningControls";
import type { FinderControllerContract } from "./controller-contract";
export function FinderSidebar({ model }: { model: FinderControllerContract }) {
  const {
    collection,
    project,
    dataMode,
    activeProperty,
    interactionNotice,
    finderWorkflow,
    discoveryResults,
    selectedDiscoveryId,
    setSelectedDiscoveryId,
    navigateMapToPoint,
    activeCoverage,
    coordinates,
  } = model;
  return (
    <section className="power-finder-sidebar" aria-label="Power Finder controls">
      <FinderRailHeader model={model} />
      <header>
        <p className="context-label">Power Finder · Public-source screen</p>
        <h1>{activeProperty ? project.name : `${activeCoverage.regionName} connection context`}</h1>
        <p>
          Explore grid proximity, mapped voltage, industrial land and the evidence behind each
          screening candidate.
        </p>
      </header>

      <aside className="power-finder-boundary">
        <AlertTriangle aria-hidden="true" />
        <div>
          <strong>Screening context—not a connection offer</strong>
          <p>Unknown MW, responsibility, feasibility, cost, and dates remain unknown.</p>
        </div>
      </aside>

      <FinderScreeningControls model={model} />

      <p className="sr-only" role="status" aria-live="polite">
        {interactionNotice}
      </p>

      {finderMvpFeatures.syntheticCapacity ? <FinderCapacityCard model={model} /> : null}

      <FinderLayersMenu model={model} />

      {finderWorkflow === "discover" && discoveryResults.length > 0 ? (
        <section
          className="finder-discovery-results-panel"
          aria-labelledby="finder-discovery-results-title"
        >
          <header>
            <div>
              <p className="context-label">Investigation shortlist</p>
              <h2 id="finder-discovery-results-title">Ranked areas</h2>
            </div>
            <span>{discoveryResults.length}</span>
          </header>
          <p>
            Select an area to inspect it on the map. These are screening leads, not confirmed sites
            or available capacity.
          </p>
          <ol className="finder-discovery-results">
            {discoveryResults.map((result, index) => (
              <li key={result.id}>
                <button
                  type="button"
                  className={selectedDiscoveryId === result.id ? "is-active" : ""}
                  aria-current={selectedDiscoveryId === result.id ? "true" : undefined}
                  onClick={() => {
                    setSelectedDiscoveryId(result.id);
                    navigateMapToPoint(result.coordinates);
                  }}
                >
                  <span>{index + 1}</span>
                  <div>
                    <strong>{result.name}</strong>
                    <small>
                      {result.score}/100 investigation fit · {result.nodeDistanceKm} km to{" "}
                      {result.node.properties.voltage_kv?.join("/") || "unknown"} kV node
                    </small>
                  </div>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <FinderCandidates model={model} />

      {collection && (
        <footer className="power-finder-source">
          <Database aria-hidden="true" />
          <div>
            <strong>{collection.metadata.publisher}</strong>
            <span>
              {collection.metadata.freshness} · {collection.metadata.record_count} records ·{" "}
              {dataMode === "database"
                ? "private workspace database query"
                : dataMode === "public_database"
                  ? "live public viewport"
                  : "accepted static fallback"}
            </span>
            <small>{collection.metadata.attribution}</small>
          </div>
        </footer>
      )}
    </section>
  );
}
