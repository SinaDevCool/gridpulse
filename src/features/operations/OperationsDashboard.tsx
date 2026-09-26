import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
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
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { type EvidencedValue } from "./evidence";
import { OperationsEvidenceBadge, OperationsMetricCard } from "./components";
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
import {
  ChartSummaryMetric,
  OperationsChartLegend,
  OperationsChartSummary,
  OperationsTooltipShell,
  TooltipRow,
  formatDurationFromIntervals,
  formatMw,
} from "./visualization";
import {
  derivePrimaryAlert,
  operatingWindowLabels,
  operationalPue,
  operationsModeLabels,
  scopeOperationsModel,
  type OperatingWindowPreset,
  type OperationsDataMode,
} from "./operating-context";

export type OperationsView = "overview" | "compute" | "power";

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export function OperationsDashboard({
  view,
  window,
  mode,
}: {
  view: OperationsView;
  window: OperatingWindowPreset;
  mode: OperationsDataMode;
}) {
  const navigate = useNavigate({ from: "/operations" });
  const [scenario, setScenario] = useState(defaultOperationsScenario);
  const [selected, setSelected] = useState<OperationsScenarioKind>("battery_workload");
  const [announcement, setAnnouncement] = useState("Default scenario loaded.");
  const [serverModel, setServerModel] = useState<OperationsOverviewModel | null>(null);
  const [backendState, setBackendState] = useState<"checking" | "verified" | "unavailable">(
    "checking",
  );
  const fullModel = serverModel ?? buildOperationsScenario(scenario);
  const model = scopeOperationsModel(fullModel, window);
  const viewCopy =
    view === "power"
      ? {
          eyebrow: "Data-Centre Power Operations",
          title: "Power & Battery",
          description: "Optimise facility power with battery storage and workload flexibility.",
          evidence:
            "Facility and battery values are scenario assumptions until measured evidence is connected.",
        }
      : view === "compute"
        ? {
            eyebrow: "Data-Centre Power Operations",
            title: "Power Operations",
            description: "Translate facility limits into compute and workload decisions.",
            evidence:
              "GPU workload behaviour uses the configured scenario until accepted telemetry is connected.",
          }
        : {
            eyebrow: "Data-Centre Power Operations",
            title: "Power Operations",
            description: "Translate facility limits into compute, battery, and workload decisions.",
            evidence:
              "Results use configured assumptions until measured facility evidence is connected.",
          };

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
    <main id="main-content" className={`operations-v2 operations-v2--${view}`}>
      <header className="operations-v2-header">
        <div>
          <p className="context-label">{viewCopy.eyebrow}</p>
          <h1>{viewCopy.title}</h1>
          <p>{viewCopy.description}</p>
        </div>
        <div className="operations-v2-context">
          <OperationsEvidenceBadge kind="simulated" label="Scenario Simulation" />
          <span className="operations-v2-facility">
            <Database aria-hidden="true" />
            {scenario.facilityName}
          </span>
          <span className={`operations-v2-backend ${backendState}`} role="status">
            <i aria-hidden="true" />
            {backendState === "verified"
              ? "Assessment service online"
              : backendState === "checking"
                ? "Checking assessment service…"
                : "Using browser fallback"}
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
          <OperationsTab
            id="overview"
            label="Overview"
            current={view}
            window={window}
            mode={mode}
          />
          <OperationsTab
            id="compute"
            label="Compute & Workloads"
            current={view}
            window={window}
            mode={mode}
          />
          <OperationsTab
            id="power"
            label="Power & Battery"
            current={view}
            window={window}
            mode={mode}
          />
        </nav>
        <p className="operations-v2-provenance">
          <Info aria-hidden="true" />
          <span>
            <strong>Scenario workspace</strong> {viewCopy.evidence} No control commands are issued.
          </span>
        </p>
      </div>

      <section className="operations-context-strip" aria-label="Operating context">
        <div className="operations-context-field">
          <span>Facility</span>
          <strong>{scenario.facilityName}</strong>
        </div>
        <label className="operations-context-field">
          <span>Operating Window</span>
          <select
            name="operating-window"
            value={window}
            onChange={(event) =>
              navigate({
                search: { view, window: event.target.value as OperatingWindowPreset, mode },
                replace: true,
              })
            }
          >
            {Object.entries(operatingWindowLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="operations-context-field">
          <span>Data Mode</span>
          <select
            name="data-mode"
            value={mode}
            onChange={(event) =>
              navigate({
                search: { view, window, mode: event.target.value as OperationsDataMode },
                replace: true,
              })
            }
          >
            {Object.entries(operationsModeLabels).map(([value, label]) => (
              <option value={value} key={value} disabled={value !== "scenario"}>
                {label}
                {value !== "scenario" ? " · Connect Evidence" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="operations-context-health" role="status">
          <i className={backendState} aria-hidden="true" />
          <span>
            <strong>
              {backendState === "verified" ? "Assessment Current" : "Local Assessment"}
            </strong>
            {operationsModeLabels[mode]} · {model.intervals.length} intervals
          </span>
        </div>
      </section>

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
  window,
  mode,
}: {
  id: OperationsView;
  label: string;
  current: OperationsView;
  window: OperatingWindowPreset;
  mode: OperationsDataMode;
}) {
  return (
    <Link
      to="/operations"
      search={{ view: id, window, mode }}
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
  const alert = derivePrimaryAlert(model);
  const pue = operationalPue(model);
  return (
    <section className="operations-v2-view" aria-labelledby="operations-overview-title">
      <h2 id="operations-overview-title" className="sr-only">
        Operations Overview
      </h2>
      <article className={`operations-primary-alert ${alert.state}`}>
        <span className="operations-primary-alert-icon" aria-hidden="true">
          {alert.state === "normal" ? <ShieldCheck /> : <AlertTriangle />}
        </span>
        <div>
          <p className="context-label">Operating Window Status · {alert.interval}</p>
          <h3>{alert.title}</h3>
          <p>{alert.detail}</p>
        </div>
        <strong>{alert.remainingRisk}</strong>
      </article>
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
          label="Headroom After Reserve"
          metric={model.metrics.remainingMargin}
          note="After safety reserve"
        />
        <MetricCard
          icon={<Cpu />}
          label="Response Available"
          metric={{
            value:
              model.recommendation.batteryMw +
              Math.max(0, ...model.intervals.map((point) => point.workloadShiftMw)),
            unit: "MW",
            evidenceClass: "simulated",
            sourceLabel: "Battery and eligible workload response",
            quality: "accepted",
          }}
          note="Battery plus eligible workload"
        />
        <MetricCard
          icon={<AlertTriangle />}
          label="Limit Risk"
          metric={model.metrics.limitRisk}
          note={
            model.metrics.limitRisk.value === "Low"
              ? "Baseline remains below the facility limit"
              : model.metrics.limitRisk.value === "Moderate"
                ? "Response resolves the baseline exceedance"
                : "Response still exceeds the facility limit"
          }
          tone={model.metrics.limitRisk.value === "High" ? "danger" : "warning"}
        />
      </div>

      <div className="operations-efficiency-guardrail">
        <div>
          <span>Operating PUE</span>
          <strong>{number.format(pue.value)}</strong>
          <OperationsEvidenceBadge kind={pue.evidence} label={pue.status} />
        </div>
        <p>{pue.detail}</p>
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
  const baseline = model.summaries[0];
  const selectedSummary =
    model.summaries.find((summary) => summary.kind === selected) ?? model.summaries[2];
  const selectedName =
    selected === "baseline"
      ? "Baseline"
      : selected === "battery"
        ? "Battery response"
        : "Battery + workload";
  const targetMw = model.scenario.importLimitMw - model.scenario.safetyReserveMw;
  const chartData = model.intervals.map((point, index) => {
    const uncertainty = Math.max(0.8, point.baselineDemandMw * (0.018 + index * 0.00008));
    return {
      ...point,
      forecastBand: [
        Number(Math.max(0, point.baselineDemandMw - uncertainty).toFixed(2)),
        Number((point.baselineDemandMw + uncertainty).toFixed(2)),
      ],
    };
  });
  return (
    <article className={`operations-v2-chart-card${compact ? " compact" : ""}`}>
      <ChartHeader
        eyebrow="24-Hour Scenario"
        title="Facility Demand vs Operating Target"
        badge="Simulated"
      />
      <p className="operations-chart-purpose">
        Baseline compared with <strong>{selectedName}</strong>. The safety target preserves the
        configured reserve below the facility limit.
      </p>
      <OperationsChartSummary>
        <ChartSummaryMetric label="Baseline Peak" value={formatMw(baseline.peakDemandMw)} />
        <ChartSummaryMetric
          label="Response Peak"
          value={formatMw(selectedSummary.peakDemandMw)}
          tone="response"
        />
        <ChartSummaryMetric
          label="Peak Reduction"
          value={formatMw(Math.max(0, baseline.peakDemandMw - selectedSummary.peakDemandMw))}
          tone="positive"
        />
        <ChartSummaryMetric
          label="Limit Exposure"
          value={`${formatDurationFromIntervals(baseline.violationIntervals)} → ${formatDurationFromIntervals(selectedSummary.violationIntervals)}`}
          tone={selectedSummary.violationIntervals ? "limit" : "positive"}
        />
      </OperationsChartSummary>
      <OperationsChartLegend
        items={[
          {
            label: "Baseline demand",
            detail: "MW · before response",
            tone: "demand",
            mark: "area",
          },
          {
            label: "Planning range",
            detail: "MW · scenario uncertainty",
            tone: "neutral",
            mark: "area",
          },
          ...(selected !== "baseline"
            ? [{ label: selectedName, detail: "MW · selected response", tone: "response" as const }]
            : []),
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
      <div
        className="operations-v2-chart"
        role="img"
        aria-label="Facility demand scenarios compared with the configured operating limit"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: 18, left: 4, bottom: 4 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
            <XAxis dataKey="label" minTickGap={36} tickLine={false} axisLine={false} />
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
            <ReferenceLine
              y={model.scenario.importLimitMw}
              stroke="var(--ops-limit)"
              strokeDasharray="7 5"
              label={{
                value: `${model.scenario.importLimitMw} MW limit`,
                fill: "var(--ops-limit)",
                position: "insideBottomLeft",
              }}
            />
            <Area
              dataKey="forecastBand"
              name="Planning range"
              stroke="none"
              fill="var(--ops-forecast-fill)"
              fillOpacity={0.55}
              isAnimationActive={false}
            />
            <Area
              dataKey="baselineDemandMw"
              name="Baseline Demand"
              stroke="var(--ops-demand)"
              fill="var(--ops-demand-fill)"
              strokeWidth={2}
            />
            {selected !== "baseline" ? (
              <Line
                dataKey={selectedKey}
                name={selected === "battery" ? "Battery Response" : "Battery + Workload"}
                stroke="var(--ops-response)"
                strokeWidth={3}
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
                <dd>{integer.format(summary.additionalGpuHours)} h</dd>
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
            <OperationsEvidenceBadge kind="user_assumption" />
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
    <OperationsMetricCard
      icon={icon}
      label={label}
      evidence={metric.evidenceClass}
      tone={tone}
      value={
        <>
          {value}
          {metric.value != null && metric.unit ? <small>&nbsp;{metric.unit}</small> : null}
          {label === "Additional GPUs Supportable" && metric.value != null ? (
            <small>&nbsp;GPU{Number(metric.value) === 1 ? "" : "s"}</small>
          ) : null}
        </>
      }
      note={note}
    />
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
    <OperationsTooltipShell label={label}>
      {payload.map((item) => (
        <TooltipRow
          key={item.name}
          label={item.name ?? "Series"}
          value={formatMw(item.value ?? 0)}
          tone={item.name === "Baseline Demand" ? "demand" : "response"}
          detail="Simulated"
        />
      ))}
    </OperationsTooltipShell>
  );
}

function AccessibleIntervalTable({
  model,
  mode,
}: {
  model: OperationsOverviewModel;
  mode: "power" | "compute";
}) {
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
                  <th scope="col">Baseline (MW)</th>
                  <th scope="col">Battery Response (MW)</th>
                  <th scope="col">Combined Response (MW)</th>
                </>
              ) : (
                <>
                  <th scope="col">Active GPUs</th>
                  <th scope="col">Utilisation (%)</th>
                  <th scope="col">GPU Power (MW)</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {model.intervals.map((point) => (
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
