import { useCallback } from "react";
import type { ComputeWorkspaceContract } from "./compute-workspace-contract";
import { WorkloadDrawer } from "./compute/WorkloadDrawer";
import { ComputeOperatingSummary } from "./compute/ComputeOperatingSummary";
import { ComputeTimeline } from "./compute/ComputeTimeline";
import { ComputeReview } from "./compute/ComputeReview";
export function ComputeWorkspacePresentation({
  model: workspace,
}: {
  model: ComputeWorkspaceContract;
}) {
  const { setSelectedId } = workspace;
  const closeWorkload = useCallback(() => setSelectedId(null), [setSelectedId]);
  return (
    <section className="operations-v2-view operations-compute" aria-labelledby="compute-title">
      <h2 id="compute-title" className="sr-only">
        Compute and Workloads
      </h2>
      <ComputeOperatingSummary workspace={workspace} />
      <ComputeTimeline workspace={workspace} />
      <ComputeReview workspace={workspace} />
      {workspace.selected ? (
        <WorkloadDrawer workload={workspace.selected} onClose={closeWorkload} />
      ) : null}
    </section>
  );
}
