export type ProductLifecycleStage =
  | "discover"
  | "qualify"
  | "prepare"
  | "engage"
  | "decide"
  | "learn";

export function lifecycleStageForLocation(
  pathname: string,
  view: string | null,
): ProductLifecycleStage | null {
  if (pathname === "/power-finder") return "discover";
  if (pathname.startsWith("/pilot-case") || pathname === "/reports") return "learn";
  if (pathname.startsWith("/submission-package")) return "engage";
  if (pathname === "/evidence") return "prepare";
  if (pathname === "/portfolio" || pathname === "/assessments/new") return "qualify";
  if (!pathname.startsWith("/assessments/")) return null;
  if (view && ["documents", "evidence", "profile"].includes(view)) return "prepare";
  if (view && ["operator", "execution"].includes(view)) return "engage";
  if (view && ["report", "scenarios", "envelopes", "activity"].includes(view)) return "decide";
  return "qualify";
}
