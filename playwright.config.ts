import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.GRIDPULSE_E2E_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/operations-runtime-contracts.spec.ts", "**/solution-runtime-boundary.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:3002",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run dev -- --mode e2e --port 3002",
        // Shared entry exists in finder/full and both single-solution deployments.
        url: "http://127.0.0.1:3002/",
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [{ name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } }],
});
