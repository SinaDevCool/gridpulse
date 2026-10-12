import { lazy } from "react";

export const PowerFinderCandidateDetail = lazy(() =>
  import("@/components/product/PowerFinderCandidateDetail").then((module) => ({
    default: module.PowerFinderCandidateDetail,
  })),
);

export const PowerFinderMap = lazy(() =>
  import("@/components/product/PowerFinderMap").then((module) => ({
    default: module.PowerFinderMap,
  })),
);

export const InteractiveMapLegend = lazy(() =>
  import("@/components/product/InteractiveMapLegend").then((module) => ({
    default: module.InteractiveMapLegend,
  })),
);

export const ActivationStudyPanel = lazy(() =>
  import("@/components/product/ActivationStudyPanel").then((module) => ({
    default: module.ActivationStudyPanel,
  })),
);
