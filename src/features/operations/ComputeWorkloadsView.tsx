import { ComputeWorkspacePresentation } from "./ComputeWorkspacePresentation";
import { useComputeWorkspace } from "./use-compute-workspace";

import type { OperationsOverviewModel } from "./scenario-engine";

export function ComputeWorkloadsView({
  model,
  displayModel = model,
}: {
  model: OperationsOverviewModel;
  displayModel?: OperationsOverviewModel;
}) {
  return <ComputeWorkspacePresentation model={useComputeWorkspace({ model, displayModel })} />;
}
