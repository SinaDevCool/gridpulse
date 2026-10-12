import fs from "node:fs";
import ts from "typescript";
const dir = "src/features/grid-connection/strategy";
for (const name of fs.readdirSync(dir).filter((n) => n.startsWith("repository-"))) {
  const file = `${dir}/${name}`;
  let text = fs.readFileSync(file, "utf8");
  text = text.replace(
    /import\("(?:[^"\n]*GridPulse-Full\/src\/|src\/)([^"\n]+)"\)/g,
    'import("@/$1")',
  );
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const client = `${dir}/${name.replace("repository-", "")}`;
  let caller = fs.readFileSync(client, "utf8");
  for (const fn of ast.statements.filter(ts.isFunctionDeclaration)) {
    const table = fn.body.getText(ast).match(/\.from\("([^"]+)"\)/)?.[1];
    const action = fn.body.getText(ast).match(/\.(insert|update|select|delete)\(/)?.[1];
    const newName =
      action +
      table
        .split("_")
        .map((s) => s[0].toUpperCase() + s.slice(1))
        .join("") +
      fn.name.text.replace("query", "");
    text = text.replace(new RegExp(`\\b${fn.name.text}\\b`, "g"), newName);
    caller = caller.replace(
      new RegExp(`strategyQueries\\.${fn.name.text}\\b`, "g"),
      `strategyQueries.${newName}`,
    );
  }
  fs.writeFileSync(file, text);
  fs.writeFileSync(client, caller);
}
