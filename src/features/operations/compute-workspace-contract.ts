import type { OperationsOverviewModel } from "./scenario-engine";

/** Static public contract; implementation conforms to this boundary. */
export interface ComputeWorkspaceContract {
  capabilities: NoInfer<{
    schemaVersion: "gridpulse-operations-capabilities-v1";
    persistence: {
      configured: boolean;
      provider: string;
    };
    connectors: {
      status: string;
      id: string;
      label: string;
      transport: string;
      evidence: string[];
    }[];
  }> | null;
  selectedId: string | null;
  setSelectedId: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  message: string;
  error: string;
  assessment: import("./workload-intelligence").WorkloadAssessment;
  restoreScenario: () => void;
  importWorkloadFile: (event: import("react").ChangeEvent<HTMLInputElement>) => Promise<void>;
  importTelemetryFile: (event: import("react").ChangeEvent<HTMLInputElement>) => Promise<void>;
  status: "running" | "queued" | "held" | "completed" | "all";
  setStatus: import("react").Dispatch<
    import("react").SetStateAction<"running" | "queued" | "held" | "completed" | "all">
  >;
  setQueuePage: import("react").Dispatch<import("react").SetStateAction<number>>;
  importOpen: boolean;
  setImportOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  interactive: boolean;
  peakInterval: import("./scenario-engine").OperationsInterval;
  decisions: import("./workload-intelligence").WorkloadDecision[];
  selected: import("./workload-intelligence").WorkloadDecision | null;
  pageCount: number;
  visiblePage: number;
  visibleDecisions: import("./workload-intelligence").WorkloadDecision[];
  evidence: "measured" | "reference" | "simulated";
  model: OperationsOverviewModel;
  displayModel: OperationsOverviewModel;
}
