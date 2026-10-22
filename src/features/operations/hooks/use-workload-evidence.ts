import { requestOperationsAssessment } from "@/lib/operations-api";
import { stableOperationsJson } from "@/lib/operations-request";
import { useEffect, useMemo, useRef, type ChangeEvent } from "react";
import { buildImportReport } from "../import-report";
import type { OperationsOverviewModel } from "../scenario-engine";
import {
  assessWorkloads,
  buildScenarioWorkloads,
  parseGpuTelemetryCsv,
  parseWorkloadCsv,
} from "../workload-intelligence";
import { useOperationsEvidenceDataStore } from "./evidence-store";
import { OPERATIONS_CALCULATION_VERSION } from "../calculation-version";
import { useQueryClient } from "@tanstack/react-query";
import { assessmentInput, assessmentQueryKey } from "../assessment-input";

export function useWorkloadEvidence(
  model: OperationsOverviewModel,
  setSelectedId: (id: string | null) => void,
) {
  const queryClient = useQueryClient();
  const importRevision = useRef(0);
  const importController = useRef<AbortController | null>(null);

  function beginImport() {
    importController.current?.abort();
    const controller = new AbortController();
    importController.current = controller;
    return { revision: ++importRevision.current, signal: controller.signal };
  }

  const modelSignature = stableOperationsJson({
    calculationVersion: OPERATIONS_CALCULATION_VERSION,
    scenario: model.scenario,
  });

  const previousModelSignature = useRef(modelSignature);

  const store = useOperationsEvidenceDataStore();
  const [workloads, setWorkloads] = store.workloads;
  const [telemetry, setTelemetry] = store.telemetry;
  const [message, setMessage] = store.workloadMessage;
  const [error, setError] = store.workloadError;
  const [backendAssessment, setBackendAssessment] = store.workloadAssessment;
  const [storedSignature, setStoredSignature] = store.workloadSignature;

  const localAssessment = useMemo(
    () => model.assessmentPlan?.workloads ?? assessWorkloads(workloads, telemetry, model),
    [workloads, telemetry, model],
  );

  const assessment =
    model.assessmentPlan?.workloads ??
    (storedSignature === modelSignature ? (backendAssessment ?? localAssessment) : localAssessment);

  useEffect(() => {
    // A server refresh with identical inputs must not cancel an in-flight import.
    if (previousModelSignature.current === modelSignature && storedSignature === modelSignature)
      return;
    const inputsChanged = storedSignature !== "" && storedSignature !== modelSignature;
    setStoredSignature(modelSignature);
    previousModelSignature.current = modelSignature;
    importRevision.current += 1;
    importController.current?.abort();
    setBackendAssessment(null);
    setWorkloads((current) =>
      current.every((workload) => workload.source === "scenario")
        ? buildScenarioWorkloads(model)
        : current,
    );
    if (inputsChanged)
      setMessage(
        "Inputs changed. Workload estimates recalculated; canonical schedule validation is still required.",
      );
  }, [
    model,
    modelSignature,
    storedSignature,
    setStoredSignature,
    setBackendAssessment,
    setWorkloads,
    setMessage,
  ]);
  useEffect(
    () => () => {
      importRevision.current += 1;
      importController.current?.abort();
    },
    [],
  );

  async function importWorkloadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const { revision, signal } = beginImport();
    try {
      const parsed = parseWorkloadCsv(await file.text());
      const input = assessmentInput(model.scenario, {
        workloads: parsed,
        telemetry,
        facility: store.facility[0],
        battery: store.battery[0],
      });
      const response = await requestOperationsAssessment(input, signal);
      if (revision !== importRevision.current) return;
      queryClient.setQueryData(assessmentQueryKey(input), response);
      store.dispatchEvidence({
        type: "accept-workloads",
        workloads: parsed,
        kind: "scheduler",
        assessment: response.result.assessmentPlan!.workloads,
        signature: modelSignature,
        message: `${parsed.length} scheduler records loaded from ${file.name}.`,
        report: buildImportReport(
          "scheduler",
          file.name,
          parsed.map((row) => row.submittedAt),
          true,
        ),
      });
      setSelectedId(null);
    } catch (reason) {
      if (revision !== importRevision.current) return;
      setError(reason instanceof Error ? reason.message : "The workload file could not be read.");
    } finally {
      event.target.value = "";
    }
  }

  async function importTelemetryFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const { revision, signal } = beginImport();
    try {
      const parsed = parseGpuTelemetryCsv(await file.text());
      const input = assessmentInput(model.scenario, {
        workloads,
        telemetry: parsed,
        facility: store.facility[0],
        battery: store.battery[0],
      });
      const response = await requestOperationsAssessment(input, signal);
      if (revision !== importRevision.current) return;
      queryClient.setQueryData(assessmentQueryKey(input), response);
      store.dispatchEvidence({
        type: "accept-workloads",
        telemetry: parsed,
        kind: "gpu",
        assessment: response.result.assessmentPlan!.workloads,
        signature: modelSignature,
        message: `${parsed.length} GPU telemetry records loaded from ${file.name}.`,
        report: buildImportReport(
          "gpu",
          file.name,
          parsed.map((row) => row.timestamp),
          true,
        ),
      });
    } catch (reason) {
      if (revision !== importRevision.current) return;
      setError(reason instanceof Error ? reason.message : "The telemetry file could not be read.");
    } finally {
      event.target.value = "";
    }
  }
  return {
    restoreScenario() {
      importRevision.current += 1;
      importController.current?.abort();
      store.dispatchEvidence({
        type: "restore-workloads",
        workloads: buildScenarioWorkloads(model),
        signature: modelSignature,
      });
    },
    workloads,
    telemetry,
    message,
    error,
    assessment,
    setWorkloads,
    setTelemetry,
    setMessage,
    setError,
    importWorkloadFile,
    importTelemetryFile,
  };
}
