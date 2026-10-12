import type { BatteryObservation, FacilityPowerObservation } from "../battery-dispatch";
import type { OperationsImportKind, OperationsImportReport } from "../import-report";
import type { ComputeWorkload, GpuTelemetry, WorkloadAssessment } from "../workload-intelligence";

export type EvidenceState = {
  importReports: Partial<Record<OperationsImportKind, OperationsImportReport>>;
  workloads: ComputeWorkload[];
  telemetry: GpuTelemetry[];
  workloadMessage: string;
  workloadError: string;
  workloadAssessment: WorkloadAssessment | null;
  workloadSignature: string;
  facility: FacilityPowerObservation[];
  battery: BatteryObservation[];
  powerMessage: string;
  powerError: string;
};

type FieldUpdate = {
  [K in keyof EvidenceState]: {
    type: "field";
    field: K;
    value: EvidenceState[K] | ((current: EvidenceState[K]) => EvidenceState[K]);
  };
}[keyof EvidenceState];

export type EvidenceAction =
  | FieldUpdate
  | {
      type: "accept-power";
      facility?: FacilityPowerObservation[];
      battery?: BatteryObservation[];
      kind: "facility" | "battery";
      report: OperationsImportReport;
      message: string;
    }
  | {
      type: "accept-workloads";
      workloads?: ComputeWorkload[];
      telemetry?: GpuTelemetry[];
      assessment: WorkloadAssessment;
      signature: string;
      report: OperationsImportReport;
      kind: "scheduler" | "gpu";
      message: string;
    }
  | { type: "restore-workloads"; workloads: ComputeWorkload[]; signature: string };

export function evidenceReducer(state: EvidenceState, action: EvidenceAction): EvidenceState {
  if (action.type === "accept-power")
    return {
      ...state,
      facility: action.facility ?? state.facility,
      battery: action.battery ?? state.battery,
      importReports: { ...state.importReports, [action.kind]: action.report },
      powerMessage: action.message,
      powerError: "",
    };
  if (action.type === "accept-workloads")
    return {
      ...state,
      workloads: action.workloads ?? state.workloads,
      telemetry: action.telemetry ?? state.telemetry,
      workloadAssessment: action.assessment,
      workloadSignature: action.signature,
      workloadError: "",
      workloadMessage: action.message,
      importReports: { ...state.importReports, [action.kind]: action.report },
    };
  if (action.type === "restore-workloads") {
    const { scheduler: _scheduler, gpu: _gpu, ...power } = state.importReports;
    return {
      ...state,
      workloads: action.workloads,
      telemetry: [],
      workloadAssessment: null,
      workloadSignature: action.signature,
      workloadError: "",
      workloadMessage: "Scenario workload set restored.",
      importReports: power,
    };
  }
  // The discriminated action ensures the updater and field types match at the boundary.
  const field = action.field;
  const update = action.value as
    | EvidenceState[typeof field]
    | ((current: EvidenceState[typeof field]) => EvidenceState[typeof field]);
  return {
    ...state,
    [action.field]: typeof update === "function" ? update(state[action.field]) : update,
  };
}
