import { Database } from "lucide-react";
import { useCallback } from "react";
import { useOperationsPresentationStore } from "./hooks/evidence-store";
import type { ComputeWorkspaceContract } from "./compute-workspace-contract";
import { WorkloadDrawer } from "./compute/WorkloadDrawer";
import { ComputeWorkloadQueue } from "./ComputeWorkloadQueue";
import { ComputeOperatingSummary } from "./compute/ComputeOperatingSummary";
import { ComputeTimeline } from "./compute/ComputeTimeline";
import { integer, number } from "./compute/presentation";
import { Row } from "./compute/primitives";
import { formatMw, formatMwh } from "./formatting";
export function ComputeWorkspacePresentation({
  model: workspace,
}: {
  model: ComputeWorkspaceContract;
}) {
  const { capabilities, selectedId, setSelectedId, assessment, peakInterval, selected, model } =
    workspace;
  const [queueOpen, setQueueOpen] = useOperationsPresentationStore().workloadQueueOpen;
  const closeWorkload = useCallback(() => setSelectedId(null), [setSelectedId]);
  return (
    <section className="operations-v2-view operations-compute" aria-labelledby="compute-title">
      <h2 id="compute-title" className="sr-only">
        Compute and Workloads
      </h2>
      <ComputeOperatingSummary workspace={workspace} />
      <ComputeTimeline workspace={workspace} />
      <details
        className="compute-queue-disclosure operations-assurance-panel"
        open={queueOpen}
        onToggle={(event) => setQueueOpen(event.currentTarget.open)}
      >
        <summary>View workloads · {assessment.decisions.length}</summary>
        <ComputeWorkloadQueue model={workspace} />
      </details>
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
      {selected ? <WorkloadDrawer workload={selected} onClose={closeWorkload} /> : null}
    </section>
  );
}
