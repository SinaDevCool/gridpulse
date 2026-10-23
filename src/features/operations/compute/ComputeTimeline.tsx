import { useEffect, useState } from "react";
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
import { useOperationsPresentationStore } from "../hooks/evidence-store";
import { selectWorkloadWindows, selectReviewGroups } from "./select-review-groups";

export function ComputeTimeline({ workspace }: { workspace: ComputeWorkspaceContract }) {
  const { displayModel, model, assessment, selectedId, setSelectedId } = workspace;
  const visibility = useChartVisibility(["GPU power", "Aggregate scenario response"]);
  const [showAll, setShowAll] = useState(false);
  const [lanePage, setLanePage] = useState(0);
  const [group, setGroup] = useOperationsPresentationStore().workloadDecisionGroup;
  useEffect(() => setLanePage(0), [group]);
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
  const { jobs, inspected, pages, page, count, highlighted } = selectWorkloadWindows(
    assessment.decisions,
    group,
    showAll,
    lanePage,
    selectedId,
  );
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
          onClick={() => {
            setFacilityContext(false);
            setShowAll(true);
          }}
        >
          Workload reduction
        </button>
        <button
          type="button"
          aria-pressed={facilityContext}
          onClick={() => {
            setFacilityContext(true);
            setShowAll(true);
          }}
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
          disabled={!workspace.interactive}
          checked={showAll || group !== "all"}
          onChange={(event) => {
            setShowAll(event.target.checked);
            setLanePage(0);
            if (!event.target.checked) setGroup("all");
          }}
        />
        Show all workload windows
      </label>
      <div className="compute-window-selection" role="status">
        {group === "all"
          ? `${count} workload windows · no group highlighted`
          : `${highlighted} highlighted · ${selectReviewGroups(assessment.decisions).find((item) => item.id === group)?.label}`}
        {group !== "all" ? (
          <button
            type="button"
            onClick={() => {
              setShowAll(true);
              setGroup("all");
            }}
          >
            Clear highlighting
          </button>
        ) : null}
      </div>
      <WorkloadWindowLanes
        jobs={jobs}
        from={from}
        to={to}
        cursor={current.time}
        onSelect={setSelectedId}
        selectedId={selectedId}
        interactive={workspace.interactive}
        reviewGroup={group}
      />
      {pages > 1 ? (
        <nav aria-label="Workload window pages">
          <button type="button" disabled={page === 0} onClick={() => setLanePage(page - 1)}>
            Previous windows
          </button>
          <span>
            Page {page + 1} of {pages} · {count} workloads
          </span>
          <button type="button" disabled={page === pages - 1} onClick={() => setLanePage(page + 1)}>
            Next windows
          </button>
        </nav>
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
