import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  FileUp,
  Gauge,
  PlugZap,
  Server,
  ShieldCheck,
  TrendingDown,
  X,
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
import type { EvidenceClass } from "./evidence";
import { OperationsEvidenceBadge, OperationsMetricCard } from "./components";
import { requestOperationsAssessment } from "@/lib/operations-api";
import type { OperationsOverviewModel } from "./scenario-engine";
import {
  assessWorkloads,
  buildScenarioWorkloads,
  parseGpuTelemetryCsv,
  parseWorkloadCsv,
  type ComputeWorkload,
  type GpuTelemetry,
  type WorkloadDecision,
  type WorkloadAssessment,
} from "./workload-intelligence";
import { useOperationsCapabilities } from "./use-operations-capabilities";
import {
  ChartSummaryMetric,
  OperationsChartLegend,
  OperationsChartSummary,
  OperationsTooltipShell,
  TooltipRow,
  formatDurationFromIntervals,
  formatMw,
  formatMwh,
} from "./visualization";

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export function ComputeWorkloadsView({ model }: { model: OperationsOverviewModel }) {
  const { data: capabilities } = useOperationsCapabilities();
  const [workloads, setWorkloads] = useState<ComputeWorkload[]>(() =>
    buildScenarioWorkloads(model),
  );
  const [telemetry, setTelemetry] = useState<GpuTelemetry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"all" | ComputeWorkload["status"]>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [message, setMessage] = useState(
    "Scenario workload set loaded. No customer telemetry is connected.",
  );
  const [error, setError] = useState("");
  const [backendAssessment, setBackendAssessment] = useState<WorkloadAssessment | null>(null);
  const localAssessment = useMemo(
    () => assessWorkloads(workloads, telemetry, model),
    [workloads, telemetry, model],
  );
  const assessment = backendAssessment ?? localAssessment;
  const peakInterval = useMemo(
    () =>
      model.intervals.reduce(
        (peak, point) => (point.activeGpuCount > peak.activeGpuCount ? point : peak),
        model.intervals[0],
      ),
    [model],
  );
  const decisions =
    status === "all"
      ? assessment.decisions
      : assessment.decisions.filter((workload) => workload.status === status);
  const selected =
    assessment.decisions.find((workload) => workload.workloadId === selectedId) ?? null;
  const evidence: EvidenceClass =
    assessment.source === "scenario" ? "simulated" : telemetry.length ? "measured" : "reference";

  useEffect(() => setInteractive(true), []);

  async function importWorkloadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseWorkloadCsv(await file.text());
      const response = await requestOperationsAssessment<WorkloadAssessment>({
        kind: "compute",
        scenario: model.scenario,
        workloads: parsed,
        telemetry,
      });
      setWorkloads(parsed);
      setBackendAssessment(response.result);
      setSelectedId(null);
      setError("");
      setMessage(`${parsed.length} scheduler records loaded from ${file.name}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The workload file could not be read.");
    } finally {
      event.target.value = "";
    }
  }
  async function importTelemetryFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseGpuTelemetryCsv(await file.text());
      const response = await requestOperationsAssessment<WorkloadAssessment>({
        kind: "compute",
        scenario: model.scenario,
        workloads,
        telemetry: parsed,
      });
      setTelemetry(parsed);
      setBackendAssessment(response.result);
      setError("");
      setMessage(`${parsed.length} GPU telemetry records loaded from ${file.name}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The telemetry file could not be read.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <section className="operations-v2-view operations-compute" aria-labelledby="compute-title">
      <h2 id="compute-title" className="sr-only">
        Compute and Workloads
      </h2>
      <div className="compute-decision-bar">
        <div>
          <p className="context-label">Power-Aware Workload Decision</p>
          <h3>
            {assessment.recommendedJobs
              ? `Move ${assessment.recommendedJobs} workload${assessment.recommendedJobs === 1 ? "" : "s"} to stay inside the facility limit`
              : "No workload movement is required"}
          </h3>
          <p>
            {assessment.recommendedJobs
              ? `The minimum recommended response is ${number.format(assessment.recommendedPowerMw)} MW. ${assessment.eligibleJobs} workloads pass all declared safety gates.`
              : "The assessed profile remains inside the configured safe operating target."}
          </p>
        </div>
        <div className="compute-decision-actions">
          <OperationsEvidenceBadge kind={evidence} />
          <button
            type="button"
            className="secondary-button"
            onClick={() => setImportOpen((value) => !value)}
            aria-expanded={importOpen}
            disabled={!interactive}
          >
            <PlugZap aria-hidden="true" />
            Connect Evidence
          </button>
        </div>
      </div>

      {importOpen ? (
        <EvidenceImport
          onWorkloads={importWorkloadFile}
          onTelemetry={importTelemetryFile}
          message={message}
          error={error}
          onScenario={() => {
            setWorkloads(buildScenarioWorkloads(model));
            setTelemetry([]);
            setError("");
            setMessage("Scenario workload set restored.");
          }}
        />
      ) : null}

      <div className="operations-v2-kpis operations-v2-kpis--compute">
        <Metric
          icon={<Cpu />}
          label="Active GPUs"
          value={integer.format(peakInterval.activeGpuCount)}
          evidence="simulated"
          note={`Peak at ${peakInterval.label}`}
        />
        <Metric
          icon={<Server />}
          label="Compute Power"
          value={`${number.format(peakInterval.gpuPowerMw)} MW`}
          evidence={telemetry.length ? "measured" : "simulated"}
          note={
            telemetry.length
              ? `${number.format(assessment.telemetryCompletenessPercent)}% telemetry completeness`
              : `${number.format(peakInterval.utilizationPercent)}% GPU utilization`
          }
        />
        <Metric
          icon={<TrendingDown />}
          label="Flexible Compute"
          value={`${number.format(assessment.flexiblePowerMw)} MW`}
          evidence={evidence}
          note={`${number.format(assessment.flexibleEnergyMwh)} MWh shift window`}
        />
        <Metric
          icon={<Clock3 />}
          label="Recommended Moves"
          value={integer.format(assessment.recommendedJobs)}
          evidence={evidence}
          note={`${assessment.eligibleJobs} workloads pass eligibility gates`}
        />
        <Metric
          icon={<AlertTriangle />}
          label="Deadlines at Risk"
          value={integer.format(assessment.deadlinesAtRisk)}
          evidence={evidence}
          note="After the recommended response"
          tone={assessment.deadlinesAtRisk ? "danger" : undefined}
        />
      </div>

      <div className="compute-primary-grid">
        <article className="operations-v2-chart-card">
          <header className="operations-v2-chart-header">
            <div>
              <p className="context-label">Coordinated Timeline</p>
              <h3>Compute Demand and Facility Limit</h3>
            </div>
            <OperationsEvidenceBadge kind="simulated" />
          </header>
          <p className="operations-chart-purpose">
            Whole-facility demand is compared with the response profile. GPU power is shown as a
            component, not a separate facility total.
          </p>
          <OperationsChartSummary>
            <ChartSummaryMetric
              label="Baseline Exposure"
              value={formatDurationFromIntervals(model.summaries[0].violationIntervals)}
              tone="limit"
            />
            <ChartSummaryMetric
              label="Recommended Response"
              value={formatMw(assessment.recommendedPowerMw)}
              tone="response"
            />
            <ChartSummaryMetric
              label="Shiftable Energy"
              value={formatMwh(assessment.recommendedEnergyMwh)}
            />
            <ChartSummaryMetric
              label="Deadlines at Risk"
              value={integer.format(assessment.deadlinesAtRisk)}
              tone={assessment.deadlinesAtRisk ? "limit" : "positive"}
            />
          </OperationsChartSummary>
          <OperationsChartLegend
            items={[
              {
                label: "Facility demand",
                detail: "MW · before response",
                tone: "demand",
                mark: "area",
              },
              { label: "After response", detail: "MW · recommended profile", tone: "response" },
              { label: "GPU power", detail: "MW · component of facility demand", tone: "compute" },
              {
                label: "Safety target",
                detail: `${formatMw(model.scenario.importLimitMw - model.scenario.safetyReserveMw)} · assumption`,
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
            className="operations-v2-chart compute-timeline"
            role="img"
            aria-label="GPU power and facility demand compared with the operating limit"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={model.intervals}
                margin={{ top: 12, right: 18, left: 4, bottom: 4 }}
                accessibilityLayer
              >
                <CartesianGrid stroke="var(--ops-chart-grid)" vertical={false} />
                <XAxis dataKey="label" minTickGap={36} tickLine={false} axisLine={false} />
                <YAxis unit=" MW" tickLine={false} axisLine={false} />
                <Tooltip content={<ComputeTooltip />} />
                <ReferenceLine
                  y={model.scenario.importLimitMw}
                  stroke="var(--ops-limit)"
                  strokeDasharray="7 5"
                  label={{
                    value: `${number.format(model.scenario.importLimitMw)} MW limit`,
                    fill: "var(--ops-limit)",
                    position: "insideBottomLeft",
                  }}
                />
                <ReferenceLine
                  y={model.scenario.importLimitMw - model.scenario.safetyReserveMw}
                  stroke="var(--ops-target)"
                  strokeDasharray="3 5"
                  label={{
                    value: `${number.format(model.scenario.importLimitMw - model.scenario.safetyReserveMw)} MW target`,
                    fill: "var(--ops-target)",
                    position: "insideTopRight",
                  }}
                />
                <Area
                  dataKey="baselineDemandMw"
                  name="Facility demand"
                  stroke="var(--ops-demand)"
                  fill="var(--ops-demand-fill)"
                  strokeWidth={2}
                />
                <Line
                  dataKey="gpuPowerMw"
                  name="GPU power"
                  stroke="var(--ops-compute)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                />
                <Line
                  dataKey="combinedDemandMw"
                  name="After response"
                  stroke="var(--ops-response)"
                  strokeWidth={3}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <ComputeChartData model={model} />
        </article>
        <article className="compute-recommendation">
          <header>
            <ShieldCheck aria-hidden="true" />
            <div>
              <p className="context-label">Recommended Response</p>
              <h3>
                {assessment.recommendedJobs
                  ? "Move the minimum eligible set"
                  : "Hold recommendation"}
              </h3>
            </div>
          </header>
          <p>
            {assessment.recommendedJobs
              ? `Delay the lowest-priority eligible workload set inside its declared windows. This meets the ${number.format(assessment.requiredWorkloadResponseMw)} MW response target without moving every flexible job.`
              : "No workload movement is needed for the current facility scenario."}
          </p>
          <dl>
            <Row label="Recommended workloads" value={integer.format(assessment.recommendedJobs)} />
            <Row
              label="Peak response"
              value={`${number.format(assessment.recommendedPowerMw)} MW`}
            />
            <Row
              label="Shiftable energy"
              value={`${number.format(assessment.recommendedEnergyMwh)} MWh`}
            />
            <Row label="Deadline violations" value={integer.format(assessment.deadlinesAtRisk)} />
          </dl>
          <div className="operations-v2-readonly">
            <ShieldCheck aria-hidden="true" />
            <span>
              Read-only analysis. GridPulse does not reschedule jobs or change GPU power limits.
            </span>
          </div>
        </article>
      </div>

      <article className="compute-queue-card">
        <header>
          <div>
            <p className="context-label">Workload Queue</p>
            <h3>Jobs, Constraints and Recommended Action</h3>
          </div>
          <label>
            Show{" "}
            <select
              value={status}
              disabled={!interactive}
              onChange={(event) => setStatus(event.target.value as typeof status)}
            >
              <option value="all">All statuses</option>
              <option value="running">Running</option>
              <option value="queued">Queued</option>
              <option value="held">Held</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </header>
        <div className="compute-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Workload</th>
                <th scope="col">Class</th>
                <th scope="col">Status</th>
                <th scope="col">GPUs</th>
                <th scope="col">Power</th>
                <th scope="col">Deadline slack</th>
                <th scope="col">Decision</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((workload) => (
                <tr
                  key={workload.workloadId}
                  className={selectedId === workload.workloadId ? "selected" : ""}
                >
                  <th scope="row">
                    <button
                      type="button"
                      disabled={!interactive}
                      onClick={() => setSelectedId(workload.workloadId)}
                    >
                      {workload.name}
                      <small>{workload.workloadId}</small>
                    </button>
                  </th>
                  <td>{workload.workloadClass}</td>
                  <td>
                    <Status value={workload.status} />
                  </td>
                  <td>{integer.format(workload.requestedGpuCount)}</td>
                  <td>
                    {number.format(workload.estimatedPowerMw)} MW{" "}
                    <small>{workload.powerEvidence}</small>
                  </td>
                  <td>{integer.format(workload.deadlineSlackMinutes)} min</td>
                  <td>
                    <span
                      className={
                        workload.recommended
                          ? "decision-recommended"
                          : workload.eligible
                            ? "decision-eligible"
                            : "decision-protected"
                      }
                    >
                      {workload.recommended
                        ? "Move in scenario"
                        : workload.eligible
                          ? "Eligible reserve"
                          : "Protect"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <section className="compute-connectors" aria-labelledby="compute-connectors-title">
        <header>
          <div>
            <p className="context-label">Live Integrations</p>
            <h3 id="compute-connectors-title">Connector Readiness</h3>
          </div>
          <small>Credentials required for live customer data</small>
        </header>
        <div>
          {(
            capabilities?.connectors.filter((connector) =>
              ["nvidia_dcgm", "kueue", "slurm"].includes(connector.id),
            ) ?? []
          ).map((connector) => (
            <article key={connector.id}>
              <Database aria-hidden="true" />
              <div>
                <strong>{connector.label}</strong>
                <span>{connector.evidence.join(" · ")}</span>
              </div>
              <em>{connector.status.replaceAll("_", " ")}</em>
            </article>
          ))}
          {!capabilities ? <p>Checking connector backend…</p> : null}
        </div>
      </section>
      {selected ? <WorkloadDrawer workload={selected} onClose={() => setSelectedId(null)} /> : null}
    </section>
  );
}

function ComputeTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
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
          tone={
            item.name === "GPU power"
              ? "compute"
              : item.name === "After response"
                ? "response"
                : "demand"
          }
          detail="Simulated"
        />
      ))}
    </OperationsTooltipShell>
  );
}

function ComputeChartData({ model }: { model: OperationsOverviewModel }) {
  return (
    <details className="operations-v2-chart-data">
      <summary>View Full Chart Data</summary>
      <div>
        <table>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Facility Demand (MW)</th>
              <th scope="col">After Response (MW)</th>
              <th scope="col">GPU Power (MW)</th>
            </tr>
          </thead>
          <tbody>
            {model.intervals.map((point) => (
              <tr key={point.timestamp}>
                <th scope="row">{point.label}</th>
                <td>{number.format(point.baselineDemandMw)}</td>
                <td>{number.format(point.combinedDemandMw)}</td>
                <td>{number.format(point.gpuPowerMw)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function EvidenceImport({
  onWorkloads,
  onTelemetry,
  onScenario,
  message,
  error,
}: {
  onWorkloads: (event: ChangeEvent<HTMLInputElement>) => void;
  onTelemetry: (event: ChangeEvent<HTMLInputElement>) => void;
  onScenario: () => void;
  message: string;
  error: string;
}) {
  return (
    <section className="compute-import" aria-labelledby="compute-import-title">
      <header>
        <div>
          <p className="context-label">Real Exported Evidence</p>
          <h3 id="compute-import-title">Load Scheduler and GPU Records</h3>
        </div>
        <OperationsEvidenceBadge kind="measured" label="Browser processed" />
      </header>
      <div className="compute-import-grid">
        <label>
          <FileUp aria-hidden="true" />
          <strong>Workload CSV</strong>
          <span>Jobs, GPU requests, deadlines and policies</span>
          <input type="file" accept=".csv,text/csv" onChange={onWorkloads} />
        </label>
        <label>
          <FileUp aria-hidden="true" />
          <strong>GPU telemetry CSV</strong>
          <span>DCGM-compatible power and utilisation fields</span>
          <input type="file" accept=".csv,text/csv" onChange={onTelemetry} />
        </label>
        <button type="button" className="secondary-button" onClick={onScenario}>
          Restore Scenario
        </button>
      </div>
      <p
        className={error ? "compute-import-error" : "compute-import-status"}
        role={error ? "alert" : "status"}
      >
        {error || message}
      </p>
    </section>
  );
}

function WorkloadDrawer({
  workload,
  onClose,
}: {
  workload: WorkloadDecision;
  onClose: () => void;
}) {
  return (
    <aside className="compute-drawer" aria-label={`Workload details: ${workload.name}`}>
      <header>
        <div>
          <p className="context-label">Selected Workload</p>
          <h3>{workload.name}</h3>
          <span>{workload.workloadId}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close workload details">
          <X aria-hidden="true" />
        </button>
      </header>
      <OperationsEvidenceBadge kind={workload.source === "scenario" ? "simulated" : "measured"} />
      <dl>
        <Row label="Class" value={workload.workloadClass} />
        <Row label="Status" value={workload.status} />
        <Row label="Requested GPUs" value={integer.format(workload.requestedGpuCount)} />
        <Row label="Power contribution" value={`${number.format(workload.estimatedPowerMw)} MW`} />
        <Row label="Checkpointable" value={workload.checkpointable ? "Yes" : "No"} />
        <Row label="Preemptible" value={workload.preemptible ? "Yes" : "No"} />
        <Row
          label="Deadline slack"
          value={`${integer.format(workload.deadlineSlackMinutes)} min`}
        />
        <Row
          label="Proposed start"
          value={new Date(workload.proposedStart).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        />
      </dl>
      <div
        className={workload.eligible ? "compute-decision-note eligible" : "compute-decision-note"}
      >
        {workload.eligible ? (
          <CheckCircle2 aria-hidden="true" />
        ) : (
          <AlertTriangle aria-hidden="true" />
        )}
        <p>
          <strong>{workload.eligible ? "Eligible for scenario" : "Protected from movement"}</strong>
          <span>{workload.reason}</span>
        </p>
      </div>
    </aside>
  );
}

function Metric({
  icon,
  label,
  value,
  evidence,
  note,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  evidence: EvidenceClass;
  note: string;
  tone?: "warning" | "danger";
}) {
  return (
    <OperationsMetricCard
      icon={icon}
      label={label}
      value={value}
      evidence={evidence}
      note={note}
      tone={tone}
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
function Status({ value }: { value: ComputeWorkload["status"] }) {
  return <span className={`compute-status ${value}`}>{value}</span>;
}
