import { getAnonymousProperty } from "@/features/anonymous-workspace/repository";
import { type CandidateOpportunity } from "@/features/power-finder/candidate-intelligence";
import { saveFinderProjectToPortfolio } from "@/features/power-finder/property-handoff";
import { withTimeout } from "./page-formatting";
import { persistFinderScreening } from "./screening-persistence";
import { useEffect } from "react";

export function useFinderPersistence({
  propertySaveRequest,
  setPropertySaveStatus,
  setInteractionNotice,
  project,
  activeProperty,
  setActiveProperty,
  search,
  updateSearch,
}: Pick<
  import("./controller-contract").FinderControllerContract,
  | "propertySaveRequest"
  | "setPropertySaveStatus"
  | "setInteractionNotice"
  | "project"
  | "activeProperty"
  | "setActiveProperty"
  | "search"
  | "updateSearch"
>) {
  const identity = JSON.stringify([project, search.propertyId]);
  useEffect(
    () => () => {
      propertySaveRequest.current++;
    },
    [identity, propertySaveRequest],
  );
  const persistScreening = async (
    candidatesToSave: CandidateOpportunity[],
    shortlistedCandidateId: string | null = null,
  ) => {
    const requestId = ++propertySaveRequest.current;
    setPropertySaveStatus("saving");
    setInteractionNotice(
      shortlistedCandidateId ? "Saving shortlisted candidate…" : "Saving screening…",
    );
    try {
      const { propertyId: savedPropertyId, property: refreshed } = await persistFinderScreening(
        {
          save: (...args) =>
            withTimeout(
              saveFinderProjectToPortfolio(...args),
              10_000,
              "Saving took too long. Please try again.",
            ),
          load: (id) =>
            withTimeout(
              getAnonymousProperty(id),
              5_000,
              "The site was saved, but could not be reloaded.",
            ),
        },
        {
          project,
          candidates: candidatesToSave,
          propertyId: activeProperty?.id,
          shortlistedCandidateId,
        },
      );
      if (requestId !== propertySaveRequest.current) return null;
      setActiveProperty(refreshed);
      setPropertySaveStatus("saved");
      setInteractionNotice(
        shortlistedCandidateId
          ? "Candidate shortlisted and saved to the site workspace."
          : "Screening saved to the site workspace.",
      );
      if (search.propertyId !== savedPropertyId) void updateSearch({ propertyId: savedPropertyId });
      return savedPropertyId;
    } catch (reason) {
      if (requestId !== propertySaveRequest.current) return null;
      setPropertySaveStatus("error");
      setInteractionNotice(
        reason instanceof Error ? reason.message : "The screening could not be saved.",
      );
      return null;
    }
  };
  return { persistScreening };
}
