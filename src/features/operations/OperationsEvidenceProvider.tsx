import { useState,type ReactNode } from "react";
import type { BatteryObservation,FacilityPowerObservation } from "./battery-dispatch";
import { OperationsEvidenceContext } from "./hooks/evidence-store";
import type { OperationsImportKind,OperationsImportReport } from "./import-report";
import { buildOperationsScenario } from "./scenario-engine";
import {
buildScenarioWorkloads,
type ComputeWorkload,
type GpuTelemetry,
type WorkloadAssessment,
} from "./workload-intelligence";

/** Workspace-scoped, not module-global. Tab unmounts must not discard accepted evidence. */
export function OperationsEvidenceProvider({ children }: { children: ReactNode }) {
  const importReports = useState<Partial<Record<OperationsImportKind, OperationsImportReport>>>({});
  const workloads = useState<ComputeWorkload[]>(() =>
    buildScenarioWorkloads(buildOperationsScenario()),
  );
  const telemetry = useState<GpuTelemetry[]>([]);
  const workloadMessage = useState(
    "Scenario workload set loaded. No customer telemetry is connected.",
  );
  const workloadError = useState("");
  const workloadAssessment = useState<WorkloadAssessment | null>(null);
  const workloadSignature = useState("");
  const facility = useState<FacilityPowerObservation[]>([]);
  const battery = useState<BatteryObservation[]>([]);
  const powerMessage = useState("");
  const powerError = useState("");
  const powerTimestamp = useState<string | null>(null);
  const powerImportsOpen = useState(false);
  const workloadSelectedId = useState<string | null>(null);
  const workloadStatus = useState<"all" | ComputeWorkload["status"]>("all");
  const workloadPage = useState(0);
  const workloadImportsOpen = useState(false);
  return (
    <OperationsEvidenceContext.Provider
      value={{
        importReports,
        workloads,
        telemetry,
        workloadMessage,
        workloadError,
        workloadAssessment,
        workloadSignature,
        facility,
        battery,
        powerMessage,
        powerError,
        powerTimestamp,
        powerImportsOpen,
        workloadSelectedId,
        workloadStatus,
        workloadPage,
        workloadImportsOpen,
      }}
    >
      {children}
    </OperationsEvidenceContext.Provider>
  );
}
