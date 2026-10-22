import { useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { useOperationsEvidenceStore } from "./hooks/evidence-store";
import { useOpenInputs } from "./configuration/input-panel-context";
import { selectPowerView } from "./power/select-power-view";
import type { OperationsOverviewModel } from "./scenario-engine";
import { formatMw } from "./formatting";
import { OperationsSelect } from "./OperationsSelect";
import { formatOperationsTime } from "./presentation";
import { number, type EvidenceMode } from "./power/presentation";
import { intervalLabel } from "./power/select-battery-workspace";
import { EmptyEvidence } from "./power/primitives";
import { PowerBalanceFlow } from "./power/PowerBalanceFlow";
import { BatterySocPanel } from "./power/BatterySocPanel";
import { PowerTimeline } from "./power/PowerTimeline";
import { PowerDataTable } from "./power/PowerDataTable";
import { OperatingEnvelope } from "./power/OperatingEnvelope";
import { SelectedBalance } from "./power/SelectedBalance";
import { PowerResponseSummary } from "./power/PowerResponseSummary";

export function PowerBatteryView({
  model,
  displayModel = model,
  mode = "scenario",
}: {
  model: OperationsOverviewModel;
  displayModel?: OperationsOverviewModel;
  mode?: EvidenceMode;
  onModeChange?: (mode: EvidenceMode) => void;
}) {
  const store = useOperationsEvidenceStore();
  const [facility] = store.facility;
  const [battery] = store.battery;
  const [timestamp, setTimestamp] = store.powerTimestamp;
  const openInputs = useOpenInputs();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const view = useMemo(
    () => selectPowerView(model, displayModel, mode, facility, battery, timestamp),
    [model, displayModel, mode, facility, battery, timestamp],
  );
  const {
    workspace,
    series,
    selectedPoint,
    selectedScenario,
    selectedHistorical,
    selected,
    limitMw,
    targetMw,
  } = view;
  const visibleTimes = new Set(series.map((point) => point.timestamp));
  const events =
    mode === "scenario"
      ? workspace.events.filter((event) => visibleTimes.has(event.timestamp))
      : [];
  const selectedIndex = series.findIndex((point) => point.timestamp === selectedPoint?.timestamp);

  return (
    <section
      className="operations-v2-view power-battery battery-workspace"
      aria-labelledby="power-title"
    >
      <h2 id="power-title" className="sr-only">
        Power & Battery
      </h2>
      <PowerResponseSummary
        requiredMw={view.requiredMw}
        batteryMw={view.batteryMw}
        shortfallMw={view.shortfallMw}
        constraint={selectedScenario.batteryConstraintCode}
        headline={view.dispatchHeadline}
        mode={mode}
      />
      <div className="power-toolbar">
        <p className="operations-chart-purpose">
          {mode === "scenario"
            ? `Full-horizon assessment: ${workspace.targetMet ? "target met" : "target unmet"} · ${workspace.reserveProtected ? "reserve protected" : "reserve requirement not satisfied"}. Display windows never reset battery state.`
            : "Uploaded observations only · missing battery evidence stays unknown. No dispatch constraint or backup autonomy is inferred."}
        </p>
        <button
          type="button"
          className="secondary-button"
          onClick={() => openInputs(true)}
          disabled={!hydrated}
        >
          <Upload aria-hidden="true" />
          Connect evidence
        </button>
      </div>
      <dl className="power-kpis ops-compact-facts">
        <div>
          <dt>Facility limit · assumption</dt>
          <dd>{formatMw(limitMw)}</dd>
        </div>
        <div>
          <dt>Safety target · assumption</dt>
          <dd>{formatMw(targetMw)}</dd>
        </div>
        <div>
          <dt>Discharge time · full horizon</dt>
          <dd>
            {mode === "historical"
              ? "Not derivable"
              : workspace.dischargeMinutes > 0
                ? `${number.format(workspace.dischargeMinutes / 60)} h`
                : "Not required"}
          </dd>
        </div>
      </dl>
      <div className="power-interval-control">
        <OperationsSelect
          name="power-interval"
          label="Selected interval (UTC)"
          value={selectedPoint?.timestamp ?? ""}
          options={series.map((point) => ({
            value: point.timestamp,
            label: formatOperationsTime(point.timestamp),
          }))}
          onChange={setTimestamp}
          disabled={!series.length}
        />
        <div className="battery-interval-stepper" aria-label="Interval navigation">
          <button
            type="button"
            disabled={selectedIndex <= 0}
            onClick={() => setTimestamp(series[selectedIndex - 1].timestamp)}
          >
            Previous interval
          </button>
          <button
            type="button"
            disabled={selectedIndex < 0 || selectedIndex >= series.length - 1}
            onClick={() => setTimestamp(series[selectedIndex + 1].timestamp)}
          >
            Next interval
          </button>
        </div>
      </div>
      <div className="battery-workspace-grid">
        <article className="power-timeline-card">
          <header>
            <div>
              <p className="context-label">Battery Response & Reserve</p>
              <h3>Facility Power & Battery Response</h3>
            </div>
          </header>
          <p className="operations-chart-purpose">
            Select a time to inspect power, reserve and constraints together. Positive battery MW
            means discharge; negative means charge. SOC is the end-of-interval state in scenario
            mode.
          </p>
          {series.length ? (
            <PowerTimeline
              data={series}
              limitMw={limitMw}
              targetMw={targetMw}
              selectedTimestamp={selectedPoint?.timestamp ?? null}
              onSelect={setTimestamp}
              protectedSocPercent={workspace.protectedSocPercent}
              mode={mode}
            />
          ) : (
            <EmptyEvidence />
          )}
          {mode === "scenario" ? (
            <div className="battery-events" aria-label="Key battery events">
              <span>Key events · selected window</span>
              {events.length ? (
                events.map((event) => (
                  <button
                    type="button"
                    key={event.kind}
                    aria-pressed={event.timestamp === selectedPoint?.timestamp}
                    onClick={() => setTimestamp(event.timestamp)}
                  >
                    {event.label}
                    <strong>{formatOperationsTime(event.timestamp)}</strong>
                  </button>
                ))
              ) : (
                <small>
                  No first-occurrence events in this display window. Full-horizon status remains
                  above.
                </small>
              )}
            </div>
          ) : null}
        </article>
        <aside className="battery-interval-inspector" aria-label="Selected battery interval">
          <header aria-live="polite">
            <p className="context-label">
              {mode === "scenario" ? "Selected interval" : "Selected observation"}
            </p>
            <strong>{selectedPoint ? intervalLabel(selectedPoint) : "No aligned evidence"}</strong>
            <span>{selectedPoint?.constraintLabel ?? "Unavailable"}</span>
          </header>
          <BatterySocPanel
            model={model}
            selected={selectedScenario}
            mode={mode}
            selectedHistorical={selectedHistorical}
            protectedSocPercent={workspace.protectedSocPercent}
          />
          <dl className="battery-interval-facts">
            <div>
              <dt>Grid import</dt>
              <dd>{selectedPoint ? formatMw(selectedPoint.gridImportMw) : "Unavailable"}</dd>
            </div>
            <div>
              <dt>Above facility limit</dt>
              <dd>{selectedPoint ? formatMw(selectedPoint.limitExceedanceMw) : "Unavailable"}</dd>
            </div>
          </dl>
          <details>
            <summary>Inspect calculation</summary>
            <SelectedBalance selected={selected} mode={mode} targetMw={targetMw} />
          </details>
        </aside>
      </div>
      <div className="battery-inspection-actions">
        <PowerDataTable
          data={series}
          onSelect={setTimestamp}
          selectedTimestamp={selectedPoint?.timestamp ?? null}
          mode={mode}
        />
        <details className="operations-assurance-panel">
          <summary>Power path</summary>
          <PowerBalanceFlow selected={selected} mode={mode} limitMw={limitMw} />
        </details>
        <details className="operations-assurance-panel">
          <summary>Inspect equipment limits & calculation</summary>
          <OperatingEnvelope
            model={model}
            selected={selectedScenario}
            mode={mode}
            selectedHistorical={selectedHistorical}
          />
        </details>
      </div>
    </section>
  );
}
