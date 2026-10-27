// Production-only server secret installation. Never write credentials to an artifact or CLI argument.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const provider = process.env.COPILOT_PROVIDER || "openai";
if (!["openai", "meta"].includes(provider)) throw new Error("Unsupported copilot provider.");
const keyName = provider === "meta" ? "META_API_KEY" : "OPENAI_API_KEY";
const key = process.env[keyName];
const model = process.env.COPILOT_MODEL || (provider === "openai" ? "gpt-4o-mini" : "muse-spark-1.3");
const base = process.env.COPILOT_ANALYTICS_URL;
if (!key || !base) throw new Error("Production copilot credentials/configuration missing.");
const url = new URL(base);
if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
  throw new Error("Trusted analytics URL must be HTTPS without credentials or query parameters.");
const fallback = process.env.COPILOT_FALLBACK_PROVIDER || "";
const fallbackSecrets = {};
if (fallback && fallback !== provider) {
  if (!["meta", "openai"].includes(fallback)) throw new Error("Unsupported fallback provider.");
  const fallbackKey = fallback === "meta" ? "META_API_KEY" : "OPENAI_API_KEY";
  if (!process.env[fallbackKey]) throw new Error("Configured fallback credential missing.");
  Object.assign(fallbackSecrets, { [fallbackKey]: process.env[fallbackKey] });
}
const installation = spawnSync(process.execPath, [resolve("node_modules/wrangler/bin/wrangler.js"),
  "secret", "bulk", "--config", "dist/server/wrangler.json"], {
  input: JSON.stringify({ ...fallbackSecrets, [keyName]: key,
    COPILOT_FALLBACK_PROVIDER: fallback,
    COPILOT_FALLBACK_MODEL: process.env.COPILOT_FALLBACK_MODEL || (fallback === "meta" ? "muse-spark-1.3" : "gpt-4o-mini"),
    COPILOT_PROVIDER: provider, COPILOT_ANALYTICS_URL: base,
    COPILOT_ENABLED: "true", COPILOT_MODEL: model }),
  encoding: "utf8", timeout: 120_000, windowsHide: true,
});
if (installation.status !== 0) throw new Error("Production copilot secret installation failed. No credential output retained.");
console.log("Production copilot server secrets configured.");
