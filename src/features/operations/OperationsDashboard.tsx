import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Bolt,
  Cpu,
  Database,
  Gauge,
  Info,
  Settings2,
  ShieldCheck,
  TrendingDown,
  Zap,
} from "lucide-react";
import {
  Area,
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
import { evidenceLabels, type EvidenceClass, type EvidencedValue } from "./evidence";
import {
  buildOperationsScenario,
  defaultOperationsScenario,
  operationsScenarioSchema,
  type OperationsOverviewModel,
  type OperationsScenario,
  type OperationsScenarioKind,
} from "./scenario-engine";
import { ComputeWorkloadsView } from "./ComputeWorkloadsView";
import { PowerBatteryView } from "./PowerBatteryView";
import { fetchOperationsCapabilities, requestOperationsAssessment } from "@/lib/operations-api";

export type OperationsView = "overview" | "compute" | "power";

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export function OperationsDashboard({ view }: { view: OperationsView }) {
  const [scenario, setScenario] = useState(defaultOperationsScenario);
  const [selected, setSelected] = useState<OperationsScenarioKind>("battery_workload");
  const [announcement, setAnnouncement] = useState("Default scenario loaded.");
  const [serverModel, setServerModel] = useState<OperationsOverviewModel | null>(null);
  const [backendState, setBackendState] = useState<"checking" | "verified" | "unavailable">(
    "checking",
  );
  const model = serverModel ?? buildOperationsScenario(scenario);

  useEffect(() => {
    let active = true;
    Promise.all([
      requestOperationsAssessment<OperationsOverviewModel>({ kind: "overview", scenario }),
      fetchOperationsCapabilities(),
    ])
      .then(([assessment]) => {
        if (!active) return;
        setServerModel(assessment.result);
        setBackendState("verified");
      })
      .catch(() => {
        if (!active) return;
        setBackendState("unavailable");
      });
    return () => {
      active = false;
    };
  }, [scenario]);

  return (
    <main id="main-content" className="operations-v2">
      <header className="operations-v2-header">
        <div>
          <p className="context-label">Data-Centre Power Operations</p>
          <h1>Power Operations</h1>
          <p>
            Translate a defined facility power limit into compute, battery, and workload decisions.
          </p>
        </div>
        <div className="operations-v2-context">
          <EvidenceBadge kind="simulated" label="Scenario Simulation" />
          <span className="operations-v2-facility">
            <Database aria-hidden="true" />
            {scenario.facilityName}
          </span>
          <span className={`operations-v2-backend ${backendState}`}>
            {backendState === "verified"
              ? "Backend verified"
              : backendState === "checking"
                ? "Checking backend"
                : "Backend unavailable"}
          </span>
          <ScenarioEditor
            scenario={scenario}
            onApply={(next) => {
              setScenario(next);
              setAnnouncement("Scenario assumptions updated. Dashboard results recalculated.");
            }}
          />
        </div>
      </header>

      <div className="operations-v2-nav-row">
        <nav className="operations-v2-tabs" aria-label="Power Operations views">
          <OperationsTab id="overview" label="Overview" current={view} />
          <OperationsTab id="compute" label="Compute & Workloads" current={view} />
          <OperationsTab id="power" label="Power & Battery" current={view} />
        </nav>
        <p className="operations-v2-provenance">
          <Info aria-hidden="true" />
          Scenario inputs and simulated results—not measured telemetry or operational instructions.
        </p>
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {view === "overview" ? (
        <OverviewView model={model} selected={selected} onSelect={setSelected} />
      ) : null}
      {view === "compute" ? <ComputeWorkloadsView model={model} /> : null}
      {view === "power" ? <PowerBatteryView model={model} /> : null}
    </main>
  );
}

function OperationsTab({
  id,
  label,
  current,
}: {
  id: OperationsView;
  label: string;
  current: OperationsView;
}) {
  return (
    <Link
      to="/operations"
      search={{ view: id }}
      className={current === id ? "active" : undefined}
      aria-current={current === id ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

function OverviewView({
  model,
  selected,
  onSelect,
}: {
  model: OperationsOverviewModel;
  selected: OperationsScenarioKind;
  onSelect: (kind: OperationsScenarioKind) => void;
}) {
  const selectedSummary =
    model.summaries.find((item) => item.kind === selected) ?? model.summaries[2];
  const snapshot = peakInterval(model);
  return (
    <section className="operations-v2-view" aria-labelledby="operations-overview-title">
      <h2 id="operations-overview-title" className="sr-only">
        Operations Overview
      </h2>
      <div className="operations-v2-kpis">
        <MetricCard
          icon={<Activity />}
          label="Facility Demand"
          metric={model.metrics.facilityDemand}
          note={`Peak scenario snapshot at ${snapshot.label}`}
        />
        <MetricCard
          icon={<Bolt />}
          label="Operational Limit"
          metric={model.metrics.operationalLimit}
          note="Configured facility limit"
        />
        <MetricCard
          icon={<Gauge />}
          label="Remaining Margin"
          metric={model.metrics.remainingMargin}
          note="After safety reserve"
        />
        <MetricCard
          icon={<Cpu />}
          label="Additional GPUs"
          metric={model.metrics.additionalGpus}
          note="Reference-power estimate"
          format="integer"
        />
        <MetricCard
          icon={<AlertTriangle />}
          label="Limit Risk"
          metric={model.metrics.limitRisk}
          note={`${model.summaries[0].violationIntervals} baseline intervals`}
          tone={model.metrics.limitRisk.value === "High" ? "danger" : "warning"}
        />
      </div>

      <div className="operations-v2-overview-grid">
        <DemandChart model={model} selected={selected} />
        <article className="operations-v2-recommendation">
          <header>
            <Zap aria-hidden="true" />
            <div>
              <p className="context-label">Recommended Scenario</p>
              <h3>Battery + Workload Response</h3>
            </div>
          </header>
          <p className="operations-v2-recommendation-copy">
            Test up to <strong>{number.format(model.recommendation.batteryMw)}&nbsp;MW</strong> of
            battery response and shift{" "}
            <strong>{number.format(model.recommendation.workloadMwh)}&nbsp;MWh</strong> of flexible
            demand.
          </p>
          <dl>
            <ImpactRow
              label="Violation Intervals Avoided"
              value={integer.format(model.recommendation.violationsAvoided)}
            />
            <ImpactRow
              label="Peak Reduction"
              value={`${number.format(model.recommendation.peakReductionMw)} MW`}
            />
            <ImpactRow
              label="GPU-Hours Enabled"
              value={`${integer.format(model.recommendation.additionalGpuHours)} h`}
            />
            <ImpactRow
              label="Selected Peak"
              value={`${number.format(selectedSummary.peakDemandMw)} MW`}
            />
          </dl>
          <div className="operations-v2-readonly">
            <ShieldCheck aria-hidden="true" />
            <span>Read-only scenario. No physical control command will be sent.</span>
          </div>
        </article>
      </div>
      <ScenarioComparison model={model} selected={selected} onSelect={onSelect} />
    </section>
  );
}

function DemandChart({
  model,
  selected,
  compact = false,
}: {
  model: OperationsOverviewModel;
  selected: OperationsScenarioKind;
  compact?: boolean;
}) {
  const selectedKey =
    selected === "baseline"
      ? "baselineDemandMw"
      : selected === "battery"
        ? "batteryDemandMw"
        : "combinedDemandMw";
  return (
    <article className={`operations-v2-chart-card${compact ? " compact" : ""}`}>
      <ChartHeader
        eyebrow="24-Hour Scenario"
        title="Facility Demand & Operating Limit"
        badge="Simulated"
      />
      <div
        className="operations-v2-chart"
        role="img"
        aria-label="Facility demand scenarios compared with the configured operating limit"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={model.intervals}
            margin={{ top: 12, right: 18, left: 4, bottom: 4 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
            <XAxis dataKey="label" interval={11} tickLine={false} axisLine={false} />
            <YAxis
              domain={[
                0,
                Math.ceil(
                  Math.max(
                    model.scenario.importLimitMw * 1.15,
                    ...model.intervals.map((point) => point.baselineDemandMw),
                  ) / 10,
                ) * 10,
              ]}
              unit=" MW"
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<OperationsTooltip />} />
            <Legend />
            <ReferenceLine
              y={model.scenario.importLimitMw}
              stroke="var(--ops-limit)"
              strokeDasharray="7 5"
              label={{
                value: `${model.scenario.importLimitMw} MW limit`,
                fill: "var(--ops-limit)",
                position: "insideTopLeft",
              }}
            />
            <Area
              dataKey="baselineDemandMw"
              name="Baseline Demand"
              stroke="var(--ops-measured)"
              fill="var(--ops-measured-fill)"
              strokeWidth={2}
            />
            {selected !== "baseline" ? (
              <Line
                dataKey={selectedKey}
                name={selected === "battery" ? "Battery Response" : "Battery + Workload"}
                stroke="var(--ops-simulated)"
                strokeWidth={2.5}
                dot={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <AccessibleIntervalTable model={model} mode="power" />
    </article>
  );
}

function ScenarioComparison({
  model,
  selected,
  onSelect,
  compact = false,
}: {
  model: OperationsOverviewModel;
  selected: OperationsScenarioKind;
  onSelect: (kind: OperationsScenarioKind) => void;
  compact?: boolean;
}) {
  return (
    <section
      className={`operations-v2-comparison${compact ? " compact" : ""}`}
      aria-labelledby={`scenario-comparison-${compact ? "compact" : "full"}`}
    >
      <header>
        <div>
          <p className="context-label">Scenario Comparison</p>
          <h3 id={`scenario-comparison-${compact ? "compact" : "full"}`}>
            Compare Operational Responses
          </h3>
        </div>
        <small>All results simulated</small>
      </header>
      <div className="operations-v2-comparison-grid">
        {model.summaries.map((summary) => (
          <button
            type="button"
            key={summary.kind}
            className={selected === summary.kind ? "selected" : ""}
            onClick={() => onSelect(summary.kind)}
            aria-pressed={selected === summary.kind}
          >
            <span>
              <i aria-hidden="true" />
              {summary.label}
            </span>
            <dl>
              <div>
                <dt>Limit Violations</dt>
                <dd>{summary.violationIntervals}</dd>
              </div>
              <div>
                <dt>Peak Demand</dt>
                <dd>{number.format(summary.peakDemandMw)} MW</dd>
              </div>
              {!compact ? (
                <div>
                  <dt>Total Energy</dt>
                  <dd>{number.format(summary.totalEnergyMwh)} MWh</dd>
                </div>
              ) : null}
              <div>
                <dt>GPU-Hours</dt>
                <dd>{integer.format(summary.additionalGpuHours)}</dd>
              </div>
            </dl>
          </button>
        ))}
      </div>
    </section>
  );
}

function ScenarioEditor({
  scenario,
  onApply,
}: {
  scenario: OperationsScenario;
  onApply: (scenario: OperationsScenario) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(scenario);
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = operationsScenarioSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the scenario assumptions.");
      return;
    }
    onApply(parsed.data);
    setError("");
    setOpen(false);
  }
  return (
    <div className="operations-v2-editor">
      <button
        type="button"
        className="operations-v2-configure"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <Settings2 aria-hidden="true" />
        Configure Scenario
      </button>
      {open ? (
        <form onSubmit={submit} className="operations-v2-editor-panel">
          <header>
            <div>
              <p className="context-label">Scenario Assumptions</p>
              <h2>Configure Scenario</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close scenario configuration"
            >
              ×
            </button>
          </header>
          <div className="operations-v2-editor-grid">
            <NumberField
              label="Facility Limit"
              unit="MW"
              value={draft.importLimitMw}
              onChange={(value) => setDraft({ ...draft, importLimitMw: value })}
            />
            <NumberField
              label="Safety Reserve"
              unit="MW"
              value={draft.safetyReserveMw}
              onChange={(value) => setDraft({ ...draft, safetyReserveMw: value })}
            />
            <NumberField
              label="PUE"
              value={draft.pue}
              step="0.01"
              onChange={(value) => setDraft({ ...draft, pue: value })}
            />
            <NumberField
              label="GPU Count"
              value={draft.gpuCount}
              step="1"
              onChange={(value) => setDraft({ ...draft, gpuCount: value })}
            />
            <NumberField
              label="GPU Active Power"
              unit="W"
              value={draft.gpuActivePowerWatts}
              onChange={(value) => setDraft({ ...draft, gpuActivePowerWatts: value })}
            />
            <NumberField
              label="Battery Power"
              unit="MW"
              value={draft.battery.maximumPowerMw}
              onChange={(value) =>
                setDraft({ ...draft, battery: { ...draft.battery, maximumPowerMw: value } })
              }
            />
            <NumberField
              label="Battery Energy"
              unit="MWh"
              value={draft.battery.usableEnergyMwh}
              onChange={(value) =>
                setDraft({ ...draft, battery: { ...draft.battery, usableEnergyMwh: value } })
              }
            />
            <NumberField
              label="Shiftable Workload"
              unit="%"
              value={draft.maximumShiftablePercent}
              onChange={(value) => setDraft({ ...draft, maximumShiftablePercent: value })}
            />
          </div>
          {error ? (
            <p role="alert" className="operations-v2-form-error">
              {error}
            </p>
          ) : null}
          <footer>
            <EvidenceBadge kind="user_assumption" />
            <button type="submit" className="primary-button">
              Recalculate Scenario
            </button>
          </footer>
        </form>
      ) : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  unit,
  step = "0.1",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  step?: string;
}) {
  const id = `ops-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <label htmlFor={id}>
      {label}
      <span>
        <input
          id={id}
          name={id}
          type="number"
          inputMode="decimal"
          autoComplete="off"
          min="0"
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {unit ? <em>{unit}</em> : null}
      </span>
    </label>
  );
}

function EvidenceBadge({ kind, label }: { kind: EvidenceClass; label?: string }) {
  return <span className={`operations-v2-evidence ${kind}`}>{label ?? evidenceLabels[kind]}</span>;
}

function MetricCard<T>({
  icon,
  label,
  metric,
  note,
  tone,
  format,
}: {
  icon: ReactNode;
  label: string;
  metric: EvidencedValue<T>;
  note: string;
  tone?: "warning" | "danger";
  format?: "integer";
}) {
  const value =
    metric.value == null
      ? "Unavailable"
      : typeof metric.value === "number"
        ? format === "integer"
          ? integer.format(metric.value)
          : number.format(metric.value)
        : String(metric.value);
  return (
    <article className={`operations-v2-metric ${tone ?? ""}`}>
      <header>
        <span aria-hidden="true">{icon}</span>
        <EvidenceBadge kind={metric.evidenceClass} />
      </header>
      <p>{label}</p>
      <strong>
        {value}
        {metric.value != null && metric.unit ? <small>&nbsp;{metric.unit}</small> : null}
      </strong>
      <small>{note}</small>
    </article>
  );
}

function ChartHeader({ eyebrow, title, badge }: { eyebrow: string; title: string; badge: string }) {
  return (
    <header className="operations-v2-chart-header">
      <div>
        <p className="context-label">{eyebrow}</p>
        <h3>{title}</h3>
      </div>
      <span>{badge}</span>
    </header>
  );
}

function ImpactRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function OperationsTooltip({
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
    <div className="operations-v2-tooltip" role="status" aria-live="polite">
      <strong>{label}</strong>
      {payload.map((item) => (
        <span key={item.name} style={{ "--series": item.color } as CSSProperties}>
          {item.name}: {number.format(item.value ?? 0)}
        </span>
      ))}
    </div>
  );
}

function AccessibleIntervalTable({
  model,
  mode,
}: {
  model: OperationsOverviewModel;
  mode: "power" | "compute";
}) {
  const sampled = model.intervals.filter(
    (_, index) => index % 8 === 0 || index === model.intervals.length - 1,
  );
  return (
    <details className="operations-v2-chart-data">
      <summary>View Chart Data</summary>
      <div>
        <table>
          <thead>
            <tr>
              <th scope="col">Time</th>
              {mode === "power" ? (
                <>
                  <th scope="col">Baseline</th>
                  <th scope="col">Battery</th>
                  <th scope="col">Combined</th>
                </>
              ) : (
                <>
                  <th scope="col">Active GPUs</th>
                  <th scope="col">Utilisation</th>
                  <th scope="col">GPU Power</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sampled.map((point) => (
              <tr key={point.timestamp}>
                <th scope="row">{point.label}</th>
                {mode === "power" ? (
                  <>
                    <td>{number.format(point.baselineDemandMw)} MW</td>
                    <td>{number.format(point.batteryDemandMw)} MW</td>
                    <td>{number.format(point.combinedDemandMw)} MW</td>
                  </>
                ) : (
                  <>
                    <td>{integer.format(point.activeGpuCount)}</td>
                    <td>{number.format(point.utilizationPercent)}%</td>
                    <td>{number.format(point.gpuPowerMw)} MW</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function peakInterval(model: OperationsOverviewModel) {
  return model.intervals.reduce(
    (peak, interval) => (interval.baselineDemandMw > peak.baselineDemandMw ? interval : peak),
    model.intervals[0],
  );
}
