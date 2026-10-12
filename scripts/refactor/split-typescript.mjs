/** Mechanical declaration extraction. Original declaration bodies remain unchanged. */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const tasks = JSON.parse(process.argv[2] ?? "[]");
for (const task of tasks) {
  const source = path.resolve(task.source);
  const text = fs.readFileSync(source, "utf8");
  const ast = ts.createSourceFile(source, text, ts.ScriptTarget.Latest, true);
  const imports = ast.statements.filter(ts.isImportDeclaration);
  const declarations = ast.statements.filter((node) => !ts.isImportDeclaration(node));
  const namesOf = (node) =>
    node.name
      ? [node.name.text]
      : ts.isVariableStatement(node)
        ? node.declarationList.declarations
            .filter((d) => ts.isIdentifier(d.name))
            .map((d) => d.name.text)
        : [];
  const owners = new Map(),
    nodes = new Map();
  for (const node of declarations)
    for (const name of namesOf(node)) {
      if (!name) continue;
      nodes.set(name, node);
      const destination = Object.entries(task.groups).find(([, names]) =>
        names.includes(name),
      )?.[0];
      owners.set(name, destination ? path.resolve(destination) : source);
    }
  for (const names of Object.values(task.groups))
    for (const name of names)
      if (!nodes.has(name)) throw new Error(`${source}: declaration ${name} not found`);
  const relative = (from, to) => {
    let result = path
      .relative(path.dirname(from), to)
      .replaceAll("\\", "/")
      .replace(/\.tsx?$/, "");
    return result.startsWith(".") ? result : `./${result}`;
  };
  const identifierNames = (group) => {
    const result = new Set();
    function visit(node) {
      if (ts.isIdentifier(node)) result.add(node.text);
      ts.forEachChild(node, visit);
    }
    group.forEach(visit);
    return result;
  };
  for (const target of new Set([source, ...owners.values()])) {
    if (target !== source && fs.existsSync(target))
      throw new Error(`Refusing to overwrite ${target}`);
    const group = declarations.filter((node) =>
      namesOf(node).some((name) => owners.get(name) === target),
    );
    const identifiers = identifierNames(group);
    const header = [];
    for (const node of imports) {
      const clause = node.importClause;
      if (!clause) {
        if (target === source) header.push(node.getText(ast));
        continue;
      }
      const bindings = clause.namedBindings;
      const defaultName =
        clause.name && identifiers.has(clause.name.text) ? clause.name.text : null;
      const named =
        bindings && ts.isNamedImports(bindings)
          ? bindings.elements.filter((e) => identifiers.has(e.name.text)).map((e) => e.getText(ast))
          : [];
      const namespace =
        bindings && ts.isNamespaceImport(bindings) && identifiers.has(bindings.name.text)
          ? bindings.getText(ast)
          : null;
      if (!defaultName && !named.length && !namespace) continue;
      let module = node.moduleSpecifier.text;
      if (module.startsWith("."))
        module = relative(target, path.resolve(path.dirname(source), module));
      const parts = [
        defaultName,
        namespace || (named.length ? `{ ${named.join(", ")} }` : null),
      ].filter(Boolean);
      header.push(
        `import ${clause.isTypeOnly ? "type " : ""}${parts.join(", ")} from ${JSON.stringify(module)};`,
      );
    }
    const dependencies = new Map();
    for (const name of identifiers)
      if (owners.has(name) && owners.get(name) !== target) {
        const owner = owners.get(name),
          node = nodes.get(name);
        const spec = `${ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node) ? "type " : ""}${name}`;
        dependencies.set(owner, [...(dependencies.get(owner) ?? []), spec]);
      }
    for (const [owner, names] of dependencies)
      header.push(
        `import { ${names.join(", ")} } from ${JSON.stringify(relative(target, owner))};`,
      );
    if (target === source)
      for (const [name, owner] of owners) {
        const node = nodes.get(name);
        if (owner !== source && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
          header.push(
            `export { ${ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node) ? "type " : ""}${name} } from ${JSON.stringify(relative(target, owner))};`,
          );
      }
    const body = group.map((node) => {
      const needsExport = [...dependenciesOfAll()].includes(namesOf(node)[0]);
      const original = node.getText(ast);
      return needsExport && !node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        ? `export ${original}`
        : original;
    });
    function dependenciesOfAll() {
      return [...owners.keys()].filter((name) => {
        const owner = owners.get(name);
        return declarations.some(
          (node) =>
            namesOf(node).some((n) => owners.get(n) !== owner) && identifierNames([node]).has(name),
        );
      });
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, [...header, "", ...body].join("\n\n") + "\n");
    console.log(`${path.relative(process.cwd(), target)}: ${group.length} declarations`);
  }
}
