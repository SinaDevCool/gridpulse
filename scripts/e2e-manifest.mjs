// One owner per spec. Fast is an overlay, not a second copy of a suite.
export const suites = {
  operations: [
    "activation-operations-ui",
    "operations-canonical-results",
    "compute-visual-workspace",
    "power-battery-workspace",
    "operations-analysis-panel",
    "operations-control-panel",
    "operations-docked-workspace",
    "operations-evidence-foundations",
    "operations-light-theme",
    "operations-linked-inspection",
    "operations-obligations",
    "operations-onboarding-accessibility",
    "operations-redesign-ui",
    "operations-release-controls",
    "operations-results-design",
    "operations-shared-assessment",
    "operations-task-review",
    "operations-window-semantics",
  ].map((name) => `tests/e2e/${name}.spec.ts`),
  finder: [
    "finder-accessibility",
    "finder-mvp",
    "product-foundations",
    "synthetic-network-study",
  ].map((name) => `tests/finder-e2e/${name}.spec.ts`),
  shared: [
    "product-entry",
    "product-navigation",
    "solution-navigation",
    "solution-independence",
  ].map((name) => `tests/shared-e2e/${name}.spec.ts`),
  runtime: ["operations-runtime-contracts", "solution-runtime-boundary"].map(
    (name) => `tests/e2e/${name}.spec.ts`,
  ),
  // Retained, not silently added to production gates: pre-MVP/experimental journeys.
  legacy: [
    "validation-case",
    "unified-product-journey",
    "sites-light-theme",
    "route-payload",
    "public-journey",
    "public-conversion-path",
    "power-finder",
    "power-finder-light-theme",
    "pilot-ready",
    "operator-engagement",
  ].map((name) => `tests/e2e/${name}.spec.ts`),
};
export const fast = [
  "tests/e2e/operations-evidence-foundations.spec.ts",
  "tests/e2e/power-battery-workspace.spec.ts",
  "tests/e2e/operations-shared-assessment.spec.ts",
];
export const configFor = (suite) =>
  suite === "finder"
    ? "playwright.finder.config.ts"
    : suite === "runtime" || suite === "isolation"
      ? "playwright.runtime.config.ts"
      : "playwright.config.ts";
export function suiteFiles(suite) {
  if (suite === "isolation")
    return suites.runtime.filter((file) => file.endsWith("solution-runtime-boundary.spec.ts"));
  if (suite === "fast") return fast;
  if (suite === "operations") return suites.operations.filter((file) => !fast.includes(file));
  if (!suites[suite]) throw new Error(`Unknown browser suite: ${suite}`);
  return suites[suite];
}
export const ownedFiles = (owners) => owners.flatMap((owner) => suites[owner]);
