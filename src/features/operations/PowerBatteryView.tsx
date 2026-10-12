import { useEffect,useMemo,useState } from "react";
import { useOperationsEvidenceStore } from "./hooks/evidence-store";
import { usePowerEvidence } from "./hooks/use-power-evidence";
import { selectPowerView } from "./power/select-power-view";

import { Activity,BatteryCharging,Bolt,Cable,Gauge,Upload,Zap } from "lucide-react";

import type { OperationsOverviewModel } from "./scenario-engine";

import { formatMw } from "./formatting";
import { OperationsChartLegend } from "./visualization";

import { formatOperationsTime } from "./presentation";

import { OperationsSelect } from "./OperationsSelect";

import {
formatOptionalMw,
number,
valueOf,
type EvidenceMode
} from "./power/presentation";

import { EmptyEvidence,EvidencePill,PowerMetric } from "./power/primitives";

import { PowerBalanceFlow } from "./power/PowerBalanceFlow";

import { BatterySocPanel } from "./power/BatterySocPanel";

import { PowerDataTable,PowerTimeline } from "./power/PowerTimeline";

import { DispatchCard } from "./power/DispatchCard";

import { OperatingEnvelope } from "./power/OperatingEnvelope";

import { SelectedBalance } from "./power/SelectedBalance";

import { ResponseComparison } from "./power/ResponseComparison";

import { ConnectorStatus } from "./power/ConnectorStatus";

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
  const {
    facilityObservations,
    batteryObservations,
    message,
    error,
    setFacilityObservations,
    setBatteryObservations,
    setMessage,
    setError,
    loadFacility,
    loadBattery,
  } = usePowerEvidence(model, onModeChange);
  const evidenceStore = useOperationsEvidenceStore();
  const [importsOpen, setImportsOpen] = evidenceStore.powerImportsOpen;
  const [selectedTimestamp, setSelectedTimestamp] = evidenceStore.powerTimestamp;
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const {
    scenarioPeak,
    selectedScenario,
    historical,
    selectedHistorical,
    targetMw,
    selected,
    series,
    requiredMw,
    batteryMw,
    shortfallMw,
    feasible,
    thresholds,
    responseRequired,
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
      <article className={`power-decision-bar ${feasible ? "feasible" : "limited"}`}>
        <div>
          <p className="context-label">Read-only dispatch assessment</p>
          <h3>{dispatchHeadline}</h3>
          <p>
            Positive battery power means discharge; negative power means charge. No physical control
            commands are issued.
          </p>
        </div>
        <div className="power-decision-summary">
          <EvidencePill mode={mode} />
          <strong>{requiredMw == null ? "—" : `${number.format(requiredMw)} MW required`}</strong>
          <span>
            {shortfallMw == null
              ? "Evidence incomplete"
              : `${number.format(shortfallMw)} MW shortfall to safety target`}
          </span>
        </div>
      </article>

      <div className="power-toolbar">
        <p className="operations-chart-purpose">
          {mode === "historical"
            ? "Uploaded historical evidence · complete uploaded range (scenario window presets do not filter these observations)"
            : "Selected scenario window · battery state retains the full calculation horizon"}
        </p>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setImportsOpen((value) => !value)}
          disabled={!hydrated}
          aria-expanded={importsOpen}
        >
          <Upload aria-hidden="true" />
          Connect evidence
        </button>
      </div>

      {importsOpen ? (
        <article className="power-import">
          <header>
            <div>
              <p className="context-label">Historical evidence import</p>
              <h3>Load facility meter and BMS/PCS records</h3>
            </div>
            <span>
              CSV files are parsed in your browser. Parsed observations are sent to the GridPulse
              assessment service for validation.
            </span>
          </header>
          <div className="power-import-grid">
            <label>
              <Activity aria-hidden="true" />
              <strong>Facility meter CSV</strong>
              <span>timestamp, facility_import_mw, operating_limit_mw (optional)</span>
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label="Facility meter CSV"
                onChange={loadFacility}
              />
            </label>
            <label>
              <BatteryCharging aria-hidden="true" />
              <strong>Battery telemetry CSV</strong>
              <span>
                timestamp, soc_percent, active_power_mw; optional limits, SOH, temperature, state,
                alarms
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label="Battery telemetry CSV"
                onChange={loadBattery}
              />
            </label>
          </div>
          {message ? (
            <p className="power-import-status" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="operations-v2-form-error" role="alert">
              {error}
            </p>
          ) : null}
        </article>
      ) : null}

      <div className="power-kpis">
        <PowerMetric
          icon={<Cable />}
          label="Grid import"
          value={
            selected
              ? formatOptionalMw(valueOf(selected, "gridImportMw", "batteryDemandMw"))
              : "Unavailable"
          }
          evidence={mode}
        />
        <PowerMetric
          icon={<Bolt />}
          label="Facility limit"
          value={`${number.format(model.scenario.importLimitMw)} MW`}
          evidence="assumption"
        />
        <PowerMetric
          icon={<Gauge />}
          label="Required response"
          value={requiredMw == null ? "Unavailable" : `${number.format(requiredMw)} MW`}
          evidence={mode}
        />
        <PowerMetric
          icon={<Zap />}
          label="Discharge time · full horizon"
          value={
            mode === "scenario"
              ? model.recommendation.durationMinutes > 0
                ? `${number.format(model.recommendation.durationMinutes / 60)} h`
                : "Not required"
              : "Not derivable"
          }
          evidence={mode}
        />
      </div>

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
        <summary>Battery constraints & balance provenance</summary>
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
      <details className="operations-assurance-panel power-supporting-details">
        <summary>Compare scenario responses</summary>
        <ResponseComparison model={model} />
      </details>
      <details className="operations-assurance-panel power-supporting-details">
        <summary>Evidence & connector readiness</summary>
        <ConnectorStatus />
      </details>
    </section>
  );
}
