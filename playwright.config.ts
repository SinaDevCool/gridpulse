import { defineConfig, devices } from "@playwright/test";
import { ownedFiles } from "./scripts/e2e-manifest.mjs";
import { reportSettings } from "./tests/playwright-settings";
import { resolve } from "node:path";

const externalBaseUrl = process.env.GRIDPULSE_E2E_BASE_URL;

export default defineConfig({
  ...reportSettings,
  testDir: "./tests",
  testMatch: ownedFiles(["operations", "shared", "legacy"]).map((file) => `**/${file.slice(6)}`),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:3002",
    // Existing regression specs explicitly exercise the retained scenario product.
    // MILP journey checks override this preference in a fresh browser context.
    storageState: { cookies: [], origins: [{ origin: new URL(externalBaseUrl ?? "http://127.0.0.1:3002").origin,
      localStorage: [{ name: "gridpulse-calculator", value: "scenario" }] }] },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: process.env.GRIDPULSE_TEST_COMPILED
          ? `npx wrangler dev --config dist/server/wrangler.json --local --persist-to "${resolve(".wrangler/test-state/operations")}" --ip 127.0.0.1 --port 3002 --inspector-port 9232 --log-level warn`
          : "npm run dev -- --mode e2e --port 3002",
        // Shared entry exists in finder/full and both single-solution deployments.
        url: "http://127.0.0.1:3002/",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [{ name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } }],
});
