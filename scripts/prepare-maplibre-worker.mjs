import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];
const destinationDirectory = resolve(root, "public/assets");

await mkdir(destinationDirectory, { recursive: true });
for (const asset of assets) {
  const source = resolve(root, "node_modules/maplibre-gl/dist", asset);
  const destination = resolve(destinationDirectory, asset);
  await copyFile(source, destination);
  console.log(`Prepared ${destination}`);
}
