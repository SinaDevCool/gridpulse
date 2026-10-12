import { createContext,useContext,type Dispatch,type SetStateAction } from "react";
import type { BatteryObservation,FacilityPowerObservation } from "../battery-dispatch";
import type { OperationsImportKind,OperationsImportReport } from "../import-report";
import type { ComputeWorkload,GpuTelemetry,WorkloadAssessment } from "../workload-intelligence";

type State<T> = [T, Dispatch<SetStateAction<T>>];
export type OperationsEvidenceStore = {
  importReports: State<Partial<Record<OperationsImportKind, OperationsImportReport>>>;
  workloads: State<ComputeWorkload[]>;
  telemetry: State<GpuTelemetry[]>;
  workloadMessage: State<string>;
  workloadError: State<string>;
  workloadAssessment: State<WorkloadAssessment | null>;
  workloadSignature: State<string>;
  facility: State<FacilityPowerObservation[]>;
  battery: State<BatteryObservation[]>;
  powerMessage: State<string>;
  powerError: State<string>;
  powerTimestamp: State<string | null>;
  powerImportsOpen: State<boolean>;
  workloadSelectedId: State<string | null>;
  workloadStatus: State<"all" | ComputeWorkload["status"]>;
  workloadPage: State<number>;
  workloadImportsOpen: State<boolean>;
};
export const OperationsEvidenceContext = createContext<OperationsEvidenceStore | null>(null);
export function useOperationsEvidenceStore() {
  const value = useContext(OperationsEvidenceContext);
  if (!value) throw new Error("Operations evidence requires the workspace provider");
  return value;
}
