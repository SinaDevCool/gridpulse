import { ShieldCheck } from "lucide-react";
import type { ComputeWorkspaceContract } from "./compute-workspace-contract";
import { integer, number } from "./compute/presentation";
import { Row } from "./compute/primitives";
export function ComputeRecommendation({ model }: { model: ComputeWorkspaceContract }) {
  const { assessment } = model;
  return (
    <article className="compute-recommendation">
      <header>
        <ShieldCheck aria-hidden="true" />
        <div>
          <p className="context-label">Recommended Response</p>
          <h3>{assessment.recommendedJobs ? "Review the candidate set" : "Hold recommendation"}</h3>
        </div>
      </header>
      <p>
        {assessment.recommendedJobs
          ? `Candidate selection provides ${number.format(assessment.recommendedPowerMw)} MW against a ${number.format(assessment.requiredWorkloadResponseMw)} MW requirement. Whole jobs may exceed the required reduction. Validate start times, recovery and deadlines before accepting this option.`
          : "No workload movement is needed for the current facility scenario."}
      </p>
      <dl>
        <Row label="Recommended workloads" value={integer.format(assessment.recommendedJobs)} />
        <Row label="Peak response" value={`${number.format(assessment.recommendedPowerMw)} MW`} />
        <Row
          label="Shiftable energy"
          value={`${number.format(assessment.recommendedEnergyMwh)} MWh`}
        />
        <Row label="Declared deadline flags" value={integer.format(assessment.deadlinesAtRisk)} />
      </dl>
      <div className="operations-v2-readonly">
        <ShieldCheck aria-hidden="true" />
        <span>
          Read-only analysis. GridPulse does not reschedule jobs or change GPU power limits.
        </span>
      </div>
    </article>
  );
}
