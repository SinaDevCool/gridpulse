import { defineConfig } from "@playwright/test";

const externalBaseUrl = process.env.GRIDPULSE_E2E_BASE_URL;

/** Test the compiled Worker, not the Vite-to-Miniflare development proxy. Build first. */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "operations-runtime-contracts.spec.ts",
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: externalBaseUrl ?? "http://127.0.0.1:3004", trace: "retain-on-failure" },
  webServer: externalBaseUrl
    ? undefined
    : {
        command:
          "npx wrangler dev --config dist/server/wrangler.json --local --ip 127.0.0.1 --port 3004 --inspector-port 9234 --log-level warn",
        url: "http://127.0.0.1:3004/",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
