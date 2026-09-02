import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listAnonymousProperties,
  subscribeAnonymousWorkspace,
} from "@/features/anonymous-workspace/repository";
import type { AnonymousProperty } from "@/features/anonymous-workspace/schema";
import { projectAnonymousProperty } from "@/features/anonymous-workspace/portfolio-projection";

export function useSitePortfolio(selectedId?: string) {
  const [properties, setProperties] = useState<AnonymousProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      setProperties(await listAnonymousProperties());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sites could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return subscribeAnonymousWorkspace(() => void refresh());
  }, [refresh]);
  const summaries = useMemo(() => properties.map(projectAnonymousProperty), [properties]);
  const metrics = useMemo(
    () => ({
      sites: summaries.length,
      declaredMw: summaries.reduce((sum, site) => sum + site.requiredMw, 0),
      actionRequired: summaries.filter((site) => site.blockers.length > 0).length,
      decisionReady: summaries.filter((site) => site.stage === "decision_ready").length,
    }),
    [summaries],
  );
  return {
    properties,
    summaries,
    loading,
    error,
    refresh,
    metrics,
    selectedSite: summaries.find((site) => site.id === selectedId) ?? null,
  };
}
