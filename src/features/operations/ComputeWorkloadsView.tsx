import { useEffect,useMemo,useState } from "react";
import { selectWorkloadQueue } from "./compute/select-workload-queue";
import { useOperationsEvidenceStore } from "./hooks/evidence-store";
import { useWorkloadEvidence } from "./hooks/use-workload-evidence";

import { AlertTriangle,Clock3,Database,PlugZap,ShieldCheck,TrendingDown } from "lucide-react";

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

import { OperationsEvidenceBadge } from "./components";

import type { OperationsOverviewModel } from "./scenario-engine";


import { useOperationsCapabilities } from "./use-operations-capabilities";

import { formatMinutes } from "./presentation";

import { formatDurationFromIntervals,formatMw,formatMwh } from "./formatting";
import { ChartSummaryMetric,OperationsChartLegend,OperationsChartSummary } from "./visualization";

import { integer,number } from "./compute/presentation";

import { EvidenceImport } from "./compute/EvidenceImport";

import { Metric,Row,Status } from "./compute/primitives";

import { ComputeChartData,ComputeTooltip } from "./compute/ComputeChartData";

import { WorkloadDrawer } from "./compute/WorkloadDrawer";

export function ComputeWorkloadsView({
  model,
  displayModel = model,
}: {
  model: OperationsOverviewModel;
  displayModel?: OperationsOverviewModel;
}) {
  const { data: capabilities } = useOperationsCapabilities();
  const evidenceStore = useOperationsEvidenceStore();
  const [selectedId, setSelectedId] = evidenceStore.workloadSelectedId;
  const {
    workloads,
    telemetry,
    message,
    error,
    assessment,
    restoreScenario,
    importWorkloadFile,
    importTelemetryFile,
  } = useWorkloadEvidence(model, setSelectedId);
  const [status, setStatus] = evidenceStore.workloadStatus;
  const [queuePage, setQueuePage] = evidenceStore.workloadPage;
  const [importOpen, setImportOpen] = evidenceStore.workloadImportsOpen;
  const [interactive, setInteractive] = useState(false);
  const peakInterval = useMemo(
    () =>
      displayModel.intervals.reduce(
        (peak, point) => (point.activeGpuCount > peak.activeGpuCount ? point : peak),
        displayModel.intervals[0],
      ),
    [displayModel],
  );
  const { decisions, selected, orderedDecisions, pageCount, visiblePage, visibleDecisions } =
    useMemo(
      () => selectWorkloadQueue(assessment, status, selectedId, queuePage),
      [assessment, status, selectedId, queuePage],
    );
  const evidence: EvidenceClass =
    assessment.source === "scenario" ? "simulated" : telemetry.length ? "measured" : "reference";

  useEffect(() => setInteractive(true), []);

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
          onScenario={restoreScenario}
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
