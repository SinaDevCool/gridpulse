import { useState } from "react";
import type { ComputeWorkspaceContract } from "../compute-workspace-contract";
import { ComputeChartData } from "./ComputeChartData";
import { OperationsChartLegend, useChartVisibility } from "../visualization";
import { useInspection } from "../hooks/use-inspection";
import { OperationsEvidenceBadge } from "../components";
import { formatOperationsTime } from "../presentation";
import { formatMw } from "../formatting";
import { WorkloadWindowLanes } from "./WorkloadWindowLanes";
import { selectComputeTimeline, workloadTimeRelationship } from "./select-compute-timeline";
import { ComputeTimelinePlot } from "./ComputeTimelinePlot";
import { IntervalNavigation } from "../inspection";

export function ComputeTimeline({ workspace }: { workspace: ComputeWorkspaceContract }) {
  const { displayModel, model, assessment, selectedId, setSelectedId } = workspace;
  const visibility = useChartVisibility(["GPU power", "Aggregate scenario response"]);
  const [showEligible, setShowEligible] = useState(false);
  const [facilityContext, setFacilityContext] = useState(false);
  const points = displayModel.intervals;
  const target = model.scenario.importLimitMw - model.scenario.safetyReserveMw;
  const data = selectComputeTimeline(points, target);
  const inspection = useInspection(points);
  const currentIndex = Math.max(
    0,
    points.findIndex((point) => point.timestamp === inspection.timestamp),
  );
  const current = data[currentIndex];
  const pool = assessment.decisions.filter(
    (job) => job.recommended || (showEligible && job.eligible),
  );
  const jobs = pool.slice(0, 5);
  const inspected = assessment.decisions.find((job) => job.workloadId === selectedId);
  if (inspected && !jobs.some((job) => job.workloadId === inspected.workloadId))
    jobs.push(inspected);
  if (!current) return <p role="status">No intervals available for workload inspection.</p>;
  const from = data[0].time,
    to = data.at(-1)!.end;
  return (
    <article className="operations-v2-chart-card compute-integrated-workspace">
      <header className="operations-v2-chart-header">
        <div>
          <p className="context-label">Power & workload workspace</p>
          <h3>When is workload flexibility needed?</h3>
        </div>
        <OperationsEvidenceBadge kind="simulated" />
      </header>
      <p className="operations-chart-purpose">
        Required reduction after battery response, aligned with candidate timing. Windows are
        reference estimates—not jointly validated schedules or delivered response.
      </p>
      <div className="compute-view-controls" aria-label="Timeline view">
        <button
          type="button"
          aria-pressed={!facilityContext}
          onClick={() => setFacilityContext(false)}
        >
          Workload reduction
        </button>
        <button
          type="button"
          aria-pressed={facilityContext}
          onClick={() => setFacilityContext(true)}
        >
          Facility context
        </button>
      </div>
      <OperationsChartLegend
        visibility={visibility}
        label="Compute chart legend"
        items={
          facilityContext
            ? [
                {
                  label: "Facility demand",
                  detail: "MW · before response",
                  tone: "demand",
                  mark: "area",
                },
                {
                  label: "Safety target",
                  detail: `${formatMw(target)} · assumption`,
                  tone: "target",
                  mark: "dash",
                },
                {
                  label: "Facility limit",
                  detail: `${formatMw(model.scenario.importLimitMw)} · assumption`,
                  tone: "limit",
                  mark: "dash",
                },
                {
                  label: "GPU power",
                  detail: "MW · component of facility demand",
                  tone: "compute",
                },
                {
                  label: "Aggregate scenario response",
                  detail: "MW · not a job schedule",
                  tone: "response",
                },
              ]
            : [
                {
                  label: "Required after battery",
                  detail: "MW · remaining reduction to safety target",
                  tone: "response",
                  mark: "area",
                },
              ]
        }
      />
      <ComputeTimelinePlot
        previewing={inspection.previewing}
        data={data}
        from={from}
        to={to}
        timestamp={current.time}
        facilityContext={facilityContext}
        target={target}
        limit={model.scenario.importLimitMw}
        visibility={visibility}
        onSelect={inspection.select}
      />
      <div className="compute-time-inspector">
        <IntervalNavigation
          points={points}
          timestamp={inspection.pinnedTimestamp}
          onSelect={inspection.select}
        />
        <label htmlFor="compute-inspect-time">
          Inspect time · <strong>{formatOperationsTime(current.timestamp)}</strong>
        </label>
        <input
          id="compute-inspect-time"
          type="range"
          disabled={!workspace.interactive}
          min="0"
          max={points.length - 1}
          value={currentIndex}
          onChange={(event) => inspection.select(points[Number(event.target.value)].timestamp)}
          aria-valuetext={formatOperationsTime(current.timestamp)}
        />
        <div className="compute-interval-facts" aria-live="polite">
          <strong>Required after battery {formatMw(current.requiredWorkloadMw)}</strong>
          <span>Facility demand {formatMw(current.baselineDemandMw)}</span>
          <span>{workloadTimeRelationship(inspected, current.timestamp)}</span>
        </div>
      </div>
      <label className="compute-show-eligible">
        <input
          type="checkbox"
          checked={showEligible}
          onChange={(event) => setShowEligible(event.target.checked)}
        />
        Show eligible workload windows
      </label>
      <WorkloadWindowLanes
        jobs={jobs}
        from={from}
        to={to}
        cursor={current.time}
        onSelect={setSelectedId}
        selectedId={selectedId}
        interactive={workspace.interactive}
      />
      {pool.length > 5 ? (
        <p>Showing 5 windows. Open the workload queue to inspect all {pool.length}.</p>
      ) : null}
      <ComputeChartData
        pinnedTimestamp={inspection.pinnedTimestamp}
        model={displayModel}
        timestamp={inspection.timestamp}
        onSelect={inspection.select}
        selected={inspected}
        onPreview={inspection.preview}
      />
    </article>
  );
}
