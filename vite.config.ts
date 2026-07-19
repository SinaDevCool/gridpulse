import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { execSync } from "node:child_process";

function buildRevision() {
  if (process.env.GRIDPULSE_BUILD_SHA) return process.env.GRIDPULSE_BUILD_SHA;
  try {
    const revision = execSync("git rev-parse --short=12 HEAD", { encoding: "utf8" }).trim();
    const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim();
    return `${revision}${dirty ? "-dirty" : ""}`;
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  define: {
    __GRIDPULSE_BUILD_SHA__: JSON.stringify(buildRevision()),
    __GRIDPULSE_BUILD_ENV__: JSON.stringify(process.env.GRIDPULSE_BUILD_ENV ?? "production"),
  },
  resolve: { tsconfigPaths: true },
  server: { host: "127.0.0.1", port: 3000 },
});
