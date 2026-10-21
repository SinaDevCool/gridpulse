import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ComputeWorkspaceContract } from "../compute-workspace-contract";
import { formatMw, formatMwh } from "../formatting";
import { selectComputeSummary } from "./select-compute-summary";

export function ComputeOperatingSummary({ workspace }: { workspace: ComputeWorkspaceContract }) {
  const s = selectComputeSummary(workspace.assessment, workspace.model);
  const count = s.eligible ? Math.min(100, (s.candidates / s.eligible) * 100) : 0;
  return (
    <section className="compute-operating-summary" aria-label="Compute operating summary">
      <div
        className="compute-candidate-ring"
        role="img"
        aria-label={`${s.candidates} recommended candidates from ${s.eligible} eligible workloads; ${s.total} assessed`}
      >
        <svg viewBox="0 0 140 140" aria-hidden="true">
          <circle cx="70" cy="70" r="54" className="compute-ring-track" />
          <circle
            cx="70"
            cy="70"
            r="54"
            pathLength="100"
            strokeDasharray={`${count} 100`}
            className="compute-ring-value"
          />
          <text x="70" y="67" textAnchor="middle" className="compute-ring-number">
            {s.candidates}
          </text>
          <text x="70" y="88" textAnchor="middle">
            candidate{s.candidates === 1 ? "" : "s"}
          </text>
        </svg>
        <strong>
          {s.eligible} eligible · {s.total} assessed
        </strong>
      </div>
      <div className="compute-power-comparison">
        <p className="context-label">Full-horizon screening comparison</p>
        <h3>Workload power</h3>
        <dl>
          <div>
            <dt>Required after battery</dt>
            <dd>{formatMw(s.required)}</dd>
          </div>
          <div>
            <dt>Nominal candidate power</dt>
            <dd>{formatMw(s.nominal)}</dd>
          </div>
        </dl>
        <div className="compute-bullet" aria-hidden="true">
          <i style={{ width: `${(s.nominal / s.scale) * 100}%` }} />
          <b style={{ left: `${(s.required / s.scale) * 100}%` }} />
        </div>
        <div className="compute-bullet-scale">
          <span>0 MW</span>
          <span>│ Required reduction</span>
          <span>{formatMw(s.scale)}</span>
        </div>
        <small>
          Candidate estimate—not time-matched response. Whole-job power can exceed the requirement.
        </small>
      </div>
      <div className="compute-validation-status">
        <p className="context-label">Power-Aware Workload Decision</p>
        <h3>{s.status}</h3>
        <p>
          {s.required > 0 ? (
            <AlertTriangle aria-hidden="true" />
          ) : (
            <CheckCircle2 aria-hidden="true" />
          )}
          {workspace.assessment.deadlinesAtRisk} declared deadline flags—not a deadline guarantee.
        </p>
        <p>
          Aggregate recovery gap:{" "}
          <strong>{s.unrecovered == null ? "Unavailable" : formatMwh(s.unrecovered)}</strong>
        </p>
        <small>
          Aggregate scenario only · candidate timing not jointly validated · no scheduler commands.
        </small>
      </div>
    </section>
  );
}
