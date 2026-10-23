import type { ComputeWorkspaceContract } from "../compute-workspace-contract";
import { ComputeWorkloadQueue } from "../ComputeWorkloadQueue";
import { useOperationsPresentationStore } from "../hooks/evidence-store";
import { formatMw, formatMwh } from "../formatting";
import { integer } from "./presentation";
import { matchesReviewGroup, selectReviewGroups, type ReviewGroup } from "./select-review-groups";
import { paginateWorkloadDecisions } from "./select-workload-queue";

export function ComputeReview({ workspace }: { workspace: ComputeWorkspaceContract }) {
  const presentation = useOperationsPresentationStore();
  const [open, setOpen] = presentation.workloadQueueOpen;
  const [group, setGroup] = presentation.workloadDecisionGroup;
  const groups = selectReviewGroups(workspace.assessment.decisions);
  const summary = workspace.model.summaries.find((item) => item.kind === "battery_workload");
  const unresolved = summary?.unresolvedWorkMwh;
  const visible = paginateWorkloadDecisions(
    workspace.decisions.filter((job) => matchesReviewGroup(job, group)),
    workspace.visiblePage,
  ).visibleDecisions;
  return (
    <section className="ops-task-review" aria-labelledby="compute-review-title">
      <header>
        <div>
          <p className="context-label">Workload review</p>
          <h3 id="compute-review-title">What needs your attention?</h3>
        </div>
        <span>Full-horizon eligibility · not a validated schedule</span>
      </header>
      <div
        className="compute-decision-distribution"
        role="img"
        aria-label={groups.map((item) => `${item.label}: ${item.count}`).join("; ")}
      >
        {groups.map((item) => (
          <span
            key={item.id}
            className={item.id}
            style={{
              width: `${(item.count / Math.max(1, workspace.assessment.decisions.length)) * 100}%`,
            }}
          />
        ))}
      </div>
      <div className="compute-review-groups" aria-label="Workload decision groups">
        {groups.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={!workspace.interactive || !item.count}
            aria-pressed={group === item.id}
            aria-controls="compute-review-queue compute-workload-windows"
            onClick={() => {
              setGroup(item.id);
              workspace.setStatus("all");
              workspace.setQueuePage(0);
              setOpen(true);
              requestAnimationFrame(() => {
                const windows = document.getElementById("compute-workload-windows");
                windows?.scrollIntoView({ block: "start", behavior: "instant" });
                windows?.focus({ preventScroll: true });
              });
            }}
          >
            <span className={`ops-group-mark ${item.id}`} aria-hidden="true" />
            <strong>{integer.format(item.count)}</strong>
            <span>{item.label}</span>
            <small>Highlight windows ↑</small>
          </button>
        ))}
      </div>
      {!workspace.assessment.decisions.length ? (
        <p role="status">No workload records to review. Import a scheduler export in Inputs.</p>
      ) : null}
      <div className="compute-review-obligations">
        <div>
          <p className="context-label">
            Aggregate scenario recovery · not attributed to individual jobs
          </p>
          <strong>
            {unresolved == null
              ? "Recovery unavailable"
              : unresolved > 0.01
                ? `${formatMwh(unresolved)} still needs a recovery slot`
                : "Aggregate recovery accounted for"}
          </strong>
          <p>
            Check the candidate windows above, then inspect duration, deadline and restart
            constraints. Energy recovery does not establish job completion.
          </p>
        </div>
        <div>
          <span>Job schedule</span>
          <strong>Not validated</strong>
          <span>
            {workspace.assessment.deadlinesAtRisk} declared deadline flags · not a completion
            guarantee
          </span>
        </div>
      </div>
      <details
        id="compute-review-queue"
        className="compute-queue-disclosure"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>View workloads · {workspace.assessment.decisions.length}</summary>
        <label className="compute-review-filter">
          Decision group{" "}
          <select
            value={group}
            onChange={(event) => {
              setGroup(event.target.value as ReviewGroup);
              workspace.setQueuePage(0);
            }}
          >
            <option value="all">All decisions</option>
            {groups.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {workspace.selected && !visible.some((job) => job.workloadId === workspace.selectedId) ? (
          <p role="status">
            Selected workload is hidden by the queue filters.{" "}
            <button
              type="button"
              onClick={() => {
                setGroup("all");
                workspace.setStatus("all");
                const ordered = [...workspace.assessment.decisions].sort(
                  (a, b) => Number(b.recommended) - Number(a.recommended),
                );
                workspace.setQueuePage(
                  Math.floor(
                    Math.max(
                      0,
                      ordered.findIndex((job) => job.workloadId === workspace.selectedId),
                    ) / 50,
                  ),
                );
              }}
            >
              Reveal selected workload
            </button>
          </p>
        ) : null}
        <ComputeWorkloadQueue model={workspace} group={group} />
      </details>
      <details className="compute-inventory-detail">
        <summary>Inspect inventory & nominal flexibility</summary>
        <dl className="ops-compact-facts">
          <div>
            <dt>Active GPUs · window peak</dt>
            <dd>{integer.format(workspace.peakInterval.activeGpuCount)}</dd>
          </div>
          <div>
            <dt>Compute power · window peak</dt>
            <dd>{formatMw(workspace.peakInterval.gpuPowerMw)}</dd>
          </div>
          <div>
            <dt>Eligible nominal power · full horizon</dt>
            <dd>{formatMw(workspace.assessment.flexiblePowerMw)}</dd>
          </div>
          <div>
            <dt>Delay-based energy estimate · full horizon</dt>
            <dd>{formatMwh(workspace.assessment.flexibleEnergyMwh)}</dd>
          </div>
        </dl>
        <p>
          Summed eligible job estimates are not simultaneous, deliverable MW or measured shifted
          energy.
        </p>
      </details>
    </section>
  );
}
