import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __GRIDPULSE_SOLUTIONS__: JSON.stringify("all"),
    __GRIDPULSE_PRODUCT_MODE__: JSON.stringify("finder"),
  },
  test: {
    // Explicit opt-in is required for any higher-concurrency run.
    maxWorkers: 2,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: { reporter: ["text", "html"] },
  },
});
