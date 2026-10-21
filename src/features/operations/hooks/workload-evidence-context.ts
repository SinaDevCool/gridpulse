import { createContext, useContext } from "react";
import type { ChangeEvent } from "react";
import type { ComputeWorkload, GpuTelemetry, WorkloadAssessment } from "../workload-intelligence";

export interface SharedWorkloadEvidence {
  workloads: ComputeWorkload[];
  telemetry: GpuTelemetry[];
  assessment: WorkloadAssessment;
  message: string;
  error: string;
  restoreScenario: () => void;
  importWorkloadFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  importTelemetryFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export const WorkloadEvidenceContext = createContext<SharedWorkloadEvidence | null>(null);

export function useSharedWorkloadEvidence() {
  const evidence = useContext(WorkloadEvidenceContext);
  if (!evidence) throw new Error("Workload evidence requires its workspace provider");
  return evidence;
}
