import { finderMvpFeatures,productCapabilities } from "@/config/product-mode";
import { mapIsolationSearchPatch } from "@/features/map/map-url-state";
import {
removeComparisonCandidate,
serializeComparison,
} from "@/features/power-finder/candidate-comparison";
import { resolveCandidateOperatorContext } from "@/features/power-finder/candidate-detail-model";
import {
highestRankedOpportunityForNode,
voltageFitLabels,
} from "@/features/power-finder/candidate-intelligence";
import { discoveryGeoJson } from "@/features/power-finder/location-discovery";
import { formatOperatorNames } from "@/features/power-finder/operator-normalization";
import {
Database,
ExternalLink,
GitCompareArrows,
PanelLeftClose,
PanelLeftOpen,
ShieldCheck,
X,
} from "lucide-react";
import { Suspense } from "react";
import { FinderDetailPanel } from "./FinderDetailPanel";
import { formatScore } from './page-formatting';
import { ActivationStudyPanel,InteractiveMapLegend,PowerFinderMap } from './page-support';
import type { useFinderController } from "./use-finder-controller";
export function FinderStage({ model }: { model: ReturnType<typeof useFinderController> }) {
  const {
    basemapMode,
    collection,
    project,
    selected,
    setSelected,
    setSelectedOpportunitySnapshot,
    enabled,
    error,
    bounds,
    setBounds,
    runtimeSourceStatus,
    setRuntimeSourceStatus,
    c1Study,
    updateSearch,
    updateProject,
    setNumericDrafts,
    setFieldErrors,
    setInteractionNotice,
    setVisibleLayerCounts,
    comparisonOpen,
    setComparisonOpen,
    sidebarOpen,
    setSidebarOpen,
    legendOpen,
    setLegendOpen,
    showDataCentres,
    selectedDataCentre,
    setSelectedDataCentre,
    finderWorkflow,
    discoveryResults,
    setSelectedDiscoveryId,
    generationGroup,
    mapFilters,
    dispatchMapFilter,
    minimumGenerationMw,
    minimumStorageMw,
    setMinimumStorageMw,
    setMaximumStorageMw,
    basemapStatus,
    setBasemapStatus,
    mapRetryKey,
    setMapRetryKey,
    mapNavigationTarget,
    coverage,
    operatorCatalog,
    regionCode,
    mapMode,
    capacityMetric,
    requiredCapacityMw,
    capacitySource,
    capacityViewport,
    berlinCapacity,
    mapSourceSummary,
    registryAssetsUnavailable,
    isolatedVoltageClass,
    effectiveGenerationGroup,
    effectiveEnabled,
    legendSections,
    isolateMapLegendItem,
    activeLegendTitle,
    viewportTarget,
    projectSite,
    visibleCollection,
    activeCapacityNodes,
    candidates,
    selectedOpportunity,
    previewFeature,
    comparisonIds,
    comparedCandidates,
    comparedActivation,
    activationOpen,
    activationTab,
    startPrivateAssessment,
  } = model;
  return (
    <section
      className="power-finder-stage"
      data-basemap-status={basemapStatus}
      data-grid-source-status={runtimeSourceStatus.grid ?? "loading"}
      data-registry-source-status={runtimeSourceStatus.registry ?? "loading"}
    >
      <button
        type="button"
        className="power-finder-sidebar-toggle"
        aria-label={sidebarOpen ? "Hide map controls" : "Show map controls"}
        aria-expanded={sidebarOpen}
        onClick={() => {
          setSidebarOpen((current) => !current);
          window.setTimeout(() => window.dispatchEvent(new Event("resize")), 200);
        }}
      >
        {sidebarOpen ? <PanelLeftClose aria-hidden="true" /> : <PanelLeftOpen aria-hidden="true" />}
        <span>{sidebarOpen ? "Hide panel" : "Show panel"}</span>
      </button>
      {basemapStatus === "fallback" && (
        <div className="power-finder-basemap-notice" role="status" aria-live="polite">
          <span>
            Background map is temporarily unavailable. Grid infrastructure and screening data remain
            available.
          </span>
          <button
            type="button"
            onClick={() => {
              setBasemapStatus("loading");
              setMapRetryKey((current) => current + 1);
            }}
          >
            Retry Background Map
          </button>
        </div>
      )}
      {error && <div className="power-finder-error">{error}</div>}
      {!visibleCollection && !error && (
        <div className="power-finder-loading">Loading map context…</div>
      )}
      {visibleCollection && (
        <Suspense fallback={<div role="status">Loading grid map…</div>}>
          <PowerFinderMap
            key={mapRetryKey}
            collection={visibleCollection}
            enabledLayers={effectiveEnabled}
            selectedFeature={selected}
            previewFeature={previewFeature}
            mapMode={mapMode}
            basemapMode={basemapMode}
            onBasemapStatusChange={setBasemapStatus}
            onDataSourceStatusChange={setRuntimeSourceStatus}
            generationGroup={effectiveGenerationGroup}
            minimumGenerationMw={minimumGenerationMw}
            maximumGenerationMw={mapFilters.maximumGenerationMw}
            minimumStorageMw={minimumStorageMw}
            maximumStorageMw={mapFilters.maximumStorageMw}
            isolatedVoltageClass={isolatedVoltageClass}
            scaleMarkersByCapacity={mapFilters.scaleMarkersByCapacity}
            capacityNodes={activeCapacityNodes}
            capacityCoverage={
              capacitySource === "berlin_synthetic" ? (berlinCapacity?.coverage ?? null) : null
            }
            capacityMetric={capacityMetric}
            requiredCapacityMw={requiredCapacityMw}
            viewportTarget={viewportTarget}
            navigationTarget={mapNavigationTarget}
            onSelect={(feature) => {
              setSelectedDataCentre(null);
              setSelected(feature);
              if (feature.properties.kind === "node") {
                const matchingOpportunity = highestRankedOpportunityForNode(
                  candidates,
                  String(feature.id),
                );
                if (matchingOpportunity) {
                  setSelectedOpportunitySnapshot(matchingOpportunity);
                  const pathwayCount = candidates.filter(
                    (candidate) => candidate.nodeId === String(feature.id),
                  ).length;
                  setInteractionNotice(
                    pathwayCount > 1
                      ? `${feature.properties.name} selected. Showing the highest-ranked of ${pathwayCount} pathways using this node.`
                      : `${feature.properties.name} selected and matched to its ranked candidate.`,
                  );
                  void updateSearch({ candidate: matchingOpportunity.id });
                  return;
                }
                setInteractionNotice(
                  `${feature.properties.name} is outside the current ranked shortlist. Change the filters or project location to evaluate it.`,
                );
              } else {
                setInteractionNotice(`${feature.properties.name} selected on the map.`);
              }
              void updateSearch({ candidate: undefined });
            }}
            onViewportChange={setBounds}
            projectSite={projectSite}
            onSitePlacement={([longitude, latitude]) => {
              const containingRegion = coverage.find((item) => {
                if (item.regionCode === "DE") return false;
                const [west, south, east, north] = item.bounds;
                return (
                  longitude >= west && longitude <= east && latitude >= south && latitude <= north
                );
              });
              updateProject({ longitude, latitude });
              setNumericDrafts((current) => ({
                ...current,
                longitude: longitude.toFixed(6),
                latitude: latitude.toFixed(6),
              }));
              setFieldErrors((current) => ({
                ...current,
                longitude: undefined,
                latitude: undefined,
              }));
              setInteractionNotice("Site changed. Candidate selection and comparison were reset.");
              void updateSearch({
                lng: longitude,
                lat: latitude,
                region: containingRegion?.regionCode as typeof regionCode | undefined,
                candidate: undefined,
                compare: undefined,
              });
            }}
            onVisibleLayerCounts={setVisibleLayerCounts}
            discoveryLocations={
              finderWorkflow === "discover" ? discoveryGeoJson(discoveryResults) : null
            }
            onDiscoverySelect={(id) => {
              const result = discoveryResults.find((item) => item.id === id);
              if (!result) return;
              setSelectedDiscoveryId(id);
              setInteractionNotice(
                `${result.name}: ${result.score}/100 investigation fit. Capacity remains unknown.`,
              );
            }}
            showDataCentres={showDataCentres}
            onDataCentreSelect={(dataCentre) => {
              setSelected(null);
              setSelectedOpportunitySnapshot(null);
              setSelectedDataCentre(dataCentre);
              void updateSearch({ candidate: undefined });
              setInteractionNotice(`${dataCentre.name} selected from the data-centre layer.`);
            }}
          />
        </Suspense>
      )}
      {selectedDataCentre ? (
        <aside className="rzreg-detail-card" aria-label="Selected RZReg data centre">
          <header>
            <div className="rzreg-detail-card__eyebrow">
              <Database aria-hidden="true" />
              <span>German Data Centre Register</span>
            </div>
            <button
              type="button"
              aria-label="Close data-centre details"
              onClick={() => setSelectedDataCentre(null)}
            >
              <X aria-hidden="true" />
            </button>
          </header>
          <div className="rzreg-detail-card__body">
            <span
              className={`rzreg-precision-badge rzreg-precision-badge--${
                selectedDataCentre.locationPrecision === "facility_address"
                  ? "exact"
                  : "approximate"
              }`}
            >
              {selectedDataCentre.locationPrecision === "facility_address"
                ? "Published Facility Address"
                : "Postcode Area Only"}
            </span>
            <h2>{selectedDataCentre.name}</h2>
            <p className="rzreg-detail-card__operator">{selectedDataCentre.operator}</p>

            <dl className="rzreg-detail-card__facts">
              <div>
                <dt>Published location</dt>
                <dd>
                  {selectedDataCentre.address ?? `Postcode ${selectedDataCentre.postcode}, Germany`}
                </dd>
              </div>
              <div>
                <dt>Map precision</dt>
                <dd>
                  {selectedDataCentre.locationPrecision === "facility_address"
                    ? "Address-level geocode"
                    : "Approximate postcode centroid"}
                </dd>
              </div>
            </dl>

            <div className="rzreg-detail-card__boundary">
              <ShieldCheck aria-hidden="true" />
              <div>
                <strong>Evidence boundary</strong>
                <p>
                  {selectedDataCentre.locationPrecision === "facility_address"
                    ? "The published address was validated against admitted public evidence."
                    : "The marker represents a postcode area—not the data-centre building."}{" "}
                  Grid capacity, headroom and connection feasibility remain unknown.
                </p>
              </div>
            </div>

            {selectedDataCentre.sourceUrl ? (
              <a
                className="rzreg-detail-card__source"
                href={selectedDataCentre.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open Published Evidence <ExternalLink aria-hidden="true" />
              </a>
            ) : (
              <p className="rzreg-detail-card__source-missing">
                Record-level public address evidence is not available for this location.
              </p>
            )}
          </div>
        </aside>
      ) : null}
      <Suspense fallback={<span role="status">Loading map legend…</span>}>
        <InteractiveMapLegend
          title={activeLegendTitle}
          open={legendOpen}
          onOpenChange={setLegendOpen}
          sections={legendSections}
          isolated={mapFilters.isolation}
          onIsolate={isolateMapLegendItem}
          onReset={() => {
            dispatchMapFilter({ type: "clear_isolation" });
            void updateSearch(mapIsolationSearchPatch(null));
            setInteractionNotice("Legend isolation cleared.");
          }}
          className="power-finder-interactive-legend"
          sourceSummary={
            mapSourceSummary
              ? `Public mapped evidence · ${mapSourceSummary.health === "live" ? "current coverage" : "partial coverage"}`
              : undefined
          }
        >
          {enabled.storage_asset && !registryAssetsUnavailable ? (
            <fieldset className="interactive-map-legend__custom storage-legend-controls">
              <legend>Registered power range</legend>
              <label>
                <span>Minimum</span>
                <select
                  name="storage-minimum-mw"
                  value={minimumStorageMw}
                  onChange={(event) => setMinimumStorageMw(Number(event.target.value))}
                >
                  <option value="0">Any MW</option>
                  <option value="1">1+ MW</option>
                  <option value="10">10+ MW</option>
                  <option value="50">50+ MW</option>
                  <option value="100">100+ MW</option>
                </select>
              </label>
              <label>
                <span>Maximum</span>
                <select
                  name="storage-maximum-mw"
                  value={mapFilters.maximumStorageMw ?? ""}
                  onChange={(event) =>
                    setMaximumStorageMw(event.target.value ? Number(event.target.value) : null)
                  }
                >
                  <option value="">No maximum</option>
                  <option value="10">10 MW</option>
                  <option value="50">50 MW</option>
                  <option value="100">100 MW</option>
                  <option value="500">500 MW</option>
                </select>
              </label>
              <label className="storage-legend-controls__scale">
                <input
                  type="checkbox"
                  checked={mapFilters.scaleMarkersByCapacity}
                  onChange={(event) =>
                    dispatchMapFilter({
                      type: "set_capacity_scaling",
                      enabled: event.currentTarget.checked,
                    })
                  }
                />
                <span>Scale by MW</span>
              </label>
            </fieldset>
          ) : null}
          {mapMode === "capacity" ? (
            <div className="interactive-map-legend__custom power-finder-data-legend">
              <span>
                <i className="legend-capacity-high" /> Meets {requiredCapacityMw} MW
              </span>
              <span>
                <i className="legend-capacity-activation" /> Alternative pathway
              </span>
              <span>
                <i className="legend-capacity-low" /> Below {requiredCapacityMw} MW
              </span>
              <span>
                <i className="legend-capacity-stale" /> Stale · recalculate
              </span>
              <small>
                {capacitySource === "berlin_synthetic"
                  ? "Berlin pocket · mapped nodes, synthetic 110 kV model; not operator headroom"
                  : capacityViewport?.nodes[0]
                    ? `${capacityViewport.nodes[0].scenarioLabel} · ${capacityViewport.nodes[0].modelVersion}`
                    : "No reviewed results in this workspace view"}
              </small>
            </div>
          ) : null}
        </InteractiveMapLegend>
      </Suspense>

      {finderMvpFeatures.activationStudy && activationOpen && selectedOpportunity && (
        <Suspense
          fallback={<div className="activation-study-loading">Loading Activation Study…</div>}
        >
          <ActivationStudyPanel
            project={project}
            candidate={selectedOpportunity}
            registeredStudy={c1Study}
            referenceCapacity={null}
            tab={activationTab}
            onTabChange={(studyTab) => void updateSearch({ studyTab })}
            onClose={() => void updateSearch({ study: undefined, studyTab: undefined })}
            onStartAssessment={productCapabilities.workspace ? startPrivateAssessment : undefined}
          />
        </Suspense>
      )}

      {comparedCandidates.length > 0 && (
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
                            {resolveCandidateOperatorContext(candidate, operatorCatalog)
                              .mappedRole ?? "Unknown"}
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
      )}

      <FinderDetailPanel model={model} />
    </section>
  );
}
