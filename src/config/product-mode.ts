export type ProductMode = "finder" | "connect" | "full";

function parseProductMode(value: string): ProductMode {
  return value === "connect" || value === "full" ? value : "finder";
}

export const productMode = parseProductMode(__GRIDPULSE_PRODUCT_MODE__);

export function capabilitiesForMode(mode: ProductMode) {
  return {
    finder: true,
    // Public exploration stays anonymous; authentication is available only when a user
    // chooses to save work into the private property portfolio.
    authentication: true,
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
  "/auth",
  "/portfolio",
  "/assessments/new",
  "/reports",
]);

const finderPrivateRoutePrefixes = [
  "/assessments/",
  "/evidence",
  "/evidence-review",
  "/operator-review/",
  "/submission-package/",
  "/capacity-dossiers/",
];

const finderApiRoutes = new Set([
  "/api/power-finder/viewport",
  "/api/power-finder/study",
  "/api/power-finder/scenario",
]);

export function isRouteEnabledForMode(pathname: string, mode: ProductMode): boolean {
  // Legacy public URLs remain reachable only so their route loaders can redirect safely.
  if (pathname === "/activation" || pathname === "/operations") return true;
  if (mode !== "finder") return true;
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return (
    finderRoutes.has(normalized) ||
    finderApiRoutes.has(normalized) ||
    finderPrivateRoutePrefixes.some((prefix) => normalized.startsWith(prefix))
  );
}

export function isRouteEnabled(pathname: string): boolean {
  return isRouteEnabledForMode(pathname, productMode);
}

export function isFinderMvp(): boolean {
  return productMode === "finder";
}
