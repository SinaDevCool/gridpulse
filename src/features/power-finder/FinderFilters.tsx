import { Search } from "lucide-react";
import { formatMw } from "./page-formatting";
import type { FinderControllerContract } from "./controller-contract";
export function FinderFilters({ model }: { model: FinderControllerContract }) {
  const {
    search,
    project,
    query,
    minimumVoltage,
    selectedTso,
    selectedDso,
    maxDistanceKm,
    updateSearch,
    updateProject,
    secondaryControlsOpen,
    setSecondaryControlsOpen,
    coverage,
    regionCode,
    activeCoverage,
    transmissionOperators,
    distributionOperators,
  } = model;
  return (
    <section className="power-finder-filter-panel" aria-label="Search and filter map">
      <label className="power-finder-search">
        <Search aria-hidden="true" />
        <span className="sr-only">Search nodes, operators, or identifiers</span>
        <input
          type="search"
          value={query}
          name="grid-search"
          autoComplete="off"
          onChange={(event) => void updateSearch({ q: event.target.value || undefined })}
          placeholder="Search or filter connection points…"
        />
      </label>
      <button
        type="button"
        className="finder-more-filters"
        aria-label="More Filters"
        aria-expanded={secondaryControlsOpen}
        aria-controls="finder-secondary-controls"
        onClick={() => setSecondaryControlsOpen((current) => !current)}
      >
        Filters
      </button>
      <div
        id="finder-secondary-controls"
        className="power-finder-filter-grid"
        hidden={!secondaryControlsOpen}
      >
        <label className="power-finder-filter-wide">
          <span>Region</span>
          <select
            name="region"
            value={regionCode}
            onChange={(event) =>
              void updateSearch({
                region: event.target.value as typeof regionCode,
                candidate: undefined,
                compare: undefined,
              })
            }
          >
            {coverage.map((item) => (
              <option key={item.regionCode} value={item.regionCode}>
                {item.regionCode === "DE"
                  ? "Germany · accepted regional coverage"
                  : `${item.regionName} · ${item.status}`}
              </option>
            ))}
          </select>
          <small>{activeCoverage.regionName}</small>
        </label>
        <label>
          <span>Maximum distance</span>
          <select
            name="maximum-distance"
            value={maxDistanceKm}
            onChange={(event) => {
              const maxDistanceKm = Number(event.target.value) || 20;
              updateProject({ maxDistanceKm });
              void updateSearch({
                distance: maxDistanceKm,
                candidate: undefined,
                compare: undefined,
              });
            }}
          >
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
            <option value={20}>20 km</option>
            <option value={50}>50 km</option>
          </select>
        </label>
        <label>
          <span>Minimum voltage</span>
          <select
            name="minimum-voltage"
            value={minimumVoltage}
            onChange={(event) =>
              void updateSearch({
                voltage: Number(event.target.value) || undefined,
                candidate: undefined,
                compare: undefined,
              })
            }
          >
            <option value={0}>Any / unknown</option>
            <option value={20}>20+ kV</option>
            <option value={110}>110+ kV</option>
            <option value={220}>220+ kV</option>
            <option value={380}>380+ kV</option>
          </select>
          {search.propertyId && minimumVoltage > 0 && (
            <small>
              Suggested from the declared {formatMw(project.importMw)} load; screening only.
            </small>
          )}
        </label>
        <label className="power-finder-filter-wide">
          <span>Transmission operator (TSO)</span>
          <select
            name="transmission-operator"
            value={selectedTso}
            onChange={(event) => {
              const operatorName = event.target.value;
              void updateSearch({
                operator: undefined,
                tso: operatorName === "all" ? undefined : operatorName,
                dso: undefined,
                candidate: undefined,
                compare: undefined,
              });
            }}
          >
            <option value="all">All transmission operators</option>
            {transmissionOperators.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          {selectedTso !== "all" && (
            <small>
              {selectedTso}
              {search.propertyId ? " · mapped context, confirmation required" : ""}
            </small>
          )}
        </label>
        <label className="power-finder-filter-wide">
          <span>Distribution operator (DSO / other)</span>
          <select
            name="distribution-operator"
            value={selectedDso}
            onChange={(event) => {
              const operatorName = event.target.value;
              void updateSearch({
                operator: undefined,
                dso: operatorName === "all" ? undefined : operatorName,
                candidate: undefined,
                compare: undefined,
              });
            }}
          >
            <option value="all">All distribution operators</option>
            {distributionOperators.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          {selectedDso !== "all" && (
            <small>
              {selectedDso}
              {search.propertyId ? " · likely operator, confirmation required" : ""}
            </small>
          )}
        </label>
        <p className="operator-hierarchy-boundary power-finder-filter-wide">
          Region options intersect accepted mapped assets. DSO choices under a TSO use nearest
          mapped transmission context; this is a screening relationship, not an operator-confirmed
          control-area assignment.
        </p>
      </div>
    </section>
  );
}
