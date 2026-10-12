export type AssessmentLifecycle = "ready" | "loading" | "stale" | "failed" | "cancelled";
/** Cache data stays usable only for the same input identity; refresh is explicitly stale. */
export function assessmentLifecycle(input: {
  hasResult: boolean;
  fetching: boolean;
  failed: boolean;
  cancelled: boolean;
}): AssessmentLifecycle {
  if (input.cancelled) return "cancelled";
  if (input.failed) return "failed";
  if (input.fetching) return input.hasResult ? "stale" : "loading";
  return input.hasResult ? "ready" : "loading";
}
