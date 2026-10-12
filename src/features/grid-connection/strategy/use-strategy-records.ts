import type { OperatorPackage, ProjectSiteCandidate } from "@/lib/assessment-model";
import { useQuery } from "@tanstack/react-query";
import { type Props } from "./contracts";
import { operatorEngagementRecordSchema, pilotMetricRecordSchema } from "./record-contracts";
import * as strategyQueries from "./repository-use-strategy-controller";

export function useStrategyRecords(site: Props["site"]) {
  const { data: strategyRecords, refetch: refetchStrategyRecords } = useQuery({
    queryKey: ["connection-strategy-records", site.id],
    queryFn: async () => {
      const [candidateResponse, packageResponse, metricResponse, engagementResponse] =
        await Promise.all([
          strategyQueries.listSiteCandidates(site),
          strategyQueries.listOperatorPackages(site),
          strategyQueries.listPilotMetrics(site),
          strategyQueries.readOperatorEngagement(site),
        ]);
      if (candidateResponse.error) throw candidateResponse.error;
      if (packageResponse.error) throw packageResponse.error;
      if (metricResponse.error) throw metricResponse.error;
      if (engagementResponse.error) throw engagementResponse.error;
      return {
        candidates: candidateResponse.data as ProjectSiteCandidate[],
        packages: packageResponse.data as OperatorPackage[],
        metrics: pilotMetricRecordSchema.array().parse(metricResponse.data ?? []),
        engagement: operatorEngagementRecordSchema.nullable().parse(engagementResponse.data),
      };
    },
  });
  return { strategyRecords, refetchStrategyRecords };
}
