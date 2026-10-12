import { requestOperationsAssessment } from "@/lib/operations-api";
import { stableOperationsJson } from "@/lib/operations-request";
import { useEffect,useMemo,useRef,type ChangeEvent } from "react";
import { buildImportReport } from "../import-report";
import type { OperationsOverviewModel } from "../scenario-engine";
import {
assessWorkloads,
buildScenarioWorkloads,
parseGpuTelemetryCsv,
parseWorkloadCsv,
type WorkloadAssessment
} from "../workload-intelligence";
import { useOperationsEvidenceStore } from "./evidence-store";

export function useWorkloadEvidence(
  model: OperationsOverviewModel,
  setSelectedId: (id: string | null) => void,
) {
  const importRevision = useRef(0);

  const modelSignature = stableOperationsJson({
    scenario: model.scenario,
    intervals: model.intervals,
  });

  const previousModelSignature = useRef(modelSignature);

  const store = useOperationsEvidenceStore();
  const [workloads, setWorkloads] = store.workloads;
  const [telemetry, setTelemetry] = store.telemetry;
  const [message, setMessage] = store.workloadMessage;
  const [error, setError] = store.workloadError;
  const [backendAssessment, setBackendAssessment] = store.workloadAssessment;
  const [storedSignature, setStoredSignature] = store.workloadSignature;

  const localAssessment = useMemo(
    () => assessWorkloads(workloads, telemetry, model),
    [workloads, telemetry, model],
  );

  const assessment =
    storedSignature === modelSignature ? (backendAssessment ?? localAssessment) : localAssessment;

  useEffect(() => {
    // A server refresh with identical inputs must not cancel an in-flight import.
    if (previousModelSignature.current === modelSignature && storedSignature === modelSignature)
      return;
    const inputsChanged = storedSignature !== "" && storedSignature !== modelSignature;
    setStoredSignature(modelSignature);
    previousModelSignature.current = modelSignature;
    importRevision.current += 1;
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
    },
    [],
  );

  async function importWorkloadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const revision = ++importRevision.current;
    try {
      const parsed = parseWorkloadCsv(await file.text());
      const response = await requestOperationsAssessment<WorkloadAssessment>({
        kind: "compute",
        scenario: model.scenario,
        workloads: parsed,
        telemetry,
      });
      if (revision !== importRevision.current) return;
      setWorkloads(parsed);
      store.importReports[1]((current) => ({
        ...current,
        scheduler: buildImportReport(
          "scheduler",
          file.name,
          parsed.map((row) => row.submittedAt),
          true,
        ),
      }));
      setBackendAssessment(response.result);
      setStoredSignature(modelSignature);
      setSelectedId(null);
      setError("");
      setMessage(`${parsed.length} scheduler records loaded from ${file.name}.`);
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
    const revision = ++importRevision.current;
    try {
      const parsed = parseGpuTelemetryCsv(await file.text());
      const response = await requestOperationsAssessment<WorkloadAssessment>({
        kind: "compute",
        scenario: model.scenario,
        workloads,
        telemetry: parsed,
      });
      if (revision !== importRevision.current) return;
      setTelemetry(parsed);
      store.importReports[1]((current) => ({
        ...current,
        gpu: buildImportReport(
          "gpu",
          file.name,
          parsed.map((row) => row.timestamp),
          true,
        ),
      }));
      setBackendAssessment(response.result);
      setStoredSignature(modelSignature);
      setError("");
      setMessage(`${parsed.length} GPU telemetry records loaded from ${file.name}.`);
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
      setBackendAssessment(null);
      setWorkloads(buildScenarioWorkloads(model));
      setTelemetry([]);
      store.importReports[1](({ scheduler: _scheduler, gpu: _gpu, ...power }) => power);
      setError("");
      setMessage("Scenario workload set restored.");
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
