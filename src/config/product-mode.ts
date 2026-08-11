export type ProductMode = "finder" | "connect" | "full";

function parseProductMode(value: string): ProductMode {
  return value === "connect" || value === "full" ? value : "finder";
}

export const productMode = parseProductMode(__GRIDPULSE_PRODUCT_MODE__);

export function capabilitiesForMode(mode: ProductMode) {
  return {
    finder: true,
    authentication: mode !== "finder",
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
  "/activation",
  "/operations",
  "/synthetic-network-study",
  "/data-sources",
]);

const finderApiRoutes = new Set([
  "/api/power-finder/viewport",
  "/api/power-finder/study",
  "/api/power-finder/scenario",
]);

export function isRouteEnabledForMode(pathname: string, mode: ProductMode): boolean {
  if (mode !== "finder") return true;
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return finderRoutes.has(normalized) || finderApiRoutes.has(normalized);
}

export function isRouteEnabled(pathname: string): boolean {
  return isRouteEnabledForMode(pathname, productMode);
}

export function isFinderMvp(): boolean {
  return productMode === "finder";
}
