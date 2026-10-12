import { loadPowerFinderViewport } from "@/features/power-finder/data-source";
import {
type PowerFinderCollection,
type PowerFinderFeature,
} from "@/features/power-finder/fixture-data";
import {
discoverLocations,
type DiscoveryStrategy,
} from "@/features/power-finder/location-discovery";
import { loadRegionalDiscoverySamples } from "@/features/power-finder/regional-discovery-sampling";
import type { useFinderController } from "./use-finder-controller";
export function FinderDiscoveryIntro({ model }: { model: ReturnType<typeof useFinderController> }) {
  const {
    search,
    collection,
    project,
    bounds,
    maxDistanceKm,
    updateSearch,
    updateProject,
    setInteractionNotice,
    discoveryStrategy,
    setDiscoveryStrategy,
    discoveryResultCount,
    setDiscoveryResultCount,
    setDiscoveryResults,
    setSelectedDiscoveryId,
    discoveryState,
    setDiscoveryState,
    invalidateDiscoveryResults,
    generationGroup,
    setGenerationGroup,
    minimumGenerationMw,
    minimumStorageMw,
    setMinimumGenerationMw,
    setMinimumStorageMw,
    setMapNavigationTarget,
    coverage,
    regionCode,
    activeCoverage,
  } = model;
  return (
    <section className="finder-discovery-intro" aria-labelledby="finder-discovery-title">
      <p className="context-label">Regional opportunity discovery</p>
      <h2 id="finder-discovery-title">Find investigation areas in {activeCoverage.regionName}</h2>
      <p>
        Compare mapped grid context, industrial land and the surrounding energy ecosystem without
        treating public mapping as capacity or feasibility evidence.
      </p>
      <div className="finder-discovery-form">
        <label>
          <span>Bundesland</span>
          <select
            value={regionCode === "DE" ? "DE-BB" : regionCode}
            onChange={(event) => {
              const nextRegion = event.target.value as typeof search.region;
              invalidateDiscoveryResults();
              void updateSearch({ region: nextRegion });
              const nextCoverage = coverage.find((item) => item.regionCode === nextRegion);
              if (nextCoverage) {
                setMapNavigationTarget({
                  requestId: Date.now(),
                  kind: "bounds",
                  bounds: nextCoverage.bounds,
                  maxZoom: nextCoverage.zoom,
                });
              }
            }}
          >
            {coverage
              .filter((item) => item.regionCode !== "DE")
              .map((item) => (
                <option key={item.regionCode} value={item.regionCode}>
                  {item.regionName}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span>Required load (MW)</span>
          <input
            type="number"
            min="1"
            max="1000"
            value={project.importMw}
            onChange={(event) => {
              const value = Math.min(1000, Math.max(1, Number(event.target.value) || 1));
              updateProject({ importMw: value });
              invalidateDiscoveryResults();
            }}
          />
        </label>
        <label>
          <span>Preferred voltage</span>
          <select
            value={project.preferredVoltageKv ?? 0}
            onChange={(event) => {
              updateProject({
                preferredVoltageKv: Number(event.target.value) || null,
              });
              invalidateDiscoveryResults();
            }}
          >
            <option value="0">Any / unknown</option>
            <option value="110">110 kV</option>
            <option value="220">220 kV</option>
            <option value="380">380 kV</option>
          </select>
        </label>
        <label>
          <span>Maximum node distance</span>
          <select
            value={project.maxDistanceKm}
            onChange={(event) => {
              updateProject({ maxDistanceKm: Number(event.target.value) });
              invalidateDiscoveryResults();
            }}
          >
            <option value="10">10 km</option>
            <option value="20">20 km</option>
            <option value="30">30 km</option>
          </select>
        </label>
        <label>
          <span>Ranking strategy</span>
          <select
            value={discoveryStrategy}
            onChange={(event) => {
              setDiscoveryStrategy(event.target.value as DiscoveryStrategy);
              invalidateDiscoveryResults();
            }}
          >
            <option value="connection">Connection-first</option>
            <option value="balanced">Balanced</option>
            <option value="energy">Energy ecosystem</option>
          </select>
        </label>
        <label>
          <span>Number of results</span>
          <select
            value={discoveryResultCount}
            onChange={(event) => {
              setDiscoveryResultCount(Number(event.target.value) as 10 | 20);
              invalidateDiscoveryResults();
            }}
          >
            <option value="10">10 locations</option>
            <option value="20">20 locations</option>
          </select>
        </label>
      </div>
      <button
        type="button"
        className="primary-button"
        disabled={discoveryState === "loading"}
        onClick={() => {
          void (async () => {
            setDiscoveryState("loading");
            setInteractionNotice("Sampling accepted mapped context across the region…");
            try {
              const [west, south, east, north] = activeCoverage.bounds;
              const columns = 4;
              const rows = 4;
              const longitudeStep = (east - west) / columns;
              const latitudeStep = (north - south) / rows;
              const sampleBounds = Array.from({ length: columns * rows }, (_, index) => {
                const column = index % columns;
                const row = Math.floor(index / columns);
                return {
                  west: west + column * longitudeStep,
                  south: south + row * latitudeStep,
                  east: west + (column + 1) * longitudeStep,
                  north: south + (row + 1) * latitudeStep,
                };
              });
              const { samples, fullContextCount, gridOnlyCount, unavailableCount } =
                await loadRegionalDiscoverySamples(sampleBounds, (bounds, options) =>
                  loadPowerFinderViewport(bounds, undefined, options),
                );
              if (samples.length === 0) {
                throw new Error("No regional samples were available.");
              }
              const byId = new Map<string, PowerFinderFeature>();
              for (const sample of samples) {
                for (const feature of sample.collection.features) byId.set(feature.id, feature);
              }
              const regionalCollection: PowerFinderCollection = {
                ...samples[0].collection,
                features: [...byId.values()],
                metadata: {
                  ...samples[0].collection.metadata,
                  title: `${activeCoverage.regionName} discovery sample`,
                  record_count: byId.size,
                  geographic_scope: activeCoverage.bounds,
                },
              };
              const results = discoverLocations(regionalCollection, {
                regionCode: activeCoverage.regionCode,
                requiredMw: project.importMw,
                preferredVoltageKv: project.preferredVoltageKv,
                maxNodeDistanceKm: project.maxDistanceKm,
                resultCount: discoveryResultCount,
                strategy: discoveryStrategy,
                generationGroup,
                minimumGenerationMw,
                minimumStorageMw,
              });
              setDiscoveryResults(results);
              setSelectedDiscoveryId(results[0]?.id ?? null);
              setMapNavigationTarget({
                requestId: Date.now(),
                kind: "bounds",
                bounds: activeCoverage.bounds,
                maxZoom: activeCoverage.zoom,
              });
              setDiscoveryState("ready");
              setInteractionNotice(
                results.length
                  ? `${results.length} geographically distinct investigation locations found${
                      gridOnlyCount > 0 || unavailableCount > 0
                        ? ` from ${samples.length} of ${sampleBounds.length} available regional samples (${fullContextCount} with energy context, ${gridOnlyCount} grid-only)`
                        : " after regional sampling and local refinement"
                    }. ${
                      unavailableCount > 0
                        ? `${unavailableCount} unavailable area${unavailableCount === 1 ? " remains" : "s remain"} unassessed.`
                        : gridOnlyCount > 0
                          ? "Energy-ecosystem context was unavailable for some areas; their scores use grid context only."
                          : ""
                    }`
                  : "No investigation locations met the current mapped-data criteria. Try a wider node distance.",
              );
            } catch {
              setDiscoveryState("error");
              setInteractionNotice("Regional data sampling was incomplete. Please try again.");
            }
          })();
        }}
      >
        {discoveryState === "loading"
          ? "Scanning regional context…"
          : `Find ${discoveryResultCount} investigation locations`}
      </button>
      <small>
        Required load normalises the context score; it does not estimate available capacity. Results
        are recommendations for investigation only.
      </small>
      <details className="finder-discovery-energy-filters" open>
        <summary>Energy context filters</summary>
        <p>
          Limit the registered assets used in the energy-context score and shown on the map. These
          assets provide nearby ecosystem context, not available grid capacity.
        </p>
        <div className="finder-discovery-filter-grid">
          <label>
            <span>Generation technology</span>
            <select
              aria-label="Discovery generation technology"
              value={generationGroup}
              onChange={(event) => {
                setGenerationGroup(event.target.value);
                invalidateDiscoveryResults();
              }}
            >
              <option value="all">All technologies</option>
              <option value="solar">Solar</option>
              <option value="wind">Wind</option>
              <option value="biomass">Biomass</option>
              <option value="hydro">Hydro</option>
              <option value="geothermal">Geothermal</option>
              <option value="nuclear">Nuclear</option>
              <option value="gas">Gas</option>
              <option value="fossil_other">Other fossil</option>
              <option value="other">Other / unknown</option>
            </select>
          </label>
          <label>
            <span>Minimum generation</span>
            <select
              aria-label="Discovery minimum registered generation"
              value={minimumGenerationMw}
              onChange={(event) => {
                setMinimumGenerationMw(Number(event.target.value));
                invalidateDiscoveryResults();
              }}
            >
              <option value="0">Any MW, including unknown</option>
              <option value="1">1+ MW</option>
              <option value="10">10+ MW</option>
              <option value="50">50+ MW</option>
              <option value="100">100+ MW</option>
              <option value="500">500+ MW</option>
            </select>
          </label>
          <label>
            <span>Minimum storage power</span>
            <select
              aria-label="Discovery minimum registered storage power"
              value={minimumStorageMw}
              onChange={(event) => {
                setMinimumStorageMw(Number(event.target.value));
                invalidateDiscoveryResults();
              }}
            >
              <option value="0">Any MW, including unknown</option>
              <option value="1">1+ MW</option>
              <option value="10">10+ MW</option>
              <option value="50">50+ MW</option>
              <option value="100">100+ MW</option>
            </select>
          </label>
        </div>
      </details>
    </section>
  );
}
