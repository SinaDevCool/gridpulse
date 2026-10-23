import type { WorkloadDecision } from "../workload-intelligence";
import { formatMw } from "../formatting";
import { formatOperationsTime } from "../presentation";
import { workloadWindow } from "./select-compute-summary";
import { OperationsChartLegend, useChartVisibility } from "../visualization";
import { matchesReviewGroup, type ReviewGroup } from "./select-review-groups";

export function WorkloadWindowLanes({
  jobs,
  from,
  to,
  cursor,
  onSelect,
  selectedId,
  interactive,
  reviewGroup = "all",
}: {
  jobs: WorkloadDecision[];
  from: number;
  to: number;
  cursor: number;
  onSelect: (id: string) => void;
  selectedId: string | null;
  interactive: boolean;
  reviewGroup?: ReviewGroup;
}) {
  const visibility = useChartVisibility();
  return (
    <section
      id="compute-workload-windows"
      tabIndex={-1}
      className="compute-window-lanes"
      aria-label="Declared and proposed workload windows"
    >
      <header>
        <h4>Candidate workload windows</h4>
      </header>
      <p>
        Windows, not execution history. Proposed timing is an eligibility estimate—not a validated
        schedule.
      </p>
      <OperationsChartLegend
        label="Workload timing legend"
        visibility={visibility}
        items={[
          {
            label: "Earliest reference",
            detail: "Solid bar · not execution",
            tone: "demand",
            mark: "bar",
          },
          {
            label: "Proposed window",
            detail: "Hatched bar · not validated",
            tone: "response",
            mark: "bar",
          },
          { label: "Permitted window", detail: "Background band", tone: "neutral", mark: "area" },
          { label: "Deadline", detail: "Vertical marker", tone: "neutral", mark: "dash" },
        ]}
      />
      {!jobs.length ? (
        <p>No recommended candidate windows. Review the queue or show eligible workloads.</p>
      ) : null}
      {jobs.map((job) => {
        const window = workloadWindow(job, from, to);
        const outside = window && !window.declared && !window.proposed;
        return (
          <div
            className={`compute-window-lane ${selectedId === job.workloadId ? "selected" : ""}`}
            key={job.workloadId}
            data-review-match={reviewGroup !== "all" && matchesReviewGroup(job, reviewGroup)}
            data-workload-id={job.workloadId}
          >
            <button
              type="button"
              disabled={!interactive}
              className="compute-lane-title"
              aria-pressed={selectedId === job.workloadId}
              onClick={() => onSelect(job.workloadId)}
            >
              <strong>{job.name}</strong>
              <span>
                {formatMw(job.estimatedPowerMw)} · {job.powerEvidence} power ·{" "}
                {job.recommended
                  ? "Candidate for review"
                  : job.eligible
                    ? "Eligible—not selected"
                    : "Protected workload"}
              </span>
              {reviewGroup !== "all" && matchesReviewGroup(job, reviewGroup) ? (
                <small className="compute-lane-highlight-label">Highlighted</small>
              ) : null}
            </button>
            <div className="compute-lane-track" aria-hidden="true">
              <i
                className="compute-lane-cursor"
                style={{
                  left: `${Math.max(0, Math.min(100, ((cursor - from) / (to - from)) * 100))}%`,
                }}
              />
              {window?.allowed && visibility.visible("Permitted window") ? (
                <i
                  className="allowed"
                  style={{ left: `${window.allowed.left}%`, width: `${window.allowed.width}%` }}
                />
              ) : null}
              {window?.declared && visibility.visible("Earliest reference") ? (
                <i
                  className="declared"
                  style={{ left: `${window.declared.left}%`, width: `${window.declared.width}%` }}
                />
              ) : null}
              {window?.proposed && visibility.visible("Proposed window") ? (
                <i
                  className="proposed"
                  style={{ left: `${window.proposed.left}%`, width: `${window.proposed.width}%` }}
                />
              ) : null}
              {window?.deadline != null && visibility.visible("Deadline") ? (
                <b className="deadline" style={{ left: `${window.deadline}%` }} />
              ) : null}
            </div>
            <small>
              {!window
                ? "Invalid or missing workload window—inspect details."
                : outside
                  ? "Outside the selected display window—inspect details for full timing."
                  : `Earliest ${formatOperationsTime(job.earliestStart)} · Deadline ${formatOperationsTime(job.deadline, true)}${window.declared?.before || window.proposed?.before ? " · Continues from before this window" : ""}${window.declared?.after || window.proposed?.after ? " · Continues after this window" : ""}`}
            </small>
            {window?.missesDeadline ? (
              <p role="alert">Proposed completion exceeds the declared deadline.</p>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
