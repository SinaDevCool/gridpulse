import { useEffect, useMemo, useState } from "react";
import { selectWorkloadQueue } from "./compute/select-workload-queue";
import type { EvidenceClass } from "./evidence";
import { useOperationsPresentationStore } from "./hooks/evidence-store";
import { useWorkloadEvidence } from "./hooks/use-workload-evidence";
import type { OperationsOverviewModel } from "./scenario-engine";
import { useOperationsCapabilities } from "./use-operations-capabilities";
export function useComputeWorkspace({
  model,
  displayModel = model,
}: {
  model: OperationsOverviewModel;
  displayModel?: OperationsOverviewModel;
}): import("./compute-workspace-contract").ComputeWorkspaceContract {
  const { data: capabilities } = useOperationsCapabilities();
  const evidenceStore = useOperationsPresentationStore();
  const [selectedId, setSelectedId] = evidenceStore.workloadSelectedId;
  const {
    workloads,
    telemetry,
    message,
    error,
    assessment,
    restoreScenario,
    importWorkloadFile,
    importTelemetryFile,
  } = useWorkloadEvidence(model, setSelectedId);
  const [status, setStatus] = evidenceStore.workloadStatus;
  const [queuePage, setQueuePage] = evidenceStore.workloadPage;
  const [importOpen, setImportOpen] = evidenceStore.workloadImportsOpen;
  const [interactive, setInteractive] = useState(false);
  const peakInterval = useMemo(
    () =>
      displayModel.intervals.reduce(
        (peak, point) => (point.activeGpuCount > peak.activeGpuCount ? point : peak),
        displayModel.intervals[0],
      ),
    [displayModel],
  );
  const { decisions, selected, orderedDecisions, pageCount, visiblePage, visibleDecisions } =
    useMemo(
      () => selectWorkloadQueue(assessment, status, selectedId, queuePage),
      [assessment, status, selectedId, queuePage],
    );
  const evidence: EvidenceClass =
    assessment.source === "scenario" ? "simulated" : telemetry.length ? "measured" : "reference";

  useEffect(() => setInteractive(true), []);
  return {
    capabilities,
    selectedId,
    setSelectedId,
    message,
    error,
    assessment,
    restoreScenario,
    importWorkloadFile,
    importTelemetryFile,
    status,
    setStatus,
    setQueuePage,
    importOpen,
    setImportOpen,
    interactive,
    peakInterval,
    decisions,
    selected,
    pageCount,
    visiblePage,
    visibleDecisions,
    evidence,
    model,
    displayModel,
  };
}
