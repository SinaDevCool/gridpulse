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
  "/operations",
  "/synthetic-network-study",
  "/data-sources",
  "/data-centres",
  "/energy-storage",
  "/hydrogen-industry",
  "/portfolio",
  "/workspaces",
]);

const retiredWorkspaceRoots = [
  "/data-centre-planner",
  "/activation",
  "/evidence",
  "/evidence-review",
  "/reports",
] as const;

function matchesRouteRoot(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`);
}

/** Customer-facing stages held outside the focused Sites -> Finder -> Power Operations product. */
export function retiredWorkspaceDestination(pathname: string): string | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (matchesRouteRoot(normalized, "/constraint-explorer")) return "/operations";
  if (normalized.startsWith("/operations/")) return "/operations";
  if (!retiredWorkspaceRoots.some((root) => matchesRouteRoot(normalized, root))) return null;
  if (matchesRouteRoot(normalized, "/reports")) return "/portfolio";
  if (
    matchesRouteRoot(normalized, "/data-centre-planner") ||
    matchesRouteRoot(normalized, "/evidence") ||
    matchesRouteRoot(normalized, "/evidence-review")
  ) {
    return "/power-finder";
  }
  return "/power-finder";
}

const finderApiRoutes = new Set([
  "/api/power-finder/viewport",
  "/api/power-finder/study",
  "/api/power-finder/scenario",
  "/api/forecasts/grid-stress/current",
  "/api/properties/enrich",
]);

export function isRouteEnabledForMode(pathname: string, mode: ProductMode): boolean {
  if (retiredWorkspaceDestination(pathname)) return false;
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
