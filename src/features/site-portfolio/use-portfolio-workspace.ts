import { anonymousPropertyToDecisionRow } from "@/features/anonymous-workspace/portfolio-projection";
import { buildPortfolioIntelligence } from "@/features/grid-connection/portfolio-intelligence";
import { portfolioExportRow } from "@/features/site-portfolio/portfolio-export";
import { useSitePortfolio } from "@/features/site-portfolio/use-site-portfolio";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useRef } from "react";
export function usePortfolioWorkspace(): import("./workspace-contract").PortfolioWorkspaceContract {
  const navigate = useNavigate();
  const search = useSearch({ from: "/portfolio" });
  const restoreInput = useRef<HTMLInputElement>(null);
  const {
    properties,
    summaries,
    loading,
    error,
    refresh,
    metrics,
    selectedSite: selected,
  } = useSitePortfolio(search.selected);
  const activeView = search.view ?? "pipeline";
  const importOpen = search.import === "open";
  const visible = useMemo(() => {
    const needle = (search.q ?? "").trim().toLocaleLowerCase();
    return summaries
      .filter((site) => {
        const queryMatch =
          !needle ||
          [site.name, site.locationLabel, site.operator, site.projectType, site.nextAction]
            .filter(Boolean)
            .some((value) => String(value).toLocaleLowerCase().includes(needle));
        const stageMatch =
          !search.stage ||
          search.stage === "all" ||
          (search.stage === "action_required"
            ? site.blockers.length > 0
            : site.stage === search.stage);
        const decisionMatch =
          !search.decision || search.decision === "all" || site.decisionStatus === search.decision;
        return queryMatch && stageMatch && decisionMatch;
      })
      .sort((left, right) => {
        if (search.sort === "name") return left.name.localeCompare(right.name);
        if (search.sort === "mw") return right.requiredMw - left.requiredMw;
        if (search.sort === "updated")
          return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
        return (
          Number(right.decisionStatus === "unreviewed") -
            Number(left.decisionStatus === "unreviewed") ||
          right.blockers.length - left.blockers.length ||
          right.requiredMw - left.requiredMw
        );
      });
  }, [search, summaries]);
  const patchSearch = (patch: Partial<typeof search>) =>
    void navigate({ to: "/portfolio", search: { ...search, ...patch }, replace: true });
  const decisionRows = useMemo(() => {
    const permittedIds = new Set(
      summaries
        .filter(
          (site) =>
            !search.decision ||
            search.decision === "all" ||
            site.decisionStatus === search.decision,
        )
        .map((site) => site.id),
    );
    return properties
      .filter((property) => permittedIds.has(property.id))
      .map(anonymousPropertyToDecisionRow);
  }, [properties, search.decision, summaries]);
  const intelligence = useMemo(
    () =>
      buildPortfolioIntelligence(decisionRows, {
        operator: search.operator ?? "all",
        risk: search.risk ?? "all",
        sort: search.sort === "name" || search.sort === "mw" ? search.sort : "urgency",
      }),
    [decisionRows, search.operator, search.risk, search.sort],
  );
  const scopedIds = useMemo(
    () => new Set(intelligence.rows.map((row) => row.site_id)),
    [intelligence.rows],
  );
  const decisionSites = useMemo(
    () => summaries.filter((site) => scopedIds.has(site.id)),
    [scopedIds, summaries],
  );
  const exportIds = useMemo(
    () => new Set((search.view === "pipeline" ? visible : decisionSites).map((site) => site.id)),
    [decisionSites, search.view, visible],
  );
  const exportRows = useMemo(
    () =>
      properties
        .filter((property) => exportIds.has(property.id))
        .map(portfolioExportRow)
        .filter((row) => row != null),
    [exportIds, properties],
  );
  const filtersActive = Boolean(
    search.q ||
    (search.stage && search.stage !== "all") ||
    (search.decision && search.decision !== "all") ||
    (search.sort && search.sort !== "priority") ||
    (search.risk && search.risk !== "all") ||
    search.operator,
  );
  return {
    navigate,
    search,
    restoreInput,
    summaries,
    loading,
    error,
    refresh,
    metrics,
    selected,
    activeView,
    importOpen,
    visible,
    patchSearch,
    intelligence,
    decisionSites,
    exportRows,
    filtersActive,
  };
}
