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
let operatorCatalogCount = 0;

page.on("console", (message) => {
  if (message.type() === "error" && /content security policy|connect-src/i.test(message.text())) {
    failures.push(`Browser CSP error: ${message.text()}`);
  }
});

page.on("requestfailed", (request) => {
  const errorText = request.failure()?.errorText ?? "request failed";
  if (errorText === "net::ERR_ABORTED") return;
  failures.push(`${errorText}: ${request.url()}`);
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
  const operatorCatalogResponse = page.waitForResponse(
    (response) => response.url().includes("/rest/v1/rpc/power_finder_public_operators"),
    { timeout: 30_000 },
  );
  await page.goto(`${baseUrl}/power-finder`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const catalogResponse = await operatorCatalogResponse;
  if (!catalogResponse.ok()) {
    throw new Error(`operator catalogue returned HTTP ${catalogResponse.status()}`);
  }
  const operatorCatalog = await catalogResponse.json();
  operatorCatalogCount = Array.isArray(operatorCatalog) ? operatorCatalog.length : 0;
  if (!operatorCatalogCount) throw new Error("operator catalogue returned no records");
  await page.locator(".maplibregl-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await page.getByText("Loading map context…").waitFor({ state: "detached", timeout: 30_000 });
  await page.waitForFunction(
    () =>
      document.querySelector(".power-finder-stage")?.getAttribute("data-basemap-status") !==
      "loading",
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForFunction(
    () => {
      const stage = document.querySelector(".power-finder-stage");
      return ["grid", "registry"].every((source) => {
        const status = stage?.getAttribute(`data-${source}-source-status`);
        return status && status !== "loading";
      });
    },
    undefined,
    { timeout: 60_000 },
  );

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

  await page.goto(
    `${baseUrl}/power-finder?lat=53.22248786642879&lng=8.573712174796157&mw=200&distance=20&preferredVoltage=110`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  const candidates = page.getByRole("button", { name: /Show .* on map, .*\/100/ });
  await candidates.first().waitFor({ state: "visible", timeout: 30_000 });
  await page.getByRole("button", { name: /Show Rönnebeck on map/i }).click();
  let detail = page.locator(".power-finder-detail.open");
  await detail.getByText("DSO", { exact: true }).waitFor({ state: "visible", timeout: 10_000 });

  await page.goto(
    `${baseUrl}/power-finder?lat=53.22248786642879&lng=8.573712174796157&mw=200&distance=20&preferredVoltage=220`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  await page
    .getByRole("button", { name: /Show .* on map, .*\/100/ })
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.getByRole("button", { name: /Show Umspannwerk Neuenkirchen on map/i }).click();
  detail = page.locator(".power-finder-detail.open");
  await detail.getByText("TSO", { exact: true }).waitFor({ state: "visible", timeout: 10_000 });

  if (failures.length) throw new Error(failures.join("\n"));
  console.log(
    JSON.stringify(
      {
        status: "pass",
        base_url: baseUrl,
        ...result,
        mapResponses,
        observedSources,
        operatorCatalogCount,
        operatorRoleChecks: { dso: true, tso: true },
      },
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
