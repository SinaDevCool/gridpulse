import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __GRIDPULSE_PRODUCT_MODE__: JSON.stringify("finder"),
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: { reporter: ["text", "html"] },
  },
});
