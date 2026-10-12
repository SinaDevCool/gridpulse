/** Order-preserving stylesheet extraction. Never merges non-adjacent cascade rules. */
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";

const tasks = JSON.parse(process.argv[2]);
for (const task of tasks) {
  const text = fs.readFileSync(task.source, "utf8");
  const root = postcss.parse(text);
  // Only adjacent identical rules can be removed without changing cascade ordering.
  let removed = 0;
  for (const container of [
    root,
    ...root.nodes.filter((node) => node.type === "atrule" && node.nodes),
  ]) {
    for (let index = container.nodes.length - 1; index > 0; index--) {
      const current = container.nodes[index],
        previous = container.nodes[index - 1];
      if (
        current.type === "rule" &&
        previous.type === "rule" &&
        current.toString().trim() === previous.toString().trim()
      ) {
        previous.remove();
        removed++;
      }
    }
  }
  const groups = [];
  let current = { title: "foundation", nodes: [], lines: 0 };
  for (const node of root.nodes) {
    const size = node.toString().split(/\r?\n/).length;
    if (
      current.nodes.length &&
      ((node.type === "comment" && current.lines >= 250) || current.lines + size > 1200)
    ) {
      groups.push(current);
      current = {
        title: node.type === "comment" ? node.text : "continuation",
        nodes: [],
        lines: 0,
      };
    }
    current.nodes.push(node);
    current.lines += size;
  }
  if (current.nodes.length) groups.push(current);
  fs.mkdirSync(task.directory, { recursive: true });
  const imports = [];
  groups.forEach((group, index) => {
    const slug = group.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 60)
      .replace(/-$/, "");
    const file = path.join(task.directory, `${String(index).padStart(2, "0")}-${slug}.css`);
    if (fs.existsSync(file)) throw new Error(`Refusing to overwrite ${file}`);
    fs.writeFileSync(file, group.nodes.map((node) => node.toString()).join("\n\n") + "\n");
    let relative = path.relative(path.dirname(task.source), file).replaceAll("\\", "/");
    if (!relative.startsWith(".")) relative = "./" + relative;
    imports.push(`@import ${JSON.stringify(relative)};`);
  });
  // All meaningful AST nodes must be retained in precisely the original order.
  const expected = root.nodes.map((node) => node.toString().trim());
  const actual = groups.flatMap((group) => group.nodes.map((node) => node.toString().trim()));
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error("Cascade order changed");
  fs.writeFileSync(
    task.source,
    "/* Ordered compatibility manifest: preserve cross-feature cascade precedence. */\n" +
      imports.join("\n") +
      "\n",
  );
  console.log(
    `${task.source}: ${groups.length} owned sections; ${removed} identical adjacent rules removed`,
  );
}
