export type ProductMode = "finder" | "connect" | "full";

function parseProductMode(value: string): ProductMode {
  return value === "connect" || value === "full" ? value : "finder";
}

export const productMode = parseProductMode(__GRIDPULSE_PRODUCT_MODE__);

export function capabilitiesForMode(mode: ProductMode) {
  return {
    finder: true,
    authentication: false,
    workspace: mode !== "finder",
    connect: mode === "connect" || mode === "full",
    operate: mode === "full",
    pilotIntake: mode !== "finder",
  } as const;
}

export const productCapabilities = capabilitiesForMode(productMode);

export const privateGraphUiEnabled =
  productCapabilities.workspace && import.meta.env.VITE_PRIVATE_GRAPH_UI !== "false";

export const integratedActivationStudyEnabled =
  import.meta.env.VITE_INTEGRATED_ACTIVATION_STUDY !== "false";

export const graphStudySubmissionEnabled =
  productCapabilities.workspace && import.meta.env.VITE_GRAPH_STUDY_SUBMISSION === "true";

export const finderContactEmail = "kshitijjindal1@gmail.com";

const finderRoutes = new Set([
  "/",
  "/power-finder",
  "/synthetic-network-study",
  "/data-sources",
  "/data-centres",
  "/energy-storage",
  "/hydrogen-industry",
  "/portfolio",
  "/workspaces",
  "/reports",
]);

const finderApiRoutes = new Set([
  "/api/power-finder/viewport",
  "/api/power-finder/study",
  "/api/power-finder/scenario",
  "/api/properties/enrich",
]);

export function isRouteEnabledForMode(pathname: string, mode: ProductMode): boolean {
  // Legacy public URLs remain reachable only so their route loaders can redirect safely.
  if (pathname === "/activation" || pathname === "/operations") return true;
  if (mode !== "finder") return true;
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return (
    finderRoutes.has(normalized) ||
    finderApiRoutes.has(normalized) ||
    normalized.startsWith("/portfolio/") ||
    normalized.startsWith("/capacity-dossiers/")
  );
}

export function isRouteEnabled(pathname: string): boolean {
  return isRouteEnabledForMode(pathname, productMode);
}

export function isFinderMvp(): boolean {
  return productMode === "finder";
}

/** Central visibility policy for the anonymous data-centre MVP. */
export const finderMvpFeatures = {
  dataCentreOnly: isFinderMvp(),
  syntheticCapacity: !isFinderMvp(),
  activationStudy: !isFinderMvp() && integratedActivationStudyEnabled,
  additionalProjectTypes: !isFinderMvp(),
  operatorPipeline: !isFinderMvp(),
  decisionHistory: true,
  advancedExports: !isFinderMvp(),
  reportBranding: !isFinderMvp(),
} as const;
