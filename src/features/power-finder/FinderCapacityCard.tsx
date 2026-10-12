import {
capacityMetricLabels,
type CapacityMetric,
} from "@/features/power-finder/calculated-capacity";
import { ShieldCheck } from "lucide-react";
import type { useFinderController } from "./use-finder-controller";
export function FinderCapacityCard({ model }: { model: ReturnType<typeof useFinderController> }) {
  const {
    search,
    project,
    updateSearch,
    setInteractionNotice,
    mapMode,
    setMapMode,
    capacityMetric,
    setCapacityMetric,
    requiredCapacityMw,
    setRequiredCapacityMw,
    capacitySource,
    setCapacitySource,
    capacityViewport,
    capacityState,
    capacitySummary,
  } = model;
  return (
    <section className="capacity-opportunity-card" aria-labelledby="capacity-opportunity-title">
      <label className="capacity-overlay-switch">
        <span>
          <strong id="capacity-opportunity-title">Capacity opportunities</strong>
          <small>Compare available results with your required power</small>
        </span>
        <input
          name="capacity-overlay"
          type="checkbox"
          role="switch"
          checked={mapMode === "capacity"}
          onChange={(event) => {
            const isEnabled = event.target.checked;
            setMapMode(isEnabled ? "capacity" : "voltage");
            const nextSource = search.workspaceId ? "private" : "berlin_synthetic";
            setCapacitySource(nextSource);
            setInteractionNotice(`Capacity opportunities ${isEnabled ? "enabled" : "disabled"}.`);
            void updateSearch({
              mapMode: isEnabled ? "capacity" : "voltage",
              capacitySource: isEnabled ? nextSource : undefined,
            });
          }}
        />
      </label>
      {mapMode === "capacity" && (
        <div className="capacity-opportunity-controls">
          <p className="capacity-source-status">
            {capacitySource === "berlin_synthetic"
              ? "Berlin synthetic calculation"
              : "Reviewed private calculation"}
          </p>
          <div className="capacity-required-heading">
            <label htmlFor="required-capacity-range">Required power</label>
            <span>
              {requiredCapacityMw.toLocaleString("en-GB", { maximumFractionDigits: 1 })} MW
            </span>
          </div>
          <input
            id="required-capacity-range"
            name="required-capacity-range"
            type="range"
            min={1}
            max={Math.min(1000, Math.max(100, Math.ceil((project.importMw * 3) / 25) * 25))}
            step={1}
            value={requiredCapacityMw}
            aria-valuetext={`${requiredCapacityMw} megawatts required power`}
            onChange={(event) => setRequiredCapacityMw(Number(event.target.value))}
            onPointerUp={(event) =>
              void updateSearch({ requiredMw: Number(event.currentTarget.value) })
            }
            onKeyUp={(event) =>
              void updateSearch({ requiredMw: Number(event.currentTarget.value) })
            }
          />
          <div className="capacity-control-row">
            <label>
              <span>Exact MW</span>
              <input
                type="number"
                min={0.1}
                max={1000}
                step={0.1}
                value={requiredCapacityMw}
                onChange={(event) => {
                  const value = Math.min(1000, Math.max(0.1, Number(event.target.value) || 0.1));
                  setRequiredCapacityMw(value);
                  void updateSearch({ requiredMw: value });
                }}
              />
            </label>
            <label>
              <span>Capacity basis</span>
              <select
                name="capacity-overlay-metric"
                value={capacityMetric}
                onChange={(event) => {
                  const value = event.target.value as CapacityMetric;
                  setCapacityMetric(value);
                  void updateSearch({ capacityMetric: value });
                }}
              >
                {(Object.entries(capacityMetricLabels) as [CapacityMetric, string][]).map(
                  ([value, label]) => {
                    const unavailableInSynthetic =
                      capacitySource === "berlin_synthetic" &&
                      value !== "n0_import_mw" &&
                      value !== "firm_import_mw";
                    return (
                      <option key={value} value={value} disabled={unavailableInSynthetic}>
                        {label}
                        {unavailableInSynthetic ? " · private study required" : ""}
                      </option>
                    );
                  },
                )}
              </select>
            </label>
          </div>
          {Math.abs(requiredCapacityMw - project.importMw) > 0.01 && (
            <button
              type="button"
              className="capacity-reset-demand"
              onClick={() => {
                setRequiredCapacityMw(project.importMw);
                void updateSearch({ requiredMw: undefined });
              }}
            >
              Use project demand · {project.importMw} MW
            </button>
          )}
          <p className="capacity-data-basis">
            <ShieldCheck aria-hidden="true" />
            {capacitySource === "berlin_synthetic"
              ? "Berlin calculation pocket · real locations, synthetic electrical model"
              : `Private reviewed results · ${capacityViewport?.access === "ready" ? "workspace connected" : "no coverage"}`}
          </p>
          {capacitySource === "berlin_synthetic" && (
            <p className="capacity-overlay-empty">
              Release 2 AI routing does not colour these nodes. Every displayed Berlin value remains
              a Release 1 physics result.
            </p>
          )}
          <p className="capacity-overlay-empty">
            Move Required power to reclassify calculated nodes immediately: cyan meets the
            threshold, dark blue is below it, and grey is outside this calculation pocket.
          </p>
          <div className="capacity-threshold-key" aria-label="Capacity map colour key">
            <span>
              <i className="is-meets" />
              Meets {requiredCapacityMw} MW
            </span>
            <span>
              <i className="is-activation" />
              Activation pathway
            </span>
            <span>
              <i className="is-below" />
              Below requirement
            </span>
          </div>
          <div className="capacity-fit-summary" role="status" aria-live="polite">
            <span>
              <b>{capacitySummary.meets}</b> meet
            </span>
            {capacitySource === "private" && (
              <span>
                <b>{capacitySummary.activation}</b> activation paths
              </span>
            )}
            <span>
              <b>{capacitySummary.below}</b> below
            </span>
            <span>
              <b>{capacitySummary.unknown}</b> not calculated
            </span>
          </div>
          {capacityState === "error" && (
            <p className="capacity-overlay-empty">Capacity results could not be loaded.</p>
          )}
          {capacitySource === "private" &&
            capacityState !== "error" &&
            capacitySummary.meets === 0 &&
            capacitySummary.activation === 0 && (
              <p className="capacity-overlay-empty">
                No reviewed capacity results cover this map. Unknown is not zero.
              </p>
            )}
        </div>
      )}
    </section>
  );
}
