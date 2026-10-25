// Production-only server secret installation. Never write credentials to an artifact or CLI argument.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const key = process.env.OPENAI_API_KEY;
const base = process.env.COPILOT_ANALYTICS_URL;
if (!key || !base) throw new Error("Production copilot credentials/configuration missing.");
const url = new URL(base);
if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
  throw new Error("Trusted analytics URL must be HTTPS without credentials or query parameters.");
const installation = spawnSync(process.execPath, [resolve("node_modules/wrangler/bin/wrangler.js"),
  "secret", "bulk", "--config", "dist/server/wrangler.json"], {
  input: JSON.stringify({ OPENAI_API_KEY: key, COPILOT_ANALYTICS_URL: base,
    COPILOT_ENABLED: "true", COPILOT_MODEL: "gpt-4o-mini" }),
  encoding: "utf8", timeout: 120_000, windowsHide: true,
});
if (installation.status !== 0) throw new Error("Production copilot secret installation failed. No credential output retained.");
console.log("Production copilot server secrets configured.");
