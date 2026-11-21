import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function verifyBatch(bytes, expectedHash) {
  if (digest(bytes) !== expectedHash) throw new Error("Backup batch hash mismatch");
  const rows = JSON.parse(bytes.toString("utf8"));
  if (
    !Array.isArray(rows) ||
    rows.length > 5000 ||
    rows.some((row) => !row.id || !/^[a-f0-9]{64}$/.test(row.row_sha256))
  )
    throw new Error("Invalid backup rows");
  return rows;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action, file] = process.argv.slice(2);
  if (action !== "seal-batch" || !file) throw new Error("Use seal-batch <JSON file>");
  const bytes = await readFile(file);
  const rows = verifyBatch(bytes, digest(bytes));
  const metadata = {
    file: resolve(file),
    sha256: digest(bytes),
    bytes: bytes.length,
    records: rows.length,
    first: rows[0]?.cursor,
    last: rows.at(-1)?.cursor,
  };
  await mkdir(dirname(file), { recursive: true });
  await writeFile(`${file}.sha256.json`, JSON.stringify(metadata, null, 2), { flag: "wx" });
  console.log(JSON.stringify(metadata));
}
