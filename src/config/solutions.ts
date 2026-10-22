import { parseEnabledSolutions } from "./solution-availability";
export { parseEnabledSolutions, type SolutionId } from "./solution-availability";
import type { SolutionId } from "./solution-availability";
/** Business solutions are independent of legacy deployment/demo modes and user permissions. */
export const solutions = [
  {
    id: "planning",
    label: "Site Selection",
    description: "Evaluate locations and grid-connection options",
    audience: "Developers, investors and site-selection advisers",
    to: "/power-finder",
    introduction: "/solutions/site-selection",
  },
  {
    id: "operations",
    label: "Facility Operations",
    description: "Assess power, battery and workload decisions",
    audience: "Data-centre energy and operations managers",
    to: "/operations",
    introduction: "/solutions/facility-operations",
  },
] as const;
export const enabledSolutions = parseEnabledSolutions(__GRIDPULSE_SOLUTIONS__);

function within(path: string, root: string) {
  return path === root || path.startsWith(`${root}/`);
}

/** null means platform-owned, not a default assignment to Site Selection. */
export function solutionOwner(pathname: string): SolutionId | null {
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    /* Router rejects malformed paths. */
  }
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (["/operations", "/api/operations", "/constraint-explorer"].some((root) => within(path, root)))
    return "operations";
  if (path === solutions[1].introduction) return "operations";
  if (path === solutions[0].introduction) return "planning";
  if (
    [
      "/power-finder",
      "/portfolio",
      "/workspaces",
      "/capacity-dossiers",
      "/api/power-finder",
      "/api/properties",
      "/api/forecasts/grid-stress",
      "/synthetic-network-study",
      "/data-centre-planner",
      "/activation",
      "/evidence",
      "/evidence-review",
      "/reports",
    ].some((root) => within(path, root))
  )
    return "planning";
  return null;
}

export function solutionForPath(pathname: string) {
  const id = solutionOwner(pathname) ?? enabledSolutions[0];
  return solutions.find((solution) => solution.id === id)!;
}

export function solutionRouteAvailable(pathname: string, available = enabledSolutions) {
  const owner = solutionOwner(pathname);
  return owner === null || available.includes(owner);
}
