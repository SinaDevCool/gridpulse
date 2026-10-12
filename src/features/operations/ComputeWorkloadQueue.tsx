import type { ComputeWorkspaceContract } from "./compute-workspace-contract";
import { integer, number } from "./compute/presentation";
import { Status } from "./compute/primitives";
import { formatMinutes } from "./presentation";
export function ComputeWorkloadQueue({
  model,
}: {
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
  const {
    selectedId,
    setSelectedId,
    status,
    setStatus,
    setQueuePage,
    interactive,
    decisions,
    pageCount,
    visiblePage,
    visibleDecisions,
  } = model;
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
  );
}
