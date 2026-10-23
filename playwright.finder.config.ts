import { defineConfig, devices } from "@playwright/test";
import { ownedFiles } from "./scripts/e2e-manifest.mjs";
import { reportSettings } from "./tests/playwright-settings";

const externalBaseUrl = process.env.FINDER_BASE_URL;

export default defineConfig({
  ...reportSettings,
  testDir: "./tests",
  testMatch: ownedFiles(["finder"]).map((file) => `**/${file.slice(6)}`),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:3003",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: process.env.GRIDPULSE_TEST_COMPILED
          ? "npx wrangler dev --config dist/server/wrangler.json --local --ip 127.0.0.1 --port 3003 --inspector-port 9233 --log-level warn"
          : "npm run dev -- --force --mode finder --port 3003",
        url: "http://127.0.0.1:3003/power-finder",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [{ name: "finder-chromium", use: { ...devices["Desktop Chrome"] } }],
});
