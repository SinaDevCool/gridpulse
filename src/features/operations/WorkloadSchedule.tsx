import { formatMinutes, formatOperationsTime } from "./presentation";
import type { WorkloadDecision } from "./workload-intelligence";
import { workloadWindow } from "./compute/select-compute-summary";

/** Visualises declared windows, not actual scheduler execution or dispatch. */
export function WorkloadSchedule({ workload }: { workload: WorkloadDecision }) {
  const start = Date.parse(workload.earliestStart);
  const deadline = Date.parse(workload.deadline);
  const proposed = workload.recommended ? Date.parse(workload.proposedStart) : start;
  const duration = workload.expectedDurationMinutes * 60_000;
  const window = workloadWindow(workload, start, deadline);
  const slack = Math.max(0, (deadline - proposed - duration) / 60_000);
  const delay = Math.max(0, (proposed - start) / 60_000);
  if (!window) return null;
  return (
    <section className="workload-schedule" aria-label="Declared workload schedule comparison">
      <h4>{workload.recommended ? "Proposed schedule" : "Declared execution window"}</h4>
      <p>Reference window—not an instruction to the scheduler.</p>
      <div className="workload-schedule-row">
        <span>Earliest</span>
        <div>
          <i style={{ width: `${window.declared?.width ?? 0}%` }} />
        </div>
        <strong>{formatOperationsTime(workload.earliestStart)}</strong>
      </div>
      <div className="workload-schedule-row proposed">
        <span>{workload.recommended ? "Proposed" : "Unchanged"}</span>
        <div>
          <i
            style={{
              marginLeft: `${window.proposed?.left ?? 0}%`,
              width: `${(workload.recommended ? window.proposed?.width : window.declared?.width) ?? 0}%`,
            }}
          />
        </div>
        <strong>{formatOperationsTime(new Date(proposed).toISOString())}</strong>
      </div>
      <dl>
        <div>
          <dt>Deadline</dt>
          <dd>{formatOperationsTime(workload.deadline, true)}</dd>
        </div>
        <div>
          <dt>Delay / remaining slack</dt>
          <dd>
            {formatMinutes(delay)} / {formatMinutes(slack)}
          </dd>
        </div>
        <div>
          <dt>Nominal candidate power—not validated response</dt>
          <dd>{workload.recommended ? `${workload.peakReductionMw} MW` : "Not selected"}</dd>
        </div>
      </dl>
      {proposed + duration > deadline ? (
        <p role="alert">Proposed completion exceeds the declared deadline.</p>
      ) : null}
    </section>
  );
}
