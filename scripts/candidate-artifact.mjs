import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const manifestName = ".ci-candidate.json";
async function inventory(root, folder = root) {
  const files = {};
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Candidate symlinks are not supported");
    if (entry.isDirectory()) Object.assign(files, await inventory(root, path));
    else if (entry.isFile() && path !== join(root, manifestName))
      files[relative(root, path).replaceAll("\\", "/")] = createHash("sha256")
        .update(await readFile(path))
        .digest("hex");
  }
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}
function identity(sha, run) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? "") || !/^\d+-\d+$/.test(run ?? ""))
    throw new Error("A full commit SHA and workflow run-attempt identity are required");
}
export async function sealCandidate(root, sha, run) {
  identity(sha, run);
  const files = await inventory(root);
  if (
    !files["server/wrangler.json"] ||
    !files["server/index.js"] ||
    !Object.keys(files).some((name) => name.startsWith("client/"))
  )
    throw new Error("Candidate must contain the compiled Worker and client assets");
  const manifest = { version: 1, sha, run, files };
  await writeFile(join(root, manifestName), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}
export async function verifyCandidate(root, sha, run) {
  identity(sha, run);
  const manifest = JSON.parse(await readFile(join(root, manifestName), "utf8"));
  if (manifest.version !== 1 || manifest.sha !== sha || manifest.run !== run)
    throw new Error("Candidate identity does not match this SHA and workflow run");
  if (JSON.stringify(manifest.files) !== JSON.stringify(await inventory(root)))
    throw new Error("Candidate contents changed, are missing, or contain unexpected files");
  return manifest;
}
async function main() {
  const [action, folder = "dist"] = process.argv.slice(2);
  const sha = process.env.GITHUB_SHA;
  const run = `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
  const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  if (head.status !== 0 || head.stdout.trim() !== sha)
    throw new Error("Checkout does not match the candidate SHA");
  if (action === "seal") await sealCandidate(resolve(folder), sha, run);
  else if (action === "verify") await verifyCandidate(resolve(folder), sha, run);
  else throw new Error("Use seal or verify");
  console.log(`Candidate ${action}: ${sha} (${run})`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
