import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.FINDER_BASE_URL;

export default defineConfig({
  testDir: "./tests/finder-e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:3003",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run dev -- --mode finder --port 3003",
        url: "http://127.0.0.1:3003/power-finder",
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [{ name: "finder-chromium", use: { ...devices["Desktop Chrome"] } }],
});
