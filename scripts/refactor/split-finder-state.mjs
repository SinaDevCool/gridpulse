import fs from "node:fs";
import ts from "typescript";
import { execFileSync } from "node:child_process";
const source = "src/features/power-finder/use-finder-controller.ts";
let text = fs.readFileSync(source, "utf8");
text = `import type { FinderSearch } from './search-contract';\n` + text;
fs.writeFileSync(source, text);
const groups = {
  useFinderProjectState: [
    "project",
    "projectHydrated",
    "saveStatus",
    "shortlistId",
    "propertySaveStatus",
    "activeProperty",
    "propertySaveRequest",
  ],
  useFinderDataState: [
    "collection",
    "error",
    "dataMode",
    "runtimeSourceStatus",
    "ranking",
    "rankingCollection",
    "rankingState",
    "coverage",
    "operatorCatalog",
    "operatorCatalogState",
    "operatorEvidence",
    "operatorEvidenceState",
    "c1Study",
  ],
  useFinderMapState: [
    "enabled",
    "bounds",
    "generationGroup",
    "mapFilters",
    "layersMenuOpen",
    "basemapStatus",
    "mapRetryKey",
    "mapNavigationTarget",
    "visibleLayerCounts",
    "showDataCentres",
    "selectedDataCentre",
  ],
  useFinderDiscoveryState: [
    "finderWorkflow",
    "discoveryStrategy",
    "discoveryResultCount",
    "discoveryResults",
    "selectedDiscoveryId",
    "discoveryState",
  ],
  useFinderCapacityState: [
    "mapMode",
    "capacityMetric",
    "requiredCapacityMw",
    "capacitySource",
    "capacityViewport",
    "berlinCapacity",
    "capacityState",
  ],
  useFinderInteractionState: [
    "selected",
    "selectedOpportunitySnapshot",
    "detailPanelRef",
    "detailReturnFocusRef",
    "showAllCandidates",
    "numericDrafts",
    "fieldErrors",
    "interactionNotice",
    "previewCandidateId",
    "comparisonOpen",
    "projectEditorOpen",
    "secondaryControlsOpen",
    "sidebarOpen",
    "legendOpen",
    "detailDismissedRef",
  ],
};
for (const [hook, names] of Object.entries(groups)) {
  const current = fs.readFileSync(source, "utf8");
  const ast = ts.createSourceFile(source, current, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name.text === "useFinderController",
  );
  const declarations = fn.body.statements
    .filter(ts.isVariableStatement)
    .flatMap((n) => [...n.declarationList.declarations]);
  const selected = declarations.filter((d) =>
    names.includes(
      ts.isArrayBindingPattern(d.name) ? d.name.elements[0].name.text : d.name.getText(ast),
    ),
  );
  const returns = selected.flatMap((d) =>
    ts.isArrayBindingPattern(d.name)
      ? d.name.elements.map((e) => e.name.text)
      : [d.name.getText(ast)],
  );
  const argumentsText = ["useFinderCapacityState", "useFinderInteractionState"].includes(hook)
    ? "search: FinderSearch, project: FinderProject"
    : "search: FinderSearch";
  const callArguments = argumentsText.includes("project:") ? "search, project" : "search";
  const task = {
    source,
    component: "useFinderController",
    target: `src/features/power-finder/${hook}.ts`,
    hook,
    arguments: argumentsText,
    functions: [],
    variables: selected.map((d) => d.name.getText(ast)),
    returns,
    anchor: '  const query = search.q ?? "";',
    call: `  const { ${returns.join(", ")} } = ${hook}(${callArguments});`,
  };
  execFileSync(process.execPath, ["scripts/refactor/extract-hook.mjs", JSON.stringify(task)], {
    stdio: "inherit",
  });
}
