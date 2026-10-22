import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ComputeWorkspaceContract } from "../compute-workspace-contract";
import { formatMw, formatMwh } from "../formatting";
import { selectComputeSummary } from "./select-compute-summary";

export function ComputeOperatingSummary({ workspace }: { workspace: ComputeWorkspaceContract }) {
  const s = selectComputeSummary(workspace.assessment, workspace.model);
  return (
    <section className="compute-operating-summary" aria-label="Compute operating summary">
      <div className="compute-decision-headline">
        <p className="context-label">Full-horizon workload requirement</p>
        <h3>{formatMw(s.required)}</h3>
        <p>Maximum reduction needed after battery response</p>
        <strong>
          {s.candidates} candidate{s.candidates === 1 ? "" : "s"} · {s.eligible} eligible ·{" "}
          {s.total} assessed
        </strong>
        <small>Nominal candidate power {formatMw(s.nominal)} · not time-matched response</small>
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
          <strong>{s.unrecovered == null ? "Unavailable" : formatMwh(s.unrecovered)}</strong> · full
          horizon, not attributed to individual jobs
        </p>
      </div>
    </section>
  );
}
