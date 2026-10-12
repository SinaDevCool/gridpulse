/** TypeScript's own import organizer; accepts only explicit task-owned paths. */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile).config;
const parsed = ts.parseJsonConfigFileContent(config, ts.sys, process.cwd());
const host = {
  getScriptFileNames: () => parsed.fileNames,
  getScriptVersion: () => "0",
  getScriptSnapshot: (file) =>
    fs.existsSync(file) ? ts.ScriptSnapshot.fromString(fs.readFileSync(file, "utf8")) : undefined,
  getCurrentDirectory: () => process.cwd(),
  getCompilationSettings: () => parsed.options,
  getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
};
const service = ts.createLanguageService(host);
const files = [];
function add(file) {
  if (fs.statSync(file).isDirectory())
    for (const child of fs.readdirSync(file)) add(path.join(file, child));
  else if (/\.tsx?$/.test(file) && !file.includes(".test.")) files.push(path.resolve(file));
}
process.argv.slice(2).forEach(add);
for (const file of files)
  for (const change of service.organizeImports({ type: "file", fileName: file }, {}, {})) {
    let text = fs.readFileSync(change.fileName, "utf8");
    for (const edit of [...change.textChanges].reverse())
      text =
        text.slice(0, edit.span.start) +
        edit.newText +
        text.slice(edit.span.start + edit.span.length);
    fs.writeFileSync(change.fileName, text);
  }
