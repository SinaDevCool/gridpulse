import type { ReporterDescription } from "@playwright/test";

export const reportSettings = {
  forbidOnly: Boolean(process.env.CI),
  globalTimeout: process.env.CI ? 12 * 60_000 : 20 * 60_000,
  outputDir: process.env.GRIDPULSE_TEST_OUTPUT ?? "test-results/default",
  reporter: (process.env.GRIDPULSE_TEST_REPORT_DIR
    ? [
        ["list"],
        ["html", { outputFolder: `${process.env.GRIDPULSE_TEST_REPORT_DIR}/html`, open: "never" }],
        ["json", { outputFile: `${process.env.GRIDPULSE_TEST_REPORT_DIR}/results.json` }],
      ]
    : [["list"]]) as ReporterDescription[],
};
