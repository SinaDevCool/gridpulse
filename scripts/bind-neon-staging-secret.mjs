// Compatibility entry point. Qualification and binding have one implementation.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export { validateReaderUri, qualifyReader } from "./neon-finder-deployment.mjs";
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.env.FINDER_DEPLOYMENT_ENVIRONMENT = "staging";
  await import("./bind-neon-finder-secret.mjs");
}
