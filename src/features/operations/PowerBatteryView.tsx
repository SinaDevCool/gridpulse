import { useEffect, useMemo, useState } from "react";
import { useOperationsEvidenceStore } from "./hooks/evidence-store";
import { useOpenInputs } from "./configuration/input-panel-context";
import { selectPowerView } from "./power/select-power-view";

import { Upload } from "lucide-react";

import type { OperationsOverviewModel } from "./scenario-engine";

import { formatMw } from "./formatting";
import { OperationsChartLegend } from "./visualization";

import { formatOperationsTime } from "./presentation";

import { OperationsSelect } from "./OperationsSelect";

import { formatOptionalMw, number, valueOf, type EvidenceMode } from "./power/presentation";

import { EmptyEvidence, EvidencePill } from "./power/primitives";

import { PowerBalanceFlow } from "./power/PowerBalanceFlow";

import { BatterySocPanel } from "./power/BatterySocPanel";

import { PowerDataTable, PowerTimeline } from "./power/PowerTimeline";

import { DispatchCard } from "./power/DispatchCard";

import { OperatingEnvelope } from "./power/OperatingEnvelope";

import { SelectedBalance } from "./power/SelectedBalance";

import { PowerResponseSummary } from "./power/PowerResponseSummary";

export function PowerBatteryView({
  model,
  displayModel = model,
  mode = "scenario",
  onModeChange,
}: {
  model: OperationsOverviewModel;
  displayModel?: OperationsOverviewModel;
  mode?: EvidenceMode;
  onModeChange?: (mode: EvidenceMode) => void;
}) {
  const evidenceStore = useOperationsEvidenceStore();
  const [facilityObservations] = evidenceStore.facility;
  const [batteryObservations] = evidenceStore.battery;
  const openInputs = useOpenInputs();
  const [selectedTimestamp, setSelectedTimestamp] = evidenceStore.powerTimestamp;
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const {
    selectedScenario,
    selectedHistorical,
    targetMw,
    selected,
    series,
    requiredMw,
    batteryMw,
    shortfallMw,
    feasible,
    thresholds,
    dispatchHeadline,
  } = useMemo(
    () =>
      selectPowerView(
        model,
        displayModel,
        mode,
        facilityObservations,
        batteryObservations,
        selectedTimestamp,
      ),
    [model, displayModel, mode, facilityObservations, batteryObservations, selectedTimestamp],
  );

  return (
    <section className="operations-v2-view power-battery" aria-labelledby="power-title">
      <h2 id="power-title" className="sr-only">
        Power & Battery
      </h2>
      <PowerResponseSummary
        requiredMw={requiredMw}
        batteryMw={batteryMw}
        shortfallMw={shortfallMw}
        constraint={selectedScenario.batteryConstraintCode}
        headline={dispatchHeadline}
        mode={mode}
      />

      <div className="power-toolbar">
        <p className="operations-chart-purpose">
          {mode === "historical"
            ? "Uploaded historical evidence · complete uploaded range (scenario window presets do not filter these observations)"
            : "Selected scenario window · battery state retains the full calculation horizon"}
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
          <dt>Grid import</dt>
          <dd>
            {selected
              ? formatOptionalMw(valueOf(selected, "gridImportMw", "batteryDemandMw"))
              : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt>Facility limit · assumption</dt>
          <dd>{formatMw(model.scenario.importLimitMw)}</dd>
        </div>
        <div>
          <dt>Required response</dt>
          <dd>{requiredMw == null ? "Unavailable" : formatMw(requiredMw)}</dd>
        </div>
        <div>
          <dt>Discharge time · full horizon</dt>
          <dd>
            {mode === "scenario"
              ? model.recommendation.durationMinutes > 0
                ? `${number.format(model.recommendation.durationMinutes / 60)} h`
                : "Not required"
              : "Not derivable"}
          </dd>
        </div>
      </dl>

      <div className="power-interval-control">
        <OperationsSelect
          name="power-interval"
          label="Selected interval (UTC)"
          value={selected?.timestamp ?? ""}
          options={series.map((point) => ({
            value: point.timestamp,
            label: formatOperationsTime(point.timestamp),
          }))}
          onChange={setSelectedTimestamp}
        />
        <span>
          Above facility limit{" "}
          <strong>
            {thresholds.limitExceedanceMw == null
              ? "Unavailable"
              : formatMw(thresholds.limitExceedanceMw)}
          </strong>
        </span>
        <span>
          Shortfall to safety target{" "}
          <strong>
            {thresholds.targetShortfallMw == null
              ? "Unavailable"
              : formatMw(thresholds.targetShortfallMw)}
          </strong>
        </span>
      </div>

      <div className="power-insight-grid">
        <PowerBalanceFlow selected={selected} mode={mode} limitMw={model.scenario.importLimitMw} />
        <BatterySocPanel
          model={model}
          selected={selectedScenario}
          mode={mode}
          selectedHistorical={selectedHistorical}
        />
      </div>

      <div className="power-primary-grid">
        <article className="power-timeline-card">
          <header>
            <div>
              <p className="context-label">Chronological power balance</p>
              <h3>Facility Power & Battery Response</h3>
            </div>
            <EvidencePill mode={mode} />
          </header>
          {series.length ? (
            <>
              <p className="operations-chart-purpose">
                Facility power and battery behavior use aligned timelines so MW and state of charge
                are never compared on the same axis.
              </p>
              <OperationsChartLegend
                items={[
                  {
                    label: "Facility demand",
                    detail: "MW · before battery response",
                    tone: "demand",
                    mark: "area",
                  },
                  { label: "Grid import", detail: "MW · after battery response", tone: "response" },
                  {
                    label: "Battery dispatch",
                    detail: "MW · + discharge / − charge",
                    tone: "battery",
                    mark: "bar",
                  },
                  { label: "State of charge", detail: "% · battery energy state", tone: "soc" },
                  {
                    label: "Safety target",
                    detail: `${formatMw(targetMw)} · assumption`,
                    tone: "target",
                    mark: "dash",
                  },
                  {
                    label: "Facility limit",
                    detail: `${formatMw(model.scenario.importLimitMw)} · assumption`,
                    tone: "limit",
                    mark: "dash",
                  },
                ]}
              />
              <PowerTimeline
                data={series}
                limitMw={model.scenario.importLimitMw}
                targetMw={targetMw}
                selectedTimestamp={selected?.timestamp ?? null}
              />
            </>
          ) : (
            <EmptyEvidence />
          )}
          {series.length ? (
            <PowerDataTable
              data={series}
              onSelect={setSelectedTimestamp}
              selectedTimestamp={selectedTimestamp}
              mode={mode}
            />
          ) : null}
        </article>
        <details className="operations-assurance-panel power-dispatch-details">
          <summary>Selected interval constraints & response breakdown</summary>
          <DispatchCard
            model={model}
            selected={selectedScenario}
            mode={mode}
            selectedHistorical={selectedHistorical}
            feasible={feasible}
            requiredMw={requiredMw}
            shortfallMw={shortfallMw}
          />
        </details>
      </div>

      <details className="operations-assurance-panel power-supporting-details">
        <summary>Inspect equipment limits & calculation</summary>
        <div className="power-detail-grid">
          <OperatingEnvelope
            model={model}
            selected={selectedScenario}
            mode={mode}
            selectedHistorical={selectedHistorical}
          />
          <SelectedBalance selected={selected} mode={mode} targetMw={targetMw} />
        </div>
      </details>
    </section>
  );
}
