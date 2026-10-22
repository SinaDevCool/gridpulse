import { useMemo, useReducer, useState, type ReactNode, type SetStateAction } from "react";
import {
  OperationsEvidenceDataContext,
  OperationsPresentationContext,
} from "./hooks/evidence-store";
import type { OperationsPresentationStore } from "./hooks/evidence-store";
import { evidenceReducer, type EvidenceState, type EvidenceAction } from "./hooks/evidence-reducer";
import { buildOperationsScenario } from "./scenario-engine";
import { buildScenarioWorkloads, type ComputeWorkload } from "./workload-intelligence";

/** Evidence transitions are atomic; presentation preferences remain separate. */
export function OperationsEvidenceProvider({ children }: { children: ReactNode }) {
  const [evidence, dispatchEvidence] = useReducer(
    evidenceReducer,
    undefined,
    (): EvidenceState => ({
      importReports: {},
      workloads: buildScenarioWorkloads(buildOperationsScenario()),
      telemetry: [],
      workloadMessage: "Scenario workload set loaded. No customer telemetry is connected.",
      workloadError: "",
      workloadAssessment: null,
      workloadSignature: "",
      facility: [],
      battery: [],
      powerMessage: "",
      powerError: "",
    }),
  );
  const setters = useMemo(() => {
    function setter<K extends keyof EvidenceState>(key: K) {
      return (value: SetStateAction<EvidenceState[K]>) =>
        dispatchEvidence({ type: "field", field: key, value } as EvidenceAction);
    }
    return {
      importReports: setter("importReports"),
      workloads: setter("workloads"),
      telemetry: setter("telemetry"),
      workloadMessage: setter("workloadMessage"),
      workloadError: setter("workloadError"),
      workloadAssessment: setter("workloadAssessment"),
      workloadSignature: setter("workloadSignature"),
      facility: setter("facility"),
      battery: setter("battery"),
      powerMessage: setter("powerMessage"),
      powerError: setter("powerError"),
    };
  }, []);
  const fields = useMemo(() => {
    function field<K extends keyof EvidenceState>(
      key: K,
    ): [EvidenceState[K], (value: SetStateAction<EvidenceState[K]>) => void] {
      return [evidence[key], setters[key] as (value: SetStateAction<EvidenceState[K]>) => void];
    }
    return {
      importReports: field("importReports"),
      workloads: field("workloads"),
      telemetry: field("telemetry"),
      workloadMessage: field("workloadMessage"),
      workloadError: field("workloadError"),
      workloadAssessment: field("workloadAssessment"),
      workloadSignature: field("workloadSignature"),
      facility: field("facility"),
      battery: field("battery"),
      powerMessage: field("powerMessage"),
      powerError: field("powerError"),
    };
  }, [evidence, setters]);
  const value = useMemo(() => ({ ...fields, dispatchEvidence }), [fields]);
  return (
    <OperationsEvidenceDataContext.Provider value={value}>
      <OperationsPresentationProvider>{children}</OperationsPresentationProvider>
    </OperationsEvidenceDataContext.Provider>
  );
}

function OperationsPresentationProvider({ children }: { children: ReactNode }) {
  const [powerTimestamp, setPowerTimestamp] = useState<string | null>(null);
  const [historicalTimestamp, setHistoricalTimestamp] = useState<string | null>(null);
  const [powerImportsOpen, setPowerImportsOpen] = useState(false);
  const [workloadSelectedId, setWorkloadSelectedId] = useState<string | null>(null);
  const [workloadStatus, setWorkloadStatus] = useState<"all" | ComputeWorkload["status"]>("all");
  const [workloadPage, setWorkloadPage] = useState(0);
  const [workloadQueueOpen, setWorkloadQueueOpen] = useState(false);
  const [workloadDecisionGroup, setWorkloadDecisionGroup] =
    useState<import("./compute/select-review-groups").ReviewGroup>("all");
  const value = useMemo<OperationsPresentationStore>(
    () => ({
      powerTimestamp: [powerTimestamp, setPowerTimestamp],
      historicalTimestamp: [historicalTimestamp, setHistoricalTimestamp],
      powerImportsOpen: [powerImportsOpen, setPowerImportsOpen],
      workloadSelectedId: [workloadSelectedId, setWorkloadSelectedId],
      workloadStatus: [workloadStatus, setWorkloadStatus],
      workloadPage: [workloadPage, setWorkloadPage],
      workloadQueueOpen: [workloadQueueOpen, setWorkloadQueueOpen],
      workloadDecisionGroup: [workloadDecisionGroup, setWorkloadDecisionGroup],
    }),
    [
      powerTimestamp,
      historicalTimestamp,
      powerImportsOpen,
      workloadSelectedId,
      workloadStatus,
      workloadPage,
      workloadQueueOpen,
      workloadDecisionGroup,
    ],
  );
  return (
    <OperationsPresentationContext.Provider value={value}>
      {children}
    </OperationsPresentationContext.Provider>
  );
}
