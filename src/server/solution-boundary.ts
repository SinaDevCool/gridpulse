import {
  enabledSolutions,
  solutionOwner,
  solutionRouteAvailable,
  type SolutionId,
} from "../config/solutions";

/** Deployment boundary, not an entitlement check. Existing per-record authorisation still applies. */
export function unavailableSolutionResponse(
  request: Request,
  available: readonly SolutionId[] = enabledSolutions,
) {
  const pathname = new URL(request.url).pathname;
  if (solutionRouteAvailable(pathname, available)) return null;
  return Response.json(
    {
      error: "This solution is not available in this deployment.",
      solution: solutionOwner(pathname),
    },
    { status: 404, headers: { "cache-control": "no-store" } },
  );
}
