import type { ReactNode } from "react";
import type { OperationsOverviewModel } from "./scenario-engine";
import { useOperationsPresentationStore } from "./hooks/evidence-store";
import { useWorkloadEvidence } from "./hooks/use-workload-evidence";
import { WorkloadEvidenceContext } from "./hooks/workload-evidence-context";

/** One import lifecycle for the sidebar and every Operations view. */
export function WorkloadEvidenceProvider({
  model,
  children,
}: {
  model: OperationsOverviewModel;
  children: ReactNode;
}) {
  const presentation = useOperationsPresentationStore();
  const evidence = useWorkloadEvidence(model, presentation.workloadSelectedId[1]);
  return (
    <WorkloadEvidenceContext.Provider value={evidence}>{children}</WorkloadEvidenceContext.Provider>
  );
}
