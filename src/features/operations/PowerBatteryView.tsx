import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Bolt,
  Cable,
  CheckCircle2,
  Database,
  Gauge,
  PlugZap,
  ShieldCheck,
  Upload,
  Zap,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OperationsOverviewModel, OperationsInterval } from "./scenario-engine";
import { requestOperationsAssessment } from "@/lib/operations-api";
import { alignPowerEvidence } from "./operations-service";
import { useOperationsCapabilities } from "./use-operations-capabilities";
import {
  parseBatteryCsv,
  parseFacilityPowerCsv,
  type BatteryObservation,
  type FacilityPowerObservation,
} from "./battery-dispatch";
import {
  ChartSummaryMetric,
  OperationsChartLegend,
  OperationsChartSummary,
  OperationsTooltipShell,
  TooltipRow,
  formatMw,
  formatPercent,
} from "./visualization";
import {
  OperationsDefinitionRow,
  OperationsEvidenceBadge,
  OperationsMetricCard,
} from "./components";
import { buildPowerBalancePresentation } from "./power-balance";
import { PowerBalanceDiagram } from "./PowerBalanceDiagram";
import { formatOperationsTime, importThresholds } from "./presentation";
import { OperationsSelect } from "./OperationsSelect";

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

type EvidenceMode = "scenario" | "historical";

export function PowerBatteryView({ model }: { model: OperationsOverviewModel }) {
  const [mode, setMode] = useState<EvidenceMode>("scenario");
  const [importsOpen, setImportsOpen] = useState(false);
  const [facilityObservations, setFacilityObservations] = useState<FacilityPowerObservation[]>([]);
  const [batteryObservations, setBatteryObservations] = useState<BatteryObservation[]>([]);
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const scenarioPeak = useMemo(
    () =>
      model.intervals.reduce(
        (peak, point) => (point.baselineDemandMw > peak.baselineDemandMw ? point : peak),
        model.intervals[0],
      ),
    [model],
  );
  const selectedScenario =
    model.intervals.find((point) => point.timestamp === selectedTimestamp) ?? scenarioPeak;
  const historical = useMemo(
    () => buildHistoricalSeries(facilityObservations, batteryObservations),
    [facilityObservations, batteryObservations],
  );
  const selectedHistorical =
    historical.find((point) => point.timestamp === selectedTimestamp) ?? historical.at(-1) ?? null;
  const hasHistorical = facilityObservations.length > 0 || batteryObservations.length > 0;
  const targetMw = model.scenario.importLimitMw - model.scenario.safetyReserveMw;
  const selected = mode === "scenario" ? selectedScenario : selectedHistorical;
  const series =
    mode === "scenario"
      ? model.intervals.map((point) => ({
          ...point,
          facilityDemandMw: point.baselineDemandMw,
          gridImportMw: point.batteryDemandMw,
          socPercent: point.batterySocPercent,
        }))
      : historical;
  const requiredMw =
    mode === "scenario"
      ? Math.max(0, selectedScenario.baselineDemandMw - targetMw)
      : selectedHistorical?.facilityDemandMw != null
        ? Math.max(0, selectedHistorical.facilityDemandMw - targetMw)
        : null;
  const batteryMw =
    mode === "scenario"
      ? selectedScenario.batteryPowerMw
      : (selectedHistorical?.batteryPowerMw ?? null);
  const shortfallMw =
    requiredMw == null || batteryMw == null
      ? null
      : Math.max(0, requiredMw - Math.max(0, batteryMw));
  const feasible = shortfallMw != null && shortfallMw <= 0.01;
  const thresholds = importThresholds(
    selected ? valueOf(selected, "gridImportMw", "batteryDemandMw") : null,
    model.scenario.importLimitMw,
    model.scenario.safetyReserveMw,
  );
  const responseRequired = requiredMw != null && requiredMw > 0.01;
  const dispatchHeadline =
    !selected || requiredMw == null
      ? "Load aligned meter and battery evidence"
      : !responseRequired
        ? "No battery response is required for the selected interval"
        : feasible
          ? "Battery response can hold the selected interval below target"
          : "Battery response cannot fully cover the selected interval";

  async function verifyEvidence(
    facility: FacilityPowerObservation[],
    battery: BatteryObservation[],
  ) {
    if (facility.length < 4) return null;
    return requestOperationsAssessment({
      kind: "power",
      facilityName: model.scenario.facilityName,
      contractedLimitMw: model.scenario.importLimitMw,
      limitEvidence: "customer_declared",
      facility,
      battery,
      batteryConfiguration:
        model.scenario.battery.usableEnergyMwh > 0
          ? {
              powerMw: model.scenario.battery.maximumPowerMw,
              energyMwh: model.scenario.battery.usableEnergyMwh,
              minimumReservePercent: model.scenario.battery.minimumSocPercent,
              roundTripEfficiency:
                model.scenario.battery.chargeEfficiency *
                model.scenario.battery.dischargeEfficiency,
            }
          : null,
    });
  }

  async function loadFacility(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseFacilityPowerCsv(await file.text());
      const verified = await verifyEvidence(parsed, batteryObservations);
      setFacilityObservations(parsed);
      setMode("historical");
      setMessage(
        `${parsed.length} facility meter records loaded from ${file.name}${verified ? " and input-validated by the Operations backend (not dispatch-verified)" : ""}.`,
      );
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read facility measurements.");
    }
    event.target.value = "";
  }
  async function loadBattery(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseBatteryCsv(await file.text());
      const verified = await verifyEvidence(facilityObservations, parsed);
      setBatteryObservations(parsed);
      setMode("historical");
      setMessage(
        `${parsed.length} BMS/PCS records loaded from ${file.name}${verified ? " and aligned by the Operations backend" : ""}.`,
      );
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read battery measurements.");
    }
    event.target.value = "";
  }

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
        <div className="power-mode" role="group" aria-label="Power evidence source">
          <button
            type="button"
            className={mode === "scenario" ? "active" : ""}
            onClick={() => setMode("scenario")}
            aria-pressed={mode === "scenario"}
          >
            Scenario
          </button>
          <button
            type="button"
            className={mode === "historical" ? "active" : ""}
            onClick={() => setMode("historical")}
            aria-pressed={mode === "historical"}
            disabled={!hasHistorical}
          >
            Historical evidence
          </button>
        </div>
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
          icon={<BatteryCharging />}
          label="Battery SOC"
          value={
            selected && valueOf(selected, "socPercent", "batterySocPercent") != null
              ? formatOptionalPercent(valueOf(selected, "socPercent", "batterySocPercent"))
              : "Unavailable"
          }
          evidence={mode}
        />
        <PowerMetric
          icon={<Zap />}
          label="Total discharge time"
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

      <div className="power-insight-grid">
        <PowerBalanceFlow selected={selected} mode={mode} />
        <BatterySocPanel
          model={model}
          selected={selectedScenario}
          mode={mode}
          selectedHistorical={selectedHistorical}
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
              <OperationsChartSummary>
                <ChartSummaryMetric
                  label="Facility Demand"
                  value={formatOptionalMw(
                    valueOf(selected, "facilityDemandMw", "baselineDemandMw"),
                  )}
                  tone="demand"
                />
                <ChartSummaryMetric
                  label="Grid Import"
                  value={formatOptionalMw(valueOf(selected, "gridImportMw", "batteryDemandMw"))}
                  tone="response"
                />
                <ChartSummaryMetric
                  label="Battery Dispatch"
                  value={batteryMw == null ? "Unavailable" : formatMw(batteryMw)}
                  tone="battery"
                />
                <ChartSummaryMetric
                  label="State of Charge"
                  value={
                    selected && valueOf(selected, "socPercent", "batterySocPercent") != null
                      ? formatOptionalPercent(valueOf(selected, "socPercent", "batterySocPercent"))
                      : "Unavailable"
                  }
                  tone="soc"
                />
              </OperationsChartSummary>
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
        <DispatchCard
          model={model}
          selected={selectedScenario}
          mode={mode}
          selectedHistorical={selectedHistorical}
          feasible={feasible}
          requiredMw={requiredMw}
          shortfallMw={shortfallMw}
        />
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

function ResponseComparison({ model }: { model: OperationsOverviewModel }) {
  const endingSoc =
    model.intervals.at(-1)?.batterySocPercent ?? model.scenario.battery.initialSocPercent;
  return (
    <article className="power-response-comparison">
      <header>
        <div>
          <p className="context-label">Response Comparison</p>
          <h3>Compare feasible operating responses</h3>
        </div>
        <span>All results simulated</span>
      </header>
      <div>
        {model.summaries.map((summary) => (
          <section
            key={summary.kind}
            className={summary.kind === "battery_workload" ? "selected" : ""}
          >
            <strong>{summary.label}</strong>
            <dl>
              <OperationsDefinitionRow
                label="Limit violations"
                value={summary.violationIntervals}
              />
              <OperationsDefinitionRow
                label="Peak import"
                value={`${number.format(summary.peakDemandMw)} MW`}
              />
              <OperationsDefinitionRow
                label="Ending SOC"
                value={
                  summary.kind === "baseline" ? "Not dispatched" : `${number.format(endingSoc)}%`
                }
              />
              <OperationsDefinitionRow
                label="Workload shifted"
                value={
                  summary.kind === "battery_workload"
                    ? `${number.format(model.recommendation.workloadMwh)} MWh`
                    : "0 MWh"
                }
              />
            </dl>
          </section>
        ))}
      </div>
    </article>
  );
}

type HistoricalPoint = {
  timestamp: string;
  label: string;
  facilityDemandMw: number | null;
  gridImportMw: number;
  batteryPowerMw: number | null;
  socPercent: number | null;
  operatingLimitMw: number | null;
  battery: BatteryObservation | null;
};
function buildHistoricalSeries(
  facility: FacilityPowerObservation[],
  battery: BatteryObservation[],
): HistoricalPoint[] {
  return alignPowerEvidence(facility, battery).map((point) => {
    const batteryPoint = point.battery;
    return {
      timestamp: point.timestamp,
      label: formatOperationsTime(point.timestamp).replace(" UTC", ""),
      facilityDemandMw: batteryPoint ? point.facilityImportMw + batteryPoint.activePowerMw : null,
      gridImportMw: point.facilityImportMw,
      batteryPowerMw: batteryPoint?.activePowerMw ?? null,
      socPercent: batteryPoint?.socPercent ?? null,
      operatingLimitMw: point.operatingLimitMw,
      battery: batteryPoint,
    };
  });
}

const formatOptionalMw = (value: number | null) =>
  value == null ? "Unavailable" : formatMw(value);
const formatOptionalPercent = (value: number | null) =>
  value == null ? "Unavailable" : formatPercent(value);

function valueOf(point: unknown, historicalKey: string, scenarioKey: string): number | null {
  const record = point as Record<string, unknown>;
  const value = record[historicalKey] ?? record[scenarioKey];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function PowerTimeline({
  data,
  limitMw,
  targetMw,
  selectedTimestamp,
}: {
  data: unknown[];
  limitMw: number;
  targetMw: number;
  selectedTimestamp: string | null;
}) {
  const selectedLabel = (data as Array<{ timestamp?: string; label?: string }>).find(
    (point) => point.timestamp === selectedTimestamp,
  )?.label;
  return (
    <div
      className="power-timeline"
      role="img"
      aria-label="Three aligned charts show facility demand and grid import in megawatts, battery dispatch in megawatts, and state of charge in percent"
    >
      <section className="power-timeline-panel power-timeline-panel--facility">
        <header>
          <strong>Facility Power</strong>
          <span>MW</span>
        </header>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 18, right: 18, left: 0, bottom: 0 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
            <XAxis dataKey="label" hide />
            <YAxis unit=" MW" tickLine={false} axisLine={false} />
            <Tooltip content={<PowerTooltip panel="facility" targetMw={targetMw} />} />
            <ReferenceLine
              y={limitMw}
              stroke="var(--ops-limit)"
              strokeDasharray="7 5"
              label={{
                value: `${number.format(limitMw)} MW limit`,
                fill: "var(--ops-limit)",
                position: "insideBottomLeft",
              }}
            />
            <ReferenceLine
              y={targetMw}
              stroke="var(--ops-target)"
              strokeDasharray="3 5"
              label={{
                value: `${number.format(targetMw)} MW target`,
                fill: "var(--ops-target)",
                position: "insideTopRight",
              }}
            />
            {selectedLabel ? (
              <ReferenceLine x={selectedLabel} stroke="var(--ops-selection)" />
            ) : null}
            <Area
              dataKey="facilityDemandMw"
              name="Facility demand"
              stroke="var(--ops-demand)"
              fill="var(--ops-demand-fill)"
              strokeWidth={2}
            />
            <Line
              dataKey="gridImportMw"
              name="Grid import"
              stroke="var(--ops-response)"
              dot={false}
              strokeWidth={3}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </section>
      <section className="power-timeline-panel power-timeline-panel--battery">
        <header>
          <strong>Battery Dispatch</strong>
          <span>MW</span>
        </header>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 18, left: 0, bottom: 4 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
            <XAxis dataKey="label" minTickGap={28} tickLine={false} axisLine={false} />
            <YAxis yAxisId="dispatch" unit=" MW" tickLine={false} axisLine={false} />
            <Tooltip content={<PowerTooltip panel="battery" targetMw={targetMw} />} />
            <ReferenceLine yAxisId="dispatch" y={0} stroke="var(--ops-axis)" />
            {selectedLabel ? (
              <ReferenceLine yAxisId="dispatch" x={selectedLabel} stroke="var(--ops-selection)" />
            ) : null}
            <Bar
              yAxisId="dispatch"
              dataKey="batteryPowerMw"
              name="Battery dispatch"
              fill="var(--ops-battery)"
              opacity={0.86}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </section>
      <section className="power-timeline-panel power-timeline-panel--battery">
        <header>
          <strong>Battery State of Charge</strong>
          <span>%</span>
        </header>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 18, left: 0, bottom: 4 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
            <XAxis dataKey="label" minTickGap={28} tickLine={false} axisLine={false} />
            <YAxis yAxisId="soc" domain={[0, 100]} unit="%" tickLine={false} axisLine={false} />
            <Tooltip content={<PowerTooltip panel="battery" targetMw={targetMw} />} />
            {selectedLabel ? (
              <ReferenceLine yAxisId="soc" x={selectedLabel} stroke="var(--ops-selection)" />
            ) : null}
            <Line
              yAxisId="soc"
              dataKey="socPercent"
              name="State of charge"
              stroke="var(--ops-soc)"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}

function PowerTooltip({
  active,
  payload,
  label,
  panel,
  targetMw,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
  panel: "facility" | "battery";
  targetMw: number;
}) {
  if (!active || !payload?.length) return null;
  const importValue = payload.find((item) => item.name === "Grid import")?.value;
  const status =
    panel === "facility" && importValue != null
      ? importValue <= targetMw
        ? "Status: Meets the safety target"
        : `Status: ${formatMw(importValue - targetMw)} above the safety target`
      : undefined;
  return (
    <OperationsTooltipShell label={label} status={status}>
      {payload.map((item) => (
        <TooltipRow
          key={item.name}
          label={item.name ?? "Series"}
          value={
            item.name === "State of charge"
              ? formatPercent(item.value ?? 0)
              : formatMw(item.value ?? 0)
          }
          tone={
            item.name === "Facility demand"
              ? "demand"
              : item.name === "Grid import"
                ? "response"
                : item.name === "State of charge"
                  ? "soc"
                  : "battery"
          }
          detail={panel === "facility" ? "Facility" : "Battery"}
        />
      ))}
    </OperationsTooltipShell>
  );
}

function PowerDataTable({
  data,
  onSelect,
  selectedTimestamp,
  mode,
}: {
  data: unknown[];
  onSelect: (value: string) => void;
  selectedTimestamp: string | null;
  mode: EvidenceMode;
}) {
  const rows = data as Array<Record<string, unknown>>;
  return (
    <details className="operations-v2-chart-data">
      <summary>View Full Interval Data</summary>
      <div>
        <table>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Facility Demand (MW)</th>
              <th scope="col">Battery Dispatch (MW)</th>
              <th scope="col">Grid Import (MW)</th>
              <th scope="col">State of Charge (%)</th>
              <th scope="col">Constraint</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={String(row.timestamp)}
                className={selectedTimestamp === row.timestamp ? "selected" : ""}
              >
                <th scope="row">
                  <button type="button" onClick={() => onSelect(String(row.timestamp))}>
                    {String(row.label)}
                  </button>
                </th>
                <td>{formatOptionalMw(valueOf(row, "facilityDemandMw", "baselineDemandMw"))}</td>
                <td>
                  {typeof row.batteryPowerMw === "number"
                    ? `${number.format(row.batteryPowerMw)} MW`
                    : "—"}
                </td>
                <td>{formatOptionalMw(valueOf(row, "gridImportMw", "batteryDemandMw"))}</td>
                <td>
                  {typeof (row.socPercent ?? row.batterySocPercent) === "number"
                    ? `${number.format(Number(row.socPercent ?? row.batterySocPercent))}%`
                    : "—"}
                </td>
                <td>{String(row.batteryConstraintCode ?? "Observed")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function DispatchCard({
  model,
  selected,
  mode,
  selectedHistorical,
  feasible,
  requiredMw,
  shortfallMw,
}: {
  model: OperationsOverviewModel;
  selected: OperationsInterval;
  mode: EvidenceMode;
  selectedHistorical: HistoricalPoint | null;
  feasible: boolean;
  requiredMw: number | null;
  shortfallMw: number | null;
}) {
  const batteryPower =
    mode === "scenario" ? selected.batteryPowerMw : (selectedHistorical?.batteryPowerMw ?? null);
  return (
    <article className="power-dispatch-card">
      <header>
        {feasible ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
        <div>
          <p className="context-label">Selected-interval recommendation</p>
          <h3>
            {mode === "scenario"
              ? feasible
                ? "Feasible in this scenario"
                : "Response is constrained"
              : "Historical evidence review"}
          </h3>
        </div>
      </header>
      <dl>
        <Row
          label="Required response"
          value={requiredMw == null ? "Unavailable" : `${number.format(requiredMw)} MW`}
        />
        <Row
          label="Achievable response"
          value={
            batteryPower == null ? "Unavailable" : `${number.format(Math.max(0, batteryPower))} MW`
          }
        />
        <Row
          label="Shortfall to safety target"
          value={shortfallMw == null ? "Unavailable" : `${number.format(shortfallMw)} MW`}
        />
        <Row
          label="Starting reserve"
          value={`${number.format(model.scenario.battery.minimumSocPercent)}% SOC`}
        />
        <Row
          label="Selected interval SOC"
          value={
            mode === "scenario"
              ? `${number.format(selected.batterySocPercent)}%`
              : selectedHistorical?.socPercent == null
                ? "Unavailable"
                : `${number.format(selectedHistorical.socPercent)}%`
          }
        />
        <Row
          label="Binding constraint"
          value={
            mode === "scenario"
              ? humanConstraint(selected.batteryConstraintCode)
              : "Not inferred from observations"
          }
        />
      </dl>
      <p className="power-readonly">
        <ShieldCheck aria-hidden="true" />
        Advisory output only. An operator or authorized EMS must approve and execute dispatch.
      </p>
    </article>
  );
}

function OperatingEnvelope({
  model,
  selected,
  mode,
  selectedHistorical,
}: {
  model: OperationsOverviewModel;
  selected: OperationsInterval;
  mode: EvidenceMode;
  selectedHistorical: HistoricalPoint | null;
}) {
  const battery = model.scenario.battery;
  const observation = selectedHistorical?.battery;
  return (
    <article className="power-detail-card">
      <header>
        <div>
          <p className="context-label">Operating envelope</p>
          <h3>Battery constraints</h3>
        </div>
        <EvidencePill mode={mode} />
      </header>
      <dl>
        <Row
          label="SOC"
          value={
            mode === "scenario"
              ? `${number.format(selected.batterySocPercent)}%`
              : observation
                ? `${number.format(observation.socPercent)}%`
                : "Unavailable"
          }
        />
        <Row
          label="SOC bounds"
          value={`${number.format(battery.minimumSocPercent)}–${number.format(battery.maximumSocPercent)}%`}
        />
        <Row
          label="Allowed discharge"
          value={
            mode === "scenario"
              ? `${number.format(selected.availableDischargeMw)} MW`
              : observation?.allowedDischargeMw == null
                ? "Unavailable"
                : `${number.format(observation.allowedDischargeMw)} MW`
          }
        />
        <Row
          label="Allowed charge"
          value={
            mode === "scenario"
              ? `${number.format(selected.availableChargeMw)} MW`
              : observation?.allowedChargeMw == null
                ? "Unavailable"
                : `${number.format(observation.allowedChargeMw)} MW`
          }
        />
        <Row
          label="State of health"
          value={
            mode === "scenario"
              ? `${number.format(battery.stateOfHealthPercent)}%`
              : observation?.stateOfHealthPercent == null
                ? "Unavailable"
                : `${number.format(observation.stateOfHealthPercent)}%`
          }
        />
        <Row
          label="Inverter"
          value={
            mode === "scenario"
              ? battery.inverterAvailable
                ? "Available"
                : "Unavailable"
              : (observation?.inverterState ?? "Unavailable")
          }
        />
        <Row
          label="Temperature"
          value={
            observation?.temperatureC == null
              ? mode === "scenario"
                ? "Not modelled"
                : "Unavailable"
              : `${number.format(observation.temperatureC)} °C`
          }
        />
        <Row
          label="Alarms"
          value={observation?.alarms ?? (mode === "scenario" ? "Not modelled" : "Unavailable")}
        />
      </dl>
    </article>
  );
}

function SelectedBalance({
  selected,
  mode,
  targetMw,
}: {
  selected: Record<string, unknown> | OperationsInterval | HistoricalPoint | null;
  mode: EvidenceMode;
  targetMw: number;
}) {
  return (
    <article className="power-detail-card">
      <header>
        <div>
          <p className="context-label">Selected interval</p>
          <h3>Power balance and provenance</h3>
        </div>
        <EvidencePill mode={mode} />
      </header>
      {selected ? (
        <dl>
          <Row label="Timestamp" value={formatOperationsTime(String(selected.timestamp), true)} />
          <Row
            label="Facility demand"
            value={formatOptionalMw(valueOf(selected, "facilityDemandMw", "baselineDemandMw"))}
          />
          <Row
            label="Battery power"
            value={
              typeof selected.batteryPowerMw === "number"
                ? `${number.format(selected.batteryPowerMw)} MW`
                : "Unavailable"
            }
          />
          <Row
            label="Grid import"
            value={formatOptionalMw(valueOf(selected, "gridImportMw", "batteryDemandMw"))}
          />
          <Row label="Safety target" value={`${number.format(targetMw)} MW · assumption`} />
          <Row
            label="Balance check"
            value={
              typeof selected.batteryPowerMw === "number"
                ? "Demand − battery = grid import"
                : "Cannot calculate without battery telemetry"
            }
          />
        </dl>
      ) : (
        <EmptyEvidence />
      )}
    </article>
  );
}

function ConnectorStatus() {
  const { data: capabilities } = useOperationsCapabilities();
  const iconFor = (id: string) =>
    id === "facility_meter" ? (
      <Activity />
    ) : id === "bms" ? (
      <BatteryCharging />
    ) : id === "nvidia_dcgm" ? (
      <Zap />
    ) : id === "openems" ? (
      <PlugZap />
    ) : id === "sunspec" ? (
      <Cable />
    ) : (
      <Database />
    );
  const connectors =
    capabilities?.connectors.filter((connector) =>
      ["facility_meter", "bms", "nvidia_dcgm"].includes(connector.id),
    ) ?? [];
  return (
    <article className="power-connectors">
      <header>
        <div>
          <p className="context-label">Evidence & connector status</p>
          <h3>Read-only data paths</h3>
        </div>
        <span>
          {connectors.some((item) => item.status === "connected")
            ? "Live evidence connected"
            : "No live connectors configured"}
        </span>
      </header>
      <div>
        {connectors.map((item) => (
          <section key={item.id}>
            <span aria-hidden="true">{iconFor(item.id)}</span>
            <div>
              <strong>{item.label}</strong>
              <small>{item.transport}</small>
            </div>
            <i>Read only</i>
          </section>
        ))}
      </div>
    </article>
  );
}

function PowerBalanceFlow({
  selected,
  mode,
}: {
  selected: Record<string, unknown> | OperationsInterval | HistoricalPoint | null;
  mode: EvidenceMode;
}) {
  const facility = selected ? valueOf(selected, "facilityDemandMw", "baselineDemandMw") : null;
  const grid = selected ? valueOf(selected, "gridImportMw", "batteryDemandMw") : null;
  const battery =
    selected && typeof selected.batteryPowerMw === "number" ? selected.batteryPowerMw : null;
  const gpu =
    mode === "scenario" &&
    selected &&
    "gpuPowerMw" in selected &&
    typeof selected.gpuPowerMw === "number"
      ? selected.gpuPowerMw
      : null;
  const balance =
    facility == null || grid == null
      ? null
      : buildPowerBalancePresentation({
          facilityMw: facility,
          gridMw: grid,
          batteryMw: battery,
          gpuMw: gpu,
        });
  return (
    <article className="power-flow-card">
      <header>
        <div>
          <p className="context-label">
            Selected interval ·{" "}
            {selected && typeof selected.timestamp === "string"
              ? formatOperationsTime(selected.timestamp, true)
              : "Unavailable"}
          </p>
          <h3>Facility Power Balance</h3>
        </div>
        <EvidencePill mode={mode} />
      </header>
      {balance ? (
        <PowerBalanceDiagram balance={balance} />
      ) : selected ? (
        <p className="balance-warning" role="status">
          Power balance unavailable: matching battery and facility readings are required. Missing
          values are not assumed to be zero.
        </p>
      ) : (
        <EmptyEvidence />
      )}
      <p className="power-flow-note">
        {mode === "scenario"
          ? "Scenario allocation. Other load includes all consumption not allocated to compute; individual cooling or UPS measurements are not inferred."
          : "Facility demand is derived from aligned net-import and battery readings. Sub-loads are unavailable."}
      </p>
    </article>
  );
}

function BatterySocPanel({
  model,
  selected,
  mode,
  selectedHistorical,
}: {
  model: OperationsOverviewModel;
  selected: OperationsInterval;
  mode: EvidenceMode;
  selectedHistorical: HistoricalPoint | null;
}) {
  const battery = model.scenario.battery;
  const observation = selectedHistorical?.battery;
  const soc = mode === "scenario" ? selected.batterySocPercent : (observation?.socPercent ?? null);
  const stateOfHealth =
    mode === "scenario"
      ? battery.stateOfHealthPercent
      : (observation?.stateOfHealthPercent ?? null);
  const boundedSoc = Math.max(0, Math.min(100, soc ?? 0));
  const energyAboveReserve =
    mode === "scenario" && soc != null
      ? (((battery.usableEnergyMwh * battery.stateOfHealthPercent) / 100) *
          Math.max(0, soc - battery.minimumSocPercent)) /
        100
      : null;
  return (
    <article className="battery-soc-card">
      <header>
        <div>
          <p className="context-label">Battery reserve</p>
          <h3>State of Charge & Reserve</h3>
        </div>
        <EvidencePill mode={mode} />
      </header>
      <div className="battery-soc-body">
        <div
          className="battery-reserve-gauge"
          role="img"
          aria-label={
            soc == null
              ? "Battery state of charge unavailable"
              : `Battery state of charge ${number.format(soc)} percent`
          }
        >
          <span className="battery-reserve-reading">
            <strong>{soc == null ? "—" : number.format(soc)}</strong>
            <small>{soc == null ? "Unavailable" : "% SOC"}</small>
          </span>
          <div className="battery-reserve-track" aria-hidden="true">
            <i className="battery-reserve-fill" style={{ width: `${boundedSoc}%` }} />
            <i
              className="battery-reserve-protected"
              style={{ width: `${battery.minimumSocPercent}%` }}
            />
            <i
              className="battery-reserve-marker"
              style={{ left: `${battery.minimumSocPercent}%` }}
            />
            <i
              className="battery-reserve-marker maximum"
              style={{ left: `${battery.maximumSocPercent}%` }}
            />
          </div>
          <p className="power-flow-note">Reserve and maximum markers use configured assumptions.</p>
        </div>
        <dl>
          <Row label="Minimum reserve" value={`${number.format(battery.minimumSocPercent)}%`} />
          <Row label="Maximum SOC" value={`${number.format(battery.maximumSocPercent)}%`} />
          <Row
            label="State of health"
            value={stateOfHealth == null ? "Unavailable" : `${number.format(stateOfHealth)}%`}
          />
          <Row
            label="Endurance at selected power"
            value={mode === "scenario" ? durationLabel(model, selected) : "Not derivable"}
          />
          <Row
            label="Energy above reserve"
            value={
              energyAboveReserve == null
                ? "Not derivable"
                : `${number.format(energyAboveReserve)} MWh`
            }
          />
        </dl>
      </div>
      <p className="power-flow-note">
        Endurance includes discharge efficiency and state of health; it is an estimate, not a backup
        guarantee.
      </p>
    </article>
  );
}

function PowerMetric({
  icon,
  label,
  value,
  evidence,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  evidence: EvidenceMode | "assumption";
}) {
  const evidenceClass =
    evidence === "historical"
      ? "measured"
      : evidence === "scenario"
        ? "simulated"
        : "user_assumption";
  return <OperationsMetricCard icon={icon} label={label} value={value} evidence={evidenceClass} />;
}
function EvidencePill({ mode }: { mode: EvidenceMode | "assumption" }) {
  const kind =
    mode === "historical" ? "measured" : mode === "scenario" ? "simulated" : "user_assumption";
  return (
    <OperationsEvidenceBadge
      kind={kind}
      label={mode === "historical" ? "Measured" : mode === "scenario" ? "Simulated" : "Assumption"}
    />
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function EmptyEvidence() {
  return (
    <div className="power-empty">
      <Database aria-hidden="true" />
      <strong>No accepted records</strong>
      <span>
        Import the required real measurements; missing values are not synthetically filled.
      </span>
    </div>
  );
}
function durationLabel(model: OperationsOverviewModel, selected: OperationsInterval) {
  const usable =
    ((((model.scenario.battery.usableEnergyMwh * model.scenario.battery.stateOfHealthPercent) /
      100) *
      Math.max(0, selected.batterySocPercent - model.scenario.battery.minimumSocPercent)) /
      100) *
    model.scenario.battery.dischargeEfficiency;
  return selected.batteryPowerMw > 0
    ? `${number.format(usable / selected.batteryPowerMw)} h`
    : "Ready";
}
function humanConstraint(code: string) {
  return (
    (
      {
        none: "None",
        power_limited: "Power limit",
        energy_limited: "Energy limit",
        soc_minimum: "Minimum SOC",
        soc_maximum: "Maximum SOC",
        ramp_limited: "Ramp rate",
        minimum_dwell: "Minimum dwell",
        asset_unavailable: "Asset unavailable",
        inverter_unavailable: "Inverter unavailable",
      } as Record<string, string>
    )[code] ?? code
  );
}
