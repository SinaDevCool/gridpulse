import { mapIsolationSearchPatch } from "@/features/map/map-url-state";
import { type PowerFinderKind } from "@/features/power-finder/fixture-data";
import { kindLabels } from './page-formatting';
import type { useFinderController } from "./use-finder-controller";
export function FinderLayersMenu({ model }: { model: ReturnType<typeof useFinderController> }) {
  const {
    selected,
    setSelected,
    enabled,
    setEnabled,
    updateSearch,
    setInteractionNotice,
    visibleLayerCounts,
    setLegendOpen,
    showDataCentres,
    setShowDataCentres,
    setSelectedDataCentre,
    generationGroup,
    setGenerationGroup,
    mapFilters,
    dispatchMapFilter,
    layersMenuOpen,
    setLayersMenuOpen,
    minimumGenerationMw,
    setMinimumGenerationMw,
    setMaximumGenerationMw,
    registryAssetsUnavailable,
    applyMapPreset,
  } = model;
  return (
    <details className="finder-layers-menu" open={layersMenuOpen} suppressHydrationWarning>
      <summary
        onClick={(event) => {
          event.preventDefault();
          setLayersMenuOpen((open) => !open);
        }}
      >
        Map view &amp; optional layers
      </summary>
      <div className="finder-map-presets" role="group" aria-label="Map view">
        {(
          [
            ["connection", "Connection candidates"],
            ["infrastructure", "Grid infrastructure"],
            ["generation", "Energy context"],
          ] as const
        ).map(([preset, label]) => (
          <button
            key={preset}
            type="button"
            className={mapFilters.preset === preset ? "is-active" : ""}
            aria-pressed={mapFilters.preset === preset}
            onClick={() => applyMapPreset(preset)}
          >
            {label}
          </button>
        ))}
      </div>
      {(enabled.generation_asset || enabled.storage_asset) && registryAssetsUnavailable ? (
        <p className="layer-visibility-note" role="status">
          Registered generation and storage are unavailable in this fallback release. Grid
          infrastructure remains available; no empty map is being presented as zero assets.
        </p>
      ) : null}
      <div className="power-finder-layer-list">
        <label title="German data-centre register records, shown at their validated location precision.">
          <input
            name="layer-rzreg-data-centres"
            type="checkbox"
            checked={showDataCentres}
            onChange={(event) => {
              const checked = event.target.checked;
              setShowDataCentres(checked);
              if (!checked) setSelectedDataCentre(null);
              setInteractionNotice(`Data-centre layer ${checked ? "enabled" : "disabled"}.`);
            }}
          />
          <span>Data centres</span>
          <small>319 total</small>
        </label>
        {(Object.keys(kindLabels) as PowerFinderKind[]).map((kind) => (
          <label
            key={kind}
            title={`${kindLabels[kind]} is delivered from the accepted national tile release.`}
          >
            <input
              name={`layer-${kind}`}
              type="checkbox"
              checked={enabled[kind]}
              disabled={false}
              onChange={(event) => {
                const checked = event.target.checked;
                setEnabled((current) => ({ ...current, [kind]: checked }));
                const isolation = mapFilters.isolation;
                const isolationConflicts =
                  isolation?.dimension === "technology" &&
                  ((!checked &&
                    ((kind === "storage_asset" && isolation.value === "storage") ||
                      (kind === "generation_asset" && isolation.value !== "storage"))) ||
                    (checked &&
                      ((kind === "generation_asset" && isolation.value === "storage") ||
                        (kind === "storage_asset" && isolation.value !== "storage"))));
                if (isolationConflicts) {
                  dispatchMapFilter({ type: "clear_isolation" });
                  void updateSearch(mapIsolationSearchPatch(null));
                }
                if (checked && kind === "storage_asset") setLegendOpen(true);
                if (!checked && selected?.properties.kind === kind) setSelected(null);
                setInteractionNotice(
                  `${kindLabels[kind]} layer ${checked ? "enabled" : "disabled"}.`,
                );
              }}
            />
            <span>{kindLabels[kind]}</span>
          </label>
        ))}
      </div>
      {(enabled.generation_asset || enabled.storage_asset) && !registryAssetsUnavailable && (
        <div className="registered-capacity-filters">
          {enabled.generation_asset ? (
            <>
              <label>
                <span>Generation Technology</span>
                <select
                  aria-label="Generation technology"
                  value={generationGroup}
                  onChange={(event) => setGenerationGroup(event.target.value)}
                >
                  <option value="all">All Technologies</option>
                  <option value="solar">Solar</option>
                  <option value="wind">Wind</option>
                  <option value="biomass">Biomass</option>
                  <option value="hydro">Hydro</option>
                  <option value="geothermal">Geothermal</option>
                  <option value="nuclear">Nuclear</option>
                  <option value="gas">Gas</option>
                  <option value="fossil_other">Other Fossil</option>
                  <option value="other">Other / Unknown</option>
                </select>
              </label>
              <label>
                <span>Minimum Registered Generation</span>
                <select
                  aria-label="Minimum registered generation"
                  value={minimumGenerationMw}
                  onChange={(event) => setMinimumGenerationMw(Number(event.target.value))}
                >
                  <option value="0">Any MW, Including Unknown</option>
                  <option value="1">1+ MW</option>
                  <option value="10">10+ MW</option>
                  <option value="50">50+ MW</option>
                  <option value="100">100+ MW</option>
                  <option value="500">500+ MW</option>
                </select>
              </label>
              <label>
                <span>Maximum Registered Generation</span>
                <select
                  aria-label="Maximum registered generation"
                  value={mapFilters.maximumGenerationMw ?? ""}
                  onChange={(event) =>
                    setMaximumGenerationMw(event.target.value ? Number(event.target.value) : null)
                  }
                >
                  <option value="">No Maximum</option>
                  <option value="10">Up to 10 MW</option>
                  <option value="50">Up to 50 MW</option>
                  <option value="100">Up to 100 MW</option>
                  <option value="500">Up to 500 MW</option>
                  <option value="1000">Up to 1,000 MW</option>
                </select>
              </label>
            </>
          ) : null}
          {enabled.generation_asset ? (
            <label className="registered-capacity-scale-toggle">
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
              <span>Scale markers by registered capacity</span>
            </label>
          ) : null}
          <p className="layer-visibility-note">
            Circle area represents registered net capacity where published. Small circles may mean
            low or unknown MW. This is nearby asset context, not available power or grid headroom.
          </p>
        </div>
      )}
      {(enabled.line || enabled.industrial_site) &&
        visibleLayerCounts.line + visibleLayerCounts.industrial_site === 0 && (
          <p className="layer-visibility-note" role="status">
            No enabled grid lines or industrial sites intersect the current map view. Pan or zoom
            out to inspect the regional layer.
          </p>
        )}
    </details>
  );
}
