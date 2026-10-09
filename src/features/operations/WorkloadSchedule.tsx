import type { WorkloadDecision } from "./workload-intelligence";
import { formatMinutes, formatOperationsTime } from "./presentation";

/** Visualises declared windows, not actual scheduler execution or dispatch. */
export function WorkloadSchedule({ workload }: { workload: WorkloadDecision }) {
  const start = Date.parse(workload.earliestStart);
  const deadline = Date.parse(workload.deadline);
  const proposed = workload.recommended ? Date.parse(workload.proposedStart) : start;
  const duration = workload.expectedDurationMinutes * 60_000;
  const window = deadline - start;
  const slack = Math.max(0, (deadline - proposed - duration) / 60_000);
  const delay = Math.max(0, (proposed - start) / 60_000);
  if (window <= 0 || !Number.isFinite(window)) return null;
  return (
    <section className="workload-schedule" aria-label="Declared workload schedule comparison">
      <h4>{workload.recommended ? "Proposed schedule" : "Declared execution window"}</h4>
      <p>Reference window—not an instruction to the scheduler.</p>
      <div className="workload-schedule-row">
        <span>Earliest</span>
        <div>
          <i style={{ width: `${Math.min(100, (duration / window) * 100)}%` }} />
        </div>
        <strong>{formatOperationsTime(workload.earliestStart)}</strong>
      </div>
      <div className="workload-schedule-row proposed">
        <span>{workload.recommended ? "Proposed" : "Unchanged"}</span>
        <div>
          <i
            style={{
              marginLeft: `${Math.min(100, ((proposed - start) / window) * 100)}%`,
              width: `${Math.min(100, (duration / window) * 100)}%`,
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
          <dt>Response contribution</dt>
          <dd>{workload.recommended ? `${workload.peakReductionMw} MW` : "Not selected"}</dd>
        </div>
      </dl>
      {proposed + duration > deadline ? (
        <p role="alert">Proposed completion exceeds the declared deadline.</p>
      ) : null}
    </section>
  );
}
