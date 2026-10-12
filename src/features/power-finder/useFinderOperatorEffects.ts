import { suggestOperatorFilters } from "@/features/power-finder/site-screening-context";
import { useEffect } from "react";
import type { FinderControllerContract } from "./controller-contract";
type Context = Pick<
  FinderControllerContract,
  | "search"
  | "legacyOperator"
  | "selectedTso"
  | "selectedDso"
  | "updateSearch"
  | "setInteractionNotice"
  | "navigateMapToOperator"
  | "ranking"
  | "operatorCatalog"
  | "operators"
  | "transmissionOperators"
  | "distributionOperators"
  | "candidates"
>;
export function useFinderOperatorEffects(context: Context) {
  const {
    search,
    legacyOperator,
    selectedTso,
    selectedDso,
    updateSearch,
    setInteractionNotice,
    navigateMapToOperator,
    ranking,
    operatorCatalog,
    operators,
    transmissionOperators,
    distributionOperators,
    candidates,
  } = context;
  useEffect(() => {
    const tsoAvailable = transmissionOperators.some((item) => item.name === selectedTso);
    const dsoAvailable = distributionOperators.some((item) => item.name === selectedDso);
    if (selectedTso !== "all" && !tsoAvailable) {
      void updateSearch({
        tso: undefined,
        dso: undefined,
        candidate: undefined,
        compare: undefined,
      });
    } else if (selectedDso !== "all" && !dsoAvailable) {
      void updateSearch({ dso: undefined, candidate: undefined, compare: undefined });
    }
    // updateSearch is a render-local router helper; availability changes are the intended trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distributionOperators, selectedDso, selectedTso, transmissionOperators]);
  useEffect(() => {
    if (search.propertyId) return;
    if (selectedDso !== "all" && operators.some((item) => item.name === selectedDso)) {
      navigateMapToOperator(selectedDso);
    } else if (selectedTso !== "all" && operators.some((item) => item.name === selectedTso)) {
      navigateMapToOperator(selectedTso);
    }
    // URL selection and late catalog hydration should both focus the accepted mapped extent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operators, selectedDso, selectedTso]);
  useEffect(() => {
    if (legacyOperator === "all" || !operators.length) return;
    const legacyType = operators.find((item) => item.name === legacyOperator)?.type;
    void updateSearch({
      operator: undefined,
      tso: legacyType === "TSO" ? legacyOperator : undefined,
      dso: legacyType === "DSO / other" ? legacyOperator : undefined,
    });
    // One-time compatibility migration for shared links from the previous filter contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacyOperator, operators]);
  useEffect(() => {
    if (
      !search.propertyId ||
      search.tso ||
      search.dso ||
      !ranking?.candidates.length ||
      !operatorCatalog.length
    )
      return;
    const suggestion = suggestOperatorFilters(ranking.candidates[0], operatorCatalog);
    if (!suggestion.tso && !suggestion.dso) {
      setInteractionNotice(
        "The site is focused and grid candidates were queried, but no unambiguous mapped operator filter could be suggested. Operator responsibility requires confirmation.",
      );
      return;
    }
    void updateSearch({ tso: suggestion.tso, dso: suggestion.dso });
    const context = [
      suggestion.dso ? `likely DSO ${suggestion.dso}` : null,
      suggestion.tso ? `mapped TSO context ${suggestion.tso}` : null,
    ]
      .filter(Boolean)
      .join(" and ");
    setInteractionNotice(
      `The site is focused and candidates were queried. Filters now show ${context}; this is mapped screening context and requires operator confirmation.`,
    );
    // Only derive context when a saved site has no explicit operator filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorCatalog, ranking?.candidates, search.dso, search.propertyId, search.tso]);
}
