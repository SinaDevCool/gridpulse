import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { BatteryObservation, FacilityPowerObservation } from "../battery-dispatch";
import type { OperationsImportKind, OperationsImportReport } from "../import-report";
import type { ComputeWorkload, GpuTelemetry, WorkloadAssessment } from "../workload-intelligence";
import type { EvidenceAction } from "./evidence-reducer";
import type { EvidenceState } from "./evidence-reducer";

type State<T> = [T, Dispatch<SetStateAction<T>>];
export type OperationsEvidenceStore = {
  dispatchEvidence: Dispatch<EvidenceAction>;
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
export type OperationsEvidenceDataStore = Pick<
  OperationsEvidenceStore,
  keyof EvidenceState | "dispatchEvidence"
>;
export type OperationsPresentationStore = Omit<
  OperationsEvidenceStore,
  keyof OperationsEvidenceDataStore
>;
export const OperationsEvidenceDataContext = createContext<OperationsEvidenceDataStore | null>(
  null,
);
export const OperationsPresentationContext = createContext<OperationsPresentationStore | null>(
  null,
);
export function useOperationsEvidenceDataStore() {
  const value = useContext(OperationsEvidenceDataContext);
  if (!value) throw new Error("Operations evidence requires the workspace provider");
  return value;
}
export function useOperationsPresentationStore() {
  const value = useContext(OperationsPresentationContext);
  if (!value) throw new Error("Operations presentation requires the workspace provider");
  return value;
}
export function useOperationsEvidenceStore() {
  return { ...useOperationsEvidenceDataStore(), ...useOperationsPresentationStore() };
}
