import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
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
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OperationsOverviewModel, OperationsInterval } from "./scenario-engine";
import { requestOperationsAssessment } from "@/lib/operations-api";
import { useOperationsCapabilities } from "./use-operations-capabilities";
import {
  parseBatteryCsv,
  parseFacilityPowerCsv,
  type BatteryObservation,
  type FacilityPowerObservation,
} from "./battery-dispatch";

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
      : selectedHistorical
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
        `${parsed.length} facility meter records loaded from ${file.name}${verified ? " and verified by the Operations backend" : ""}.`,
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
          <h3>
            {selected
              ? feasible
                ? "Battery response can hold the selected interval below target"
                : "Battery response cannot fully cover the selected interval"
              : "Load aligned meter and battery evidence"}
          </h3>
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
              : `${number.format(shortfallMw)} MW residual`}
          </span>
        </div>
      </article>

      <div className="power-toolbar">
        <div className="power-mode" role="group" aria-label="Power evidence mode">
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
              <p className="context-label">Browser-only import</p>
              <h3>Load facility meter and BMS/PCS records</h3>
            </div>
            <span>Files are parsed locally and are not uploaded.</span>
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
          icon={<Activity />}
          label="Facility demand"
          value={
            selected
              ? `${number.format(valueOf(selected, "facilityDemandMw", "baselineDemandMw"))} MW`
              : "Unavailable"
          }
          evidence={mode}
        />
        <PowerMetric
          icon={<ShieldCheck />}
          label="Safety target"
          value={`${number.format(targetMw)} MW`}
          evidence="assumption"
        />
        <PowerMetric
          icon={<Gauge />}
          label="Remaining margin"
          value={
            selected
              ? `${number.format(targetMw - valueOf(selected, "gridImportMw", "batteryDemandMw"))} MW`
              : "Unavailable"
          }
          evidence={mode}
        />
        <PowerMetric
          icon={<BatteryCharging />}
          label="Battery SOC"
          value={
            selected && valueOf(selected, "socPercent", "batterySocPercent") != null
              ? `${number.format(valueOf(selected, "socPercent", "batterySocPercent"))}%`
              : "Unavailable"
          }
          evidence={mode}
        />
        <PowerMetric
          icon={<Zap />}
          label="Battery power"
          value={batteryMw == null ? "Unavailable" : `${number.format(batteryMw)} MW`}
          evidence={mode}
        />
        <PowerMetric
          icon={<Cable />}
          label="Sustainable duration"
          value={mode === "scenario" ? durationLabel(model, selectedScenario) : "Not derivable"}
          evidence={mode}
        />
      </div>

      <div className="power-primary-grid">
        <article className="power-timeline-card">
          <header>
            <div>
              <p className="context-label">Chronological power balance</p>
              <h3>Demand, grid import, battery power and SOC</h3>
            </div>
            <EvidencePill mode={mode} />
          </header>
          {series.length ? (
            <PowerTimeline
              data={series}
              limitMw={model.scenario.importLimitMw}
              targetMw={targetMw}
              selectedTimestamp={selectedTimestamp}
            />
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

      <div className="power-detail-grid">
        <OperatingEnvelope
          model={model}
          selected={selectedScenario}
          mode={mode}
          selectedHistorical={selectedHistorical}
        />
        <SelectedBalance selected={selected} mode={mode} targetMw={targetMw} />
      </div>
      <ConnectorStatus />
    </section>
  );
}

type HistoricalPoint = {
  timestamp: string;
  label: string;
  facilityDemandMw: number;
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
  const batteryByTime = new Map(battery.map((point) => [point.timestamp, point]));
  return [...facility]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((point) => {
      const batteryPoint = batteryByTime.get(point.timestamp) ?? null;
      return {
        timestamp: point.timestamp,
        label: new Date(point.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        facilityDemandMw: point.facilityImportMw,
        gridImportMw: point.facilityImportMw,
        batteryPowerMw: batteryPoint?.activePowerMw ?? null,
        socPercent: batteryPoint?.socPercent ?? null,
        operatingLimitMw: point.operatingLimitMw,
        battery: batteryPoint,
      };
    });
}

function valueOf(point: unknown, historicalKey: string, scenarioKey: string): number {
  const record = point as Record<string, unknown>;
  const value = record[historicalKey] ?? record[scenarioKey];
  return typeof value === "number" ? value : 0;
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
      aria-label="Power demand, battery dispatch, grid import and battery state of charge over time"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 16, right: 20, left: 0, bottom: 4 }}
          accessibilityLayer
        >
          <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
          <XAxis dataKey="label" minTickGap={28} tickLine={false} axisLine={false} />
          <YAxis yAxisId="power" unit=" MW" tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="soc"
            orientation="right"
            domain={[0, 100]}
            unit="%"
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<PowerTooltip />} />
          <Legend />
          <ReferenceLine
            yAxisId="power"
            y={limitMw}
            stroke="var(--ops-limit)"
            strokeDasharray="7 5"
          />
          <ReferenceLine
            yAxisId="power"
            y={targetMw}
            stroke="var(--ops-assumption)"
            strokeDasharray="3 4"
          />
          {selectedLabel ? <ReferenceLine x={selectedLabel} stroke="var(--accent)" /> : null}
          <Area
            yAxisId="power"
            dataKey="facilityDemandMw"
            name="Facility demand"
            stroke="var(--ops-measured)"
            fill="var(--ops-measured-fill)"
          />
          <Line
            yAxisId="power"
            dataKey="gridImportMw"
            name="Grid import after battery"
            stroke="var(--ops-positive)"
            dot={false}
            strokeWidth={2}
            connectNulls={false}
          />
          <Bar
            yAxisId="power"
            dataKey="batteryPowerMw"
            name="Battery power (+ discharge)"
            fill="var(--ops-simulated)"
            opacity={0.72}
          />
          <Line
            yAxisId="soc"
            dataKey="socPercent"
            name="SOC"
            stroke="var(--ops-assumption)"
            dot={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function PowerTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="operations-v2-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <span key={item.name}>
          {item.name}: {number.format(item.value ?? 0)}
        </span>
      ))}
    </div>
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
  const rows = (data as Array<Record<string, unknown>>).filter(
    (_, index) => mode === "historical" || index % 8 === 0,
  );
  return (
    <details className="operations-v2-chart-data">
      <summary>Inspect interval data</summary>
      <div>
        <table>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Facility</th>
              <th scope="col">Battery</th>
              <th scope="col">Grid import</th>
              <th scope="col">SOC</th>
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
                <td>{number.format(valueOf(row, "facilityDemandMw", "baselineDemandMw"))} MW</td>
                <td>
                  {typeof row.batteryPowerMw === "number"
                    ? `${number.format(row.batteryPowerMw)} MW`
                    : "—"}
                </td>
                <td>{number.format(valueOf(row, "gridImportMw", "batteryDemandMw"))} MW</td>
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
          label="Residual overload"
          value={shortfallMw == null ? "Unavailable" : `${number.format(shortfallMw)} MW`}
        />
        <Row
          label="Starting reserve"
          value={`${number.format(model.scenario.battery.minimumSocPercent)}% SOC`}
        />
        <Row
          label="Ending SOC"
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
          <Row label="Timestamp" value={new Date(String(selected.timestamp)).toLocaleString()} />
          <Row
            label="Facility demand"
            value={`${number.format(valueOf(selected, "facilityDemandMw", "baselineDemandMw"))} MW`}
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
            value={`${number.format(valueOf(selected, "gridImportMw", "batteryDemandMw"))} MW`}
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
  return (
    <article className="operations-v2-metric">
      <header>
        <span aria-hidden="true">{icon}</span>
        <EvidencePill mode={evidence} />
      </header>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
function EvidencePill({ mode }: { mode: EvidenceMode | "assumption" }) {
  return (
    <span
      className={`operations-v2-evidence ${mode === "historical" ? "measured" : mode === "scenario" ? "simulated" : "user_assumption"}`}
    >
      {mode === "historical" ? "Measured" : mode === "scenario" ? "Simulated" : "Assumption"}
    </span>
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
