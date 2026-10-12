import { useQuery, isCancelledError } from "@tanstack/react-query";
import { requestOperationsAssessment } from "../../../lib/operations-api";
import { stableOperationsJson } from "../../../lib/operations-request";
import type { OperationsScenario } from "../scenario-engine";
import { OPERATIONS_CALCULATION_VERSION } from "../calculation-version";
import { assessmentLifecycle } from "../assessment-lifecycle";

/** Query identity is input identity, never response timestamps. Old inputs cannot overwrite new ones. */
export function useOverviewAssessment(scenario: OperationsScenario) {
  const query = useQuery({
    queryKey: [
      "operations",
      "overview",
      OPERATIONS_CALCULATION_VERSION,
      stableOperationsJson(scenario),
    ],
    queryFn: ({ signal }) => requestOperationsAssessment({ kind: "overview", scenario }, signal),
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
