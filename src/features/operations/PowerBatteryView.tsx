import { useEffect, useMemo, useState } from "react";
import { useOperationsEvidenceStore } from "./hooks/evidence-store";
import { useOpenInputs } from "./configuration/input-panel-context";
import { selectPowerView } from "./power/select-power-view";
import type { OperationsOverviewModel } from "./scenario-engine";
import { formatMw } from "./formatting";
import { formatOperationsTime } from "./presentation";
import { type EvidenceMode } from "./power/presentation";
import { intervalLabel } from "./power/select-battery-workspace";
import { EmptyEvidence } from "./power/primitives";
import { PowerBalanceFlow } from "./power/PowerBalanceFlow";
import { BatterySocPanel } from "./power/BatterySocPanel";
import { PowerTimeline } from "./power/PowerTimeline";
import { PowerDataTable } from "./power/PowerDataTable";
import { OperatingEnvelope } from "./power/OperatingEnvelope";
import { SelectedBalance } from "./power/SelectedBalance";
import { PowerResponseSummary } from "./power/PowerResponseSummary";
import { PowerWorkspaceHeader } from "./power/PowerWorkspaceHeader";

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
  const [pinnedTimestamp, pinTimestamp] =
    mode === "historical" ? store.historicalTimestamp : store.powerTimestamp;
  const [preview, setPreview] = useState<{
    mode: EvidenceMode;
    model: OperationsOverviewModel;
    timestamp: string;
  } | null>(null);
  const timestamp =
    preview?.mode === mode && preview.model === model ? preview.timestamp : pinnedTimestamp;
  const setTimestamp = (value: string) => {
    setPreview(null);
    pinTimestamp(value);
  };
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

  return (
    <section
      className="operations-v2-view power-battery battery-workspace"
      aria-labelledby="power-title"
    >
      <h2 id="power-title" className="sr-only">
        Power & Battery
      </h2>
      <div className="battery-workspace-grid">
        <article className="power-timeline-card">
          <PowerWorkspaceHeader
            view={view}
            mode={mode}
            onSelect={setTimestamp}
            onEvidence={() => openInputs(true)}
            ready={hydrated}
          />
          <PowerResponseSummary
            requiredMw={view.requiredMw}
            batteryMw={view.batteryMw}
            shortfallMw={view.shortfallMw}
            constraint={selectedScenario.batteryConstraintCode}
            headline={view.dispatchHeadline}
            mode={mode}
          />
          {series.length ? (
            <PowerTimeline
              previewing={timestamp !== pinnedTimestamp && preview != null}
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
                  No first-occurrence events in this display window. Full-horizon status remains in
                  Assessment context.
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
          pinnedTimestamp={
            pinnedTimestamp ??
            (mode === "scenario" ? view.scenarioPeak?.timestamp : view.historical.at(-1)?.timestamp)
          }
          onPreview={(value) => setPreview(value ? { mode, model, timestamp: value } : null)}
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
