import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  FileUp,
  Gauge,
  PlugZap,
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
import { stableOperationsJson } from "@/lib/operations-request";
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
import { formatMinutes, formatOperationsTime } from "./presentation";
import { WorkloadSchedule } from "./WorkloadSchedule";
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

export function ComputeWorkloadsView({
  model,
  displayModel = model,
}: {
  model: OperationsOverviewModel;
  displayModel?: OperationsOverviewModel;
}) {
  const importRevision = useRef(0);
  const modelSignature = stableOperationsJson({
    scenario: model.scenario,
    intervals: model.intervals,
  });
  const previousModelSignature = useRef(modelSignature);
  const { data: capabilities } = useOperationsCapabilities();
  const [workloads, setWorkloads] = useState<ComputeWorkload[]>(() =>
    buildScenarioWorkloads(model),
  );
  const [telemetry, setTelemetry] = useState<GpuTelemetry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"all" | ComputeWorkload["status"]>("all");
  const [queuePage, setQueuePage] = useState(0);
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
      displayModel.intervals.reduce(
        (peak, point) => (point.activeGpuCount > peak.activeGpuCount ? point : peak),
        displayModel.intervals[0],
      ),
    [displayModel],
  );
  const decisions =
    status === "all"
      ? assessment.decisions
      : assessment.decisions.filter((workload) => workload.status === status);
  const selected =
    assessment.decisions.find((workload) => workload.workloadId === selectedId) ?? null;
  const orderedDecisions = [...decisions].sort(
    (a, b) => Number(b.recommended) - Number(a.recommended),
  );
  const pageCount = Math.max(1, Math.ceil(orderedDecisions.length / 50));
  const visiblePage = Math.min(queuePage, pageCount - 1);
  const visibleDecisions = orderedDecisions.slice(visiblePage * 50, (visiblePage + 1) * 50);
  const evidence: EvidenceClass =
    assessment.source === "scenario" ? "simulated" : telemetry.length ? "measured" : "reference";

  useEffect(() => setInteractive(true), []);
  useEffect(() => {
    // A server refresh with identical inputs must not cancel an in-flight import.
    if (previousModelSignature.current === modelSignature) return;
    previousModelSignature.current = modelSignature;
    importRevision.current += 1;
    setBackendAssessment(null);
    setWorkloads((current) =>
      current.every((workload) => workload.source === "scenario")
        ? buildScenarioWorkloads(model)
        : current,
    );
    setMessage(
      "Inputs changed. Workload estimates recalculated; canonical schedule validation is still required.",
    );
  }, [model, modelSignature]);

  async function importWorkloadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const revision = ++importRevision.current;
    try {
      const parsed = parseWorkloadCsv(await file.text());
      const response = await requestOperationsAssessment<WorkloadAssessment>({
        kind: "compute",
        scenario: model.scenario,
        workloads: parsed,
        telemetry,
      });
      if (revision !== importRevision.current) return;
      setWorkloads(parsed);
      setBackendAssessment(response.result);
      setSelectedId(null);
      setError("");
      setMessage(`${parsed.length} scheduler records loaded from ${file.name}.`);
    } catch (reason) {
      if (revision !== importRevision.current) return;
      setError(reason instanceof Error ? reason.message : "The workload file could not be read.");
    } finally {
      event.target.value = "";
    }
  }
  async function importTelemetryFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const revision = ++importRevision.current;
    try {
      const parsed = parseGpuTelemetryCsv(await file.text());
      const response = await requestOperationsAssessment<WorkloadAssessment>({
        kind: "compute",
        scenario: model.scenario,
        workloads,
        telemetry: parsed,
      });
      if (revision !== importRevision.current) return;
      setTelemetry(parsed);
      setBackendAssessment(response.result);
      setError("");
      setMessage(`${parsed.length} GPU telemetry records loaded from ${file.name}.`);
    } catch (reason) {
      if (revision !== importRevision.current) return;
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
              ? `Review ${assessment.recommendedJobs} candidate workload${assessment.recommendedJobs === 1 ? "" : "s"} for shifting`
              : "No workload movement is required"}
          </h3>
          <p>
            {assessment.recommendedJobs
              ? `Required workload reduction: ${number.format(assessment.requiredWorkloadResponseMw)} MW; selected candidate power: ${number.format(assessment.recommendedPowerMw)} MW. Eligibility is not a validated recovery schedule.`
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
          icon={<TrendingDown />}
          label="Required workload reduction"
          value={`${number.format(assessment.requiredWorkloadResponseMw)} MW`}
          evidence={evidence}
          note="Full-horizon requirement after battery response"
        />
        <Metric
          icon={<Clock3 />}
          label="Candidate workloads"
          value={integer.format(assessment.recommendedJobs)}
          evidence={evidence}
          note={`${number.format(assessment.recommendedPowerMw)} MW candidate power · eligibility only`}
        />
        <Metric
          icon={<AlertTriangle />}
          label="Declared deadline flags"
          value={integer.format(assessment.deadlinesAtRisk)}
          evidence={evidence}
          note="Eligibility checks—not a validated recovery schedule"
          tone={assessment.deadlinesAtRisk ? "danger" : undefined}
        />
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
              onChange={(event) => {
                setStatus(event.target.value as typeof status);
                setQueuePage(0);
              }}
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
              {visibleDecisions.map((workload) => (
                <tr
                  key={workload.workloadId}
                  className={`${selectedId === workload.workloadId ? "selected" : ""} ${workload.recommended ? "recommended" : ""}`}
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
                  <td>{formatMinutes(workload.deadlineSlackMinutes)}</td>
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
                        ? "Recommended shift"
                        : workload.eligible
                          ? "Eligible—not selected"
                          : "Protected workload"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!decisions.length ? (
          <p role="status">
            No workloads match this status. Choose another status to review the queue.
          </p>
        ) : null}
        {pageCount > 1 ? (
          <nav className="compute-pagination" aria-label="Workload queue pages">
            <button
              type="button"
              disabled={visiblePage === 0}
              onClick={() => setQueuePage(visiblePage - 1)}
            >
              Previous page
            </button>
            <span>
              Page {visiblePage + 1} of {pageCount} · {decisions.length} workloads
            </span>
            <button
              type="button"
              disabled={visiblePage === pageCount - 1}
              onClick={() => setQueuePage(visiblePage + 1)}
            >
              Next page
            </button>
          </nav>
        ) : null}
      </article>

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
            Selected display window. The response curve is the aggregate battery + workload
            scenario, not the selected candidate job schedule. Eligibility uses the full planning
            horizon.
          </p>
          <OperationsChartSummary>
            <ChartSummaryMetric
              label="Baseline Exposure"
              value={formatDurationFromIntervals(displayModel.summaries[0].violationIntervals)}
              tone="limit"
            />
            <ChartSummaryMetric
              label="Candidate power · full horizon"
              value={formatMw(assessment.recommendedPowerMw)}
              tone="response"
            />
            <ChartSummaryMetric
              label="Candidate energy · full horizon"
              value={formatMwh(assessment.recommendedEnergyMwh)}
            />
            <ChartSummaryMetric
              label="Declared deadline flags"
              value={integer.format(assessment.deadlinesAtRisk)}
              tone={assessment.deadlinesAtRisk ? "limit" : undefined}
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
              {
                label: "Aggregate scenario response",
                detail: "MW · not a job schedule",
                tone: "response",
              },
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
                data={displayModel.intervals}
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
                  name="Aggregate scenario response"
                  stroke="var(--ops-response)"
                  strokeWidth={3}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <ComputeChartData model={displayModel} />
        </article>
        <article className="compute-recommendation">
          <header>
            <ShieldCheck aria-hidden="true" />
            <div>
              <p className="context-label">Recommended Response</p>
              <h3>
                {assessment.recommendedJobs ? "Review the candidate set" : "Hold recommendation"}
              </h3>
            </div>
          </header>
          <p>
            {assessment.recommendedJobs
              ? `Candidate selection provides ${number.format(assessment.recommendedPowerMw)} MW against a ${number.format(assessment.requiredWorkloadResponseMw)} MW requirement. Whole jobs may exceed the required reduction. Validate start times, recovery and deadlines before accepting this option.`
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
            <Row
              label="Declared deadline flags"
              value={integer.format(assessment.deadlinesAtRisk)}
            />
          </dl>
          <div className="operations-v2-readonly">
            <ShieldCheck aria-hidden="true" />
            <span>
              Read-only analysis. GridPulse does not reschedule jobs or change GPU power limits.
            </span>
          </div>
        </article>
      </div>

      <details className="operations-assurance-panel">
        <summary>Compute inventory & flexibility</summary>
        <dl className="compute-inventory">
          <Row
            label="Active GPUs · selected window peak"
            value={integer.format(peakInterval.activeGpuCount)}
          />
          <Row
            label="Compute power · selected window peak"
            value={formatMw(peakInterval.gpuPowerMw)}
          />
          <Row label="Flexible power · full horizon" value={formatMw(assessment.flexiblePowerMw)} />
          <Row
            label="Flexible energy · full horizon"
            value={formatMwh(assessment.flexibleEnergyMwh)}
          />
          <Row
            label="Telemetry completeness"
            value={`${number.format(assessment.telemetryCompletenessPercent)}%`}
          />
          <Row
            label="Aggregate unrecovered work · full horizon"
            value={formatMwh(
              model.summaries.find((summary) => summary.kind === "battery_workload")
                ?.unresolvedWorkMwh ?? 0,
            )}
          />
        </dl>
      </details>
      <details className="operations-assurance-panel">
        <summary>Evidence & connector readiness</summary>
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
      </details>
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
      <p className="power-flow-note">
        Files are parsed locally; parsed records are sent to the GridPulse assessment service.
        Imported jobs do not turn the simulated facility timeline into live data.
      </p>
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
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("keydown", dismiss);
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);
  return (
    <aside className="compute-drawer" aria-label={`Workload details: ${workload.name}`}>
      <header>
        <div>
          <p className="context-label">Selected Workload</p>
          <h3>{workload.name}</h3>
          <span>{workload.workloadId}</span>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close workload details">
          <X aria-hidden="true" />
        </button>
      </header>
      <OperationsEvidenceBadge kind={workload.source === "scenario" ? "simulated" : "measured"} />
      <WorkloadSchedule workload={workload} />
      <dl>
        <Row label="Class" value={workload.workloadClass} />
        <Row label="Status" value={workload.status} />
        <Row label="Requested GPUs" value={integer.format(workload.requestedGpuCount)} />
        <Row label="Power contribution" value={`${number.format(workload.estimatedPowerMw)} MW`} />
        <Row label="Checkpointable" value={workload.checkpointable ? "Yes" : "No"} />
        <Row label="Preemptible" value={workload.preemptible ? "Yes" : "No"} />
        <Row label="Deadline slack" value={formatMinutes(workload.deadlineSlackMinutes)} />
        <Row
          label="Proposed start"
          value={formatOperationsTime(
            workload.recommended ? workload.proposedStart : workload.earliestStart,
            true,
          )}
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
