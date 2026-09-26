import { chromium } from "playwright";

const baseUrl = (process.env.GRIDPULSE_HEALTH_BASE_URL ?? "https://gridpulseinsights.com").replace(
  /\/$/,
  "",
);
const screenshotPath =
  process.env.GRIDPULSE_MAP_FAILURE_SCREENSHOT ?? "test-results/production-map-failure.png";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const failures = [];
const mapResponses = { grid: false, registry: false, basemap: false };

page.on("requestfailed", (request) => {
  failures.push(`${request.failure()?.errorText ?? "request failed"}: ${request.url()}`);
});
page.on("response", (response) => {
  const url = response.url();
  if (response.status() >= 400) failures.push(`HTTP ${response.status()}: ${url}`);
  if (url.includes("tiles.openfreemap.org")) mapResponses.basemap = true;
  if (url.includes("/api/power-finder/tile/") && url.includes("content=grid")) {
    mapResponses.grid = response.ok();
  }
  if (url.includes("/api/power-finder/tile/") && url.includes("content=registry")) {
    mapResponses.registry = response.ok();
  }
});

try {
  await page.goto(`${baseUrl}/power-finder`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator(".maplibregl-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await page.getByText("Loading map context…").waitFor({ state: "detached", timeout: 30_000 });
  await page.waitForFunction(
    () =>
      document.querySelector(".power-finder-stage")?.getAttribute("data-basemap-status") !==
      "loading",
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(5_000);

  const result = await page.evaluate(() => {
    const canvas = document.querySelector(".maplibregl-canvas");
    const box = canvas?.getBoundingClientRect();
    return {
      basemapStatus: document
        .querySelector(".power-finder-stage")
        ?.getAttribute("data-basemap-status"),
      gridStatus: document
        .querySelector(".power-finder-stage")
        ?.getAttribute("data-grid-source-status"),
      registryStatus: document
        .querySelector(".power-finder-stage")
        ?.getAttribute("data-registry-source-status"),
      canvasWidth: Math.round(box?.width ?? 0),
      canvasHeight: Math.round(box?.height ?? 0),
      startupMs: Math.round(
        performance.getEntriesByName("gridpulse-map-startup").at(-1)?.duration ?? 0,
      ),
    };
  });
  if (result.canvasWidth < 300 || result.canvasHeight < 300) {
    throw new Error(`map canvas is not usable: ${result.canvasWidth}x${result.canvasHeight}`);
  }
  if (result.gridStatus !== "ready") throw new Error(`grid source is ${result.gridStatus}`);
  if (result.registryStatus !== "ready") {
    throw new Error(`registry source is ${result.registryStatus}`);
  }
  const observedSources = {
    basemap: mapResponses.basemap || result.basemapStatus === "ready",
    grid: mapResponses.grid || result.gridStatus === "ready",
    registry: mapResponses.registry || result.registryStatus === "ready",
  };
  for (const [source, loaded] of Object.entries(observedSources)) {
    if (!loaded) throw new Error(`${source} map resources did not load`);
  }
  if (failures.length) throw new Error(failures.join("\n"));
  console.log(
    JSON.stringify(
      { status: "pass", base_url: baseUrl, ...result, mapResponses, observedSources },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => undefined);
  console.error(
    JSON.stringify(
      {
        status: "fail",
        base_url: baseUrl,
        error: error instanceof Error ? error.message : String(error),
        failures,
        screenshot: screenshotPath,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
