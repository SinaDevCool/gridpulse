import { useQuery } from "@tanstack/react-query";
import {
fetchOperationsCapabilities,
requestOperationsAssessment,
} from "../../../lib/operations-api";
import { stableOperationsJson } from "../../../lib/operations-request";
import type { OperationsOverviewModel,OperationsScenario } from "../scenario-engine";

/** Query identity is input identity, never response timestamps. Old inputs cannot overwrite new ones. */
export function useOverviewAssessment(scenario: OperationsScenario) {
  const query = useQuery({
    queryKey: ["operations", "overview", stableOperationsJson(scenario)],
    queryFn: async ({ signal }) => {
      const [assessment] = await Promise.all([
        requestOperationsAssessment<OperationsOverviewModel>(
          { kind: "overview", scenario },
          signal,
        ),
        fetchOperationsCapabilities(signal),
      ]);
      return assessment;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
  return {
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
