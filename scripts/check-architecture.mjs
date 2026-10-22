import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { moduleOwner, solutionBoundaryViolation } from "./solution-boundaries.mjs";

const baselineFile = "scripts/architecture-baseline.json";
const pureOperations = new Set([
  "scenario-engine",
  "battery-dispatch",
  "workload-intelligence",
  "operating-envelope",
  "operations-assurance",
  "analytics",
  "power-balance",
  "canonical-planning",
  "operating-context",
  "connector-adapters",
]);
const failures = [],
  measurements = {},
  dependencies = new Map();
const compilerOptions = ts.parseJsonConfigFileContent(
  ts.readConfigFile("tsconfig.json", ts.sys.readFile).config,
  ts.sys,
  ".",
).options;
function inspect(file) {
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const edges = [];
  dependencies.set(path.resolve(file), edges);
  let maximumFunctionLines = 0;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const module = node.arguments[0].text;
      const resolved = ts.resolveModuleName(module, file, compilerOptions, ts.sys).resolvedModule
        ?.resolvedFileName;
      checkSolutionBoundary(file, resolved);
      if (resolved && !resolved.includes("node_modules")) edges.push(path.resolve(resolved));
      if (file.startsWith("src/features/") && /(?:\.server|\/server\/)/.test(module))
        failures.push(`${file}: feature dynamically imports server implementation ${module}`);
    }
    if (
      ts.isTypeReferenceNode(node) &&
      node.typeName.getText(ast) === "ReturnType" &&
      node.typeArguments?.some((argument) => /typeof use[A-Z]/.test(argument.getText(ast)))
    )
      failures.push(`${file}: contract depends on hook implementation`);
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node)) &&
      node.body
    )
      maximumFunctionLines = Math.max(
        maximumFunctionLines,
        ast.getLineAndCharacterOfPosition(node.end).line -
          ast.getLineAndCharacterOfPosition(node.getStart(ast)).line +
          1,
      );
    if (ts.isImportDeclaration(node) || (ts.isExportDeclaration(node) && node.moduleSpecifier)) {
      const module = node.moduleSpecifier.text;
      checkSolutionBoundary(
        file,
        ts.resolveModuleName(module, file, compilerOptions, ts.sys).resolvedModule
          ?.resolvedFileName,
      );
      const bindings = node.importClause?.namedBindings ?? node.exportClause;
      const typeOnly =
        node.importClause?.isTypeOnly ||
        node.isTypeOnly ||
        (bindings &&
          (ts.isNamedImports(bindings) || ts.isNamedExports(bindings)) &&
          !node.importClause?.name &&
          bindings.elements.every((element) => element.isTypeOnly));
      if (!typeOnly) {
        const resolved = ts.resolveModuleName(module, file, compilerOptions, ts.sys).resolvedModule
          ?.resolvedFileName;
        if (resolved && !resolved.includes("node_modules")) edges.push(path.resolve(resolved));
      }
      const isDomain =
        file.startsWith("src/features/operations/") &&
        pureOperations.has(path.basename(file, ".ts"));
      if (
        isDomain &&
        /^(react|@tanstack\/|.*integrations\/|.*routes\/|.*server\/|.*-api$)/.test(module)
      )
        failures.push(`${file}: domain imports infrastructure ${module}`);
      if (!file.includes(".test.") && file.startsWith("src/server/") && module === "react")
        failures.push(`${file}: server imports React`);
      if (
        /(?:\.server|\/server\/)/.test(module) &&
        /src\/features\//.test(file) &&
        !node.importClause?.isTypeOnly
      )
        failures.push(`${file}: feature imports a server-only module`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  measurements[file] = { lines: source.split(/\r?\n/).length, maximumFunctionLines };
}
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) walk(file);
    else if (/\.tsx?$/.test(file) && !/\.test\.|\.gen\.|integrations\/supabase\/types/.test(file))
      inspect(file);
  }
}
walk("src");
// Follow neutral adapters too, so domain -> lib -> other domain cannot evade the boundary.
for (const [source] of dependencies) {
  if (!["planning", "operations", "shared"].includes(moduleOwner(path.relative(".", source))))
    continue;
  const seen = new Set();
  function trace(file) {
    if (seen.has(file)) return;
    seen.add(file);
    checkSolutionBoundary(path.relative(".", source).replaceAll("\\", "/"), file);
    for (const next of dependencies.get(file) ?? []) trace(next);
  }
  trace(source);
}
function checkSolutionBoundary(from, resolved) {
  if (!resolved || resolved.includes("node_modules")) return;
  const to = path.relative(".", path.resolve(resolved)).replaceAll("\\", "/");
  if (solutionBoundaryViolation(from, to))
    failures.push(`${from}: crosses solution ownership into ${to}`);
}
const visited = new Set(),
  visiting = new Set();
function checkCycles(file, stack = []) {
  if (visiting.has(file)) {
    failures.push(
      `Runtime import cycle: ${[...stack.slice(stack.indexOf(file)), file].map((value) => path.relative(".", value)).join(" -> ")}`,
    );
    return;
  }
  if (visited.has(file)) return;
  visiting.add(file);
  for (const next of dependencies.get(file) ?? []) checkCycles(next, [...stack, file]);
  visiting.delete(file);
  visited.add(file);
}
for (const file of dependencies.keys()) checkCycles(file);
if (process.argv.includes("--write-baseline")) {
  fs.writeFileSync(baselineFile, JSON.stringify(measurements, null, 2) + "\n");
} else {
  const baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8"));
  for (const [file, size] of Object.entries(measurements)) {
    const previous = baseline[file] ?? { lines: 500, maximumFunctionLines: 300 };
    if (size.lines > Math.max(previous.lines, 500) + 20)
      failures.push(`${file}: module grew beyond its ratchet (${size.lines} lines)`);
    if (size.maximumFunctionLines > Math.max(previous.maximumFunctionLines, 300) + 10)
      failures.push(
        `${file}: function grew beyond its ratchet (${size.maximumFunctionLines} lines)`,
      );
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Architecture boundaries and complexity ratchet passed for ${Object.keys(measurements).length} modules.`,
  );
