import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildRelease5Acceptance } from "../src/features/grid-connection/phase5-operator";

const output = resolve(process.argv[2] ?? "public/power-finder/release5-governance.json");
const acceptance = buildRelease5Acceptance();
if (!acceptance.all_repository_gates_passed) {
  throw new Error("Release 5 acceptance gates did not pass.");
}
const publicManifest = {
  ...acceptance,
  public_visibility: "governance_summary_only",
  private_operator_data_published: false,
  warning:
    "Synthetic operator-engagement rehearsal—not an operator response, operating instruction, connection offer, or mapped capacity result.",
};
const manifestSha256 = createHash("sha256").update(JSON.stringify(publicManifest)).digest("hex");
await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify({ ...publicManifest, manifest_sha256: manifestSha256 }, null, 2)}\n`,
  "utf8",
);
console.log(
  `Validated Release 5 operator control; gates=${Object.values(acceptance.gates).filter(Boolean).length}/${Object.keys(acceptance.gates).length}; report=${manifestSha256.slice(0, 12)}.`,
);
