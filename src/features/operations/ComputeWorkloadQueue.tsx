import type { ComputeWorkspaceContract } from "./compute-workspace-contract";
import { useState } from "react";
import { integer, number } from "./compute/presentation";
import { Status } from "./compute/primitives";
import { formatMinutes } from "./presentation";
import { matchesReviewGroup, type ReviewGroup } from "./compute/select-review-groups";
import { paginateWorkloadDecisions } from "./compute/select-workload-queue";
export function ComputeWorkloadQueue({
  model,
  group = "all",
}: {
  group?: ReviewGroup;
  model: Pick<
    ComputeWorkspaceContract,
    | "selectedId"
    | "setSelectedId"
    | "status"
    | "setStatus"
    | "setQueuePage"
    | "interactive"
    | "decisions"
    | "pageCount"
    | "visiblePage"
    | "visibleDecisions"
  >;
}) {
  const [inventory, setInventory] = useState(false);
  const { selectedId, setSelectedId, status, setStatus, setQueuePage, interactive } = model;
  const decisions = model.decisions.filter((job) => matchesReviewGroup(job, group));
  const { pageCount, visiblePage, visibleDecisions } = paginateWorkloadDecisions(
    decisions,
    model.visiblePage,
  );
  return (
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
      <label className="compute-inventory-toggle">
        <input
          type="checkbox"
          checked={inventory}
          onChange={(event) => setInventory(event.target.checked)}
        />
        Show class & GPU inventory
      </label>
      <div className="compute-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Workload</th>
              {inventory ? <th scope="col">Class</th> : null}
              <th scope="col">Status</th>
              {inventory ? <th scope="col">GPUs</th> : null}
              <th scope="col">Power</th>
              <th scope="col">Deadline slack</th>
              <th scope="col">Decision</th>
            </tr>
          </thead>
          <tbody>
            {visibleDecisions.map((workload) => (
              <tr
                key={workload.workloadId}
                aria-selected={selectedId === workload.workloadId}
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
                {inventory ? <td>{workload.workloadClass}</td> : null}
                <td>
                  <Status value={workload.status} />
                </td>
                {inventory ? <td>{integer.format(workload.requestedGpuCount)}</td> : null}
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
  );
}
