import { finderMvpFeatures } from "@/config/product-mode";
import {
finderProjectTypes,
isStorageProject,
type FinderProject,
type FinderProjectType,
} from "@/features/power-finder/finder-project";
import { FinderFilters } from "./FinderFilters";
import type { useFinderController } from "./use-finder-controller";
export function FinderScreeningControls({
  model,
}: {
  model: ReturnType<typeof useFinderController>;
}) {
  const {
    search,
    project,
    setSelected,
    setSelectedOpportunitySnapshot,
    updateSearch,
    updateProject,
    updateScenarioNumber,
    numericDrafts,
    setNumericDrafts,
    fieldErrors,
    setInteractionNotice,
    setComparisonOpen,
    projectEditorOpen,
    commitNumber,
    mapMode,
    setRequiredCapacityMw,
  } = model;
  return (
    <div className="finder-screening-controls">
      <section
        id="finder-project-editor"
        className={`finder-project-panel ${projectEditorOpen ? "is-open" : ""}`}
        aria-labelledby="finder-project-title"
        hidden={!projectEditorOpen}
      >
        <div className="finder-project-heading">
          <div>
            <p className="context-label">Your screening project</p>
            <h2 id="finder-project-title">Define the site and power requirement</h2>
          </div>
          <small>Saved on this device</small>
        </div>
        <label>
          <span>Site opportunity</span>
          <input
            name="project-name"
            autoComplete="off"
            value={project.name}
            maxLength={160}
            onChange={(event) => updateProject({ name: event.target.value })}
          />
        </label>
        {!finderMvpFeatures.dataCentreOnly ? (
          <label>
            <span>Project type</span>
            <select
              name="project-type"
              value={project.type}
              onChange={(event) => {
                const type = event.target.value as FinderProjectType;
                updateProject({ type });
                void updateSearch({
                  projectType: type,
                  candidate: undefined,
                  compare: undefined,
                });
              }}
            >
              {Object.entries(finderProjectTypes)
                .filter(
                  ([value]) => finderMvpFeatures.additionalProjectTypes || value === "data_centre",
                )
                .map(([value, profile]) => (
                  <option value={value} key={value}>
                    {profile.label}
                  </option>
                ))}
            </select>
            <small>{finderProjectTypes[project.type].description}</small>
          </label>
        ) : null}
        <div className="finder-project-grid finder-project-grid--primary">
          <label>
            <span>Latitude</span>
            <input
              name="site-latitude"
              type="number"
              min="47"
              max="56"
              step="0.000001"
              value={numericDrafts.latitude}
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.latitude)}
              aria-describedby={fieldErrors.latitude ? "latitude-error" : undefined}
              placeholder="Click map…"
              onChange={(event) => {
                commitNumber(
                  "latitude",
                  event.target.value,
                  (value) => {
                    updateProject({ latitude: value });
                    void updateSearch({
                      lat: value ?? undefined,
                      candidate: undefined,
                      compare: undefined,
                    });
                  },
                  true,
                );
              }}
            />
            {fieldErrors.latitude && (
              <small id="latitude-error" className="finder-field-error">
                {fieldErrors.latitude}
              </small>
            )}
          </label>
          <label>
            <span>Longitude</span>
            <input
              name="site-longitude"
              type="number"
              min="5"
              max="16"
              step="0.000001"
              value={numericDrafts.longitude}
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.longitude)}
              aria-describedby={fieldErrors.longitude ? "longitude-error" : undefined}
              placeholder="Click map…"
              onChange={(event) => {
                commitNumber(
                  "longitude",
                  event.target.value,
                  (value) => {
                    updateProject({ longitude: value });
                    void updateSearch({
                      lng: value ?? undefined,
                      candidate: undefined,
                      compare: undefined,
                    });
                  },
                  true,
                );
              }}
            />
            {fieldErrors.longitude && (
              <small id="longitude-error" className="finder-field-error">
                {fieldErrors.longitude}
              </small>
            )}
          </label>
          <label>
            <span>Total site load (MW)</span>
            <input
              name="import-mw"
              type="number"
              min="0.1"
              max="1000"
              step="0.1"
              value={numericDrafts.importMw}
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.importMw)}
              aria-describedby={fieldErrors.importMw ? "import-mw-error" : undefined}
              onChange={(event) => {
                commitNumber("importMw", event.target.value, (value) => {
                  if (value == null) return;
                  updateProject({
                    importMw: value,
                    ultimateImportMw:
                      project.ultimateImportMw === project.importMw
                        ? value
                        : Math.max(value, project.ultimateImportMw),
                    minimumFirmMw:
                      project.minimumFirmMw === project.importMw
                        ? value
                        : Math.min(value, project.minimumFirmMw),
                  });
                  if (mapMode === "capacity") setRequiredCapacityMw(value);
                  void updateSearch({
                    mw: value,
                    requiredMw: mapMode === "capacity" ? value : search.requiredMw,
                    candidate: undefined,
                    compare: undefined,
                  });
                });
              }}
            />
            {fieldErrors.importMw && (
              <small id="import-mw-error" className="finder-field-error">
                {fieldErrors.importMw}
              </small>
            )}
          </label>
          {isStorageProject(project.type) && (
            <label>
              <span>Export MW</span>
              <input
                name="export-mw"
                type="number"
                min="0"
                max="1000"
                step="0.1"
                value={numericDrafts.exportMw}
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={Boolean(fieldErrors.exportMw)}
                aria-describedby={fieldErrors.exportMw ? "export-mw-error" : undefined}
                onChange={(event) => {
                  commitNumber("exportMw", event.target.value, (value) => {
                    if (value == null) return;
                    updateProject({ exportMw: value });
                    void updateSearch({
                      exportMw: value || undefined,
                      candidate: undefined,
                      compare: undefined,
                    });
                  });
                }}
              />
              {fieldErrors.exportMw && (
                <small id="export-mw-error" className="finder-field-error">
                  {fieldErrors.exportMw}
                </small>
              )}
            </label>
          )}
        </div>
        <label className="finder-project-voltage">
          <span>Voltage context</span>
          <select
            name="preferred-voltage"
            value={project.preferredVoltageKv ?? 0}
            onChange={(event) => {
              const preferredVoltageKv = Number(event.target.value) || null;
              updateProject({ preferredVoltageKv });
              void updateSearch({
                preferredVoltage: preferredVoltageKv ?? undefined,
                candidate: undefined,
                compare: undefined,
              });
            }}
          >
            <option value={0}>No preference</option>
            <option value={20}>20 kV</option>
            <option value={110}>110 kV</option>
            <option value={220}>220 kV</option>
            <option value={380}>380 kV</option>
          </select>
        </label>
        {search.study === "activation" && (
          <details className="finder-scenario-inputs">
            <summary>Activation Study assumptions</summary>
            <p>
              These inputs drive an explicitly synthetic, untrained hourly scenario. They do not
              request or establish network capacity.
            </p>
            <div className="finder-project-grid">
              <label>
                <span>Ultimate demand MW</span>
                <input
                  type="number"
                  min="0.1"
                  max="1000"
                  step="0.1"
                  value={project.ultimateImportMw}
                  onChange={updateScenarioNumber("ultimateImportMw", 0.1, 1000)}
                />
              </label>
              <label>
                <span>Minimum firm MW</span>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  step="0.1"
                  value={project.minimumFirmMw}
                  onChange={updateScenarioNumber("minimumFirmMw", 0, 1000)}
                />
              </label>
              <label>
                <span>Interruptible load MW</span>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  step="0.1"
                  value={project.flexibleLoadMw}
                  onChange={updateScenarioNumber("flexibleLoadMw", 0, 1000)}
                />
              </label>
              <label>
                <span>Target energisation year</span>
                <input
                  type="number"
                  min="2026"
                  max="2050"
                  step="1"
                  value={project.targetEnergisationYear}
                  onChange={updateScenarioNumber("targetEnergisationYear", 2026, 2050)}
                />
              </label>
              <label>
                <span>Supply redundancy</span>
                <select
                  value={project.redundancy}
                  onChange={(event) =>
                    updateProject({
                      redundancy: event.target.value as FinderProject["redundancy"],
                    })
                  }
                >
                  <option value="single_feed">Single feed</option>
                  <option value="dual_feed">Dual feed</option>
                  <option value="n_minus_one">N-1 requirement</option>
                </select>
              </label>
              <label>
                <span>Representative load shape</span>
                <select
                  value={project.loadProfile}
                  onChange={(event) =>
                    updateProject({
                      loadProfile: event.target.value as FinderProject["loadProfile"],
                    })
                  }
                >
                  <option value="flat">Continuous / flat</option>
                  <option value="business_hours">Business hours</option>
                  <option value="managed_charging">Managed charging</option>
                  <option value="flexible_process">Flexible process</option>
                </select>
              </label>
              <label>
                <span>Annual consumption GWh</span>
                <input
                  type="number"
                  min="0"
                  max="20000"
                  step="1"
                  value={project.annualConsumptionGwh}
                  onChange={updateScenarioNumber("annualConsumptionGwh", 0, 20000)}
                />
              </label>
              <label>
                <span>Maximum interruption hours</span>
                <input
                  type="number"
                  min="0"
                  max="8760"
                  step="1"
                  value={project.maxInterruptionHours}
                  onChange={updateScenarioNumber("maxInterruptionHours", 0, 8760)}
                />
              </label>
              <label>
                <span>Annual interruption limit</span>
                <input
                  type="number"
                  min="0"
                  max="8760"
                  step="1"
                  value={project.annualInterruptionLimit}
                  onChange={updateScenarioNumber("annualInterruptionLimit", 0, 8760)}
                />
              </label>
              <label>
                <span>On-site generation MW</span>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  step="0.1"
                  value={project.onsiteGenerationMw}
                  onChange={updateScenarioNumber("onsiteGenerationMw", 0, 1000)}
                />
              </label>
            </div>
          </details>
        )}
        {isStorageProject(project.type) && search.study === "activation" && (
          <div className="finder-project-grid">
            <label>
              <span>Battery MW</span>
              <input
                name="battery-power-mw"
                type="number"
                min="0"
                step="0.1"
                value={numericDrafts.batteryPowerMw}
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={Boolean(fieldErrors.batteryPowerMw)}
                onChange={(event) =>
                  commitNumber("batteryPowerMw", event.target.value, (value) => {
                    if (value != null) updateProject({ batteryPowerMw: value });
                  })
                }
              />
              {fieldErrors.batteryPowerMw && (
                <small className="finder-field-error">{fieldErrors.batteryPowerMw}</small>
              )}
            </label>
            <label>
              <span>Battery MWh</span>
              <input
                name="battery-energy-mwh"
                type="number"
                min="0"
                step="0.1"
                value={numericDrafts.batteryEnergyMwh}
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={Boolean(fieldErrors.batteryEnergyMwh)}
                onChange={(event) =>
                  commitNumber("batteryEnergyMwh", event.target.value, (value) => {
                    if (value != null) updateProject({ batteryEnergyMwh: value });
                  })
                }
              />
              {fieldErrors.batteryEnergyMwh && (
                <small className="finder-field-error">{fieldErrors.batteryEnergyMwh}</small>
              )}
            </label>
            <label>
              <span>Round-trip efficiency %</span>
              <input
                name="battery-round-trip-efficiency"
                type="number"
                min="1"
                max="100"
                step="1"
                inputMode="numeric"
                autoComplete="off"
                value={project.batteryRoundTripEfficiencyPct}
                onChange={updateScenarioNumber("batteryRoundTripEfficiencyPct", 1, 100)}
              />
            </label>
            <label>
              <span>Battery reserve %</span>
              <input
                name="battery-reserve"
                type="number"
                min="0"
                max="100"
                step="1"
                inputMode="numeric"
                autoComplete="off"
                value={project.batteryReservePct}
                onChange={updateScenarioNumber("batteryReservePct", 0, 100)}
              />
            </label>
          </div>
        )}
        {project.latitude != null && project.longitude != null && (
          <button
            type="button"
            className="finder-clear-site"
            onClick={() => {
              updateProject({ latitude: null, longitude: null });
              setNumericDrafts((current) => ({ ...current, latitude: "", longitude: "" }));
              setSelected(null);
              setSelectedOpportunitySnapshot(null);
              setComparisonOpen(false);
              setInteractionNotice("Declared site cleared. Ranked pathways are hidden.");
              void updateSearch({
                lat: undefined,
                lng: undefined,
                candidate: undefined,
                compare: undefined,
              });
            }}
          >
            Clear declared site
          </button>
        )}
      </section>

      <FinderFilters model={model} />
    </div>
  );
}
