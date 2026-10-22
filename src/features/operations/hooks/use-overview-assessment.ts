import { useQuery, isCancelledError } from "@tanstack/react-query";
import { requestOperationsAssessment } from "../../../lib/operations-api";
import type { OperationsScenario } from "../scenario-engine";
import { assessmentLifecycle } from "../assessment-lifecycle";
import { useOperationsEvidenceDataStore } from "./evidence-store";
import { buildAssessmentPlan } from "../assessment-plan";
import { useMemo } from "react";
import { assessmentInput, assessmentQueryKey } from "../assessment-input";

/** Query identity is input identity, never response timestamps. Old inputs cannot overwrite new ones. */
export function useOverviewAssessment(scenario: OperationsScenario) {
  const store = useOperationsEvidenceDataStore();
  const [workloads] = store.workloads,
    [telemetry] = store.telemetry;
  const [facility] = store.facility,
    [battery] = store.battery;
  const evidence = useMemo(
    () => ({
      workloads: workloads.filter((workload) => workload.source !== "scenario"),
      telemetry,
      facility,
      battery,
    }),
    [workloads, telemetry, facility, battery],
  );
  const fallbackModel = useMemo(
    () => buildAssessmentPlan(scenario, evidence),
    [scenario, evidence],
  );
  const input = assessmentInput(scenario, evidence);
  const query = useQuery({
    queryKey: assessmentQueryKey(input),
    queryFn: ({ signal }) => requestOperationsAssessment(input, signal),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return {
    lifecycle: assessmentLifecycle({
      hasResult: Boolean(query.data),
      fetching: query.isFetching,
      failed: query.isError,
      cancelled: isCancelledError(query.error),
    }),
    serverModel: query.data?.result ?? null,
    fallbackModel,
    assessmentIdentity: query.data
      ? {
          id: query.data.assessmentId,
          fingerprint: query.data.inputFingerprint,
          generatedAt: query.data.generatedAt,
        }
      : null,
    backendState: query.isError
      ? ("unavailable" as const)
      : query.data
        ? ("verified" as const)
        : ("checking" as const),
  };
}
