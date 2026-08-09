import { expect, test } from "@playwright/test";

test("Finder MVP is public and contains no account entry points", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  await page.goto("/power-finder");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("connection context");
  await expect(page.getByRole("navigation", { name: "Finder navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Contact" })).toHaveAttribute(
    "href",
    "mailto:sina.khedmati@outlook.de",
  );
  await expect(page.getByRole("link", { name: "Discuss a site" })).toHaveCount(0);
  await expect(page.getByText(/Sign in|Sign up|Create account/i)).toHaveCount(0);
  await expect(page.getByText(/^Screening only\./i)).toHaveCount(0);
  await expect(page.getByText(/unknown capacity remains unknown/i).first()).toBeVisible();
  await expect(page.getByText("No declared site yet")).toBeVisible();
  await page.getByText("Operator Questions & Report", { exact: true }).click();
  await expect(page.getByRole("button", { name: /Download screening report/i })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Show .* on map, .*\/100/ })).toHaveCount(0);
  expect(requests.some((url) => url.includes("/auth/v1/"))).toBe(false);
  expect(requests.some((url) => url.includes("/rest/v1/rpc/"))).toBe(false);
});

test("Finder landing and methodology are the only public product pages", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Find better starting points/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Power Finder/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Discuss a site" })).toHaveCount(0);

  await page.goto("/data-sources");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("what the map supports");
  await expect(page.getByText(/product tour|start a pilot|review the assessment/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Discuss a site" })).toHaveCount(0);

  for (const pathname of ["/auth", "/portfolio", "/assessments/new", "/reports", "/pilot"]) {
    const response = await page.goto(pathname);
    expect(response?.status(), pathname).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  }
});

test("account-free project screening supports a custom site and BESS requirements", async ({
  page,
}) => {
  await page.goto(
    "/power-finder?lat=52.31&lng=13.36&projectType=battery_storage&mw=50&exportMw=50&distance=20",
  );
  await expect(
    page.getByRole("heading", { name: "Define the site and power requirement" }),
  ).toBeVisible();
  await expect(page.getByLabel("Project type")).toHaveValue("battery_storage");
  await expect(page.getByLabel("Latitude")).toHaveValue("52.31");
  await expect(page.getByLabel("Longitude")).toHaveValue("13.36");
  await expect(page.getByLabel("Import MW")).toHaveValue("50");
  await expect(page.getByLabel("Export MW")).toHaveValue("50");
  await expect(page.getByText(/candidate site-to-node matches/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("Project name").fill("Brandenburg storage screen");
  await expect(page.getByLabel("Project name")).toHaveValue("Brandenburg storage screen");
  await page.getByText("Operator Questions & Report", { exact: true }).click();
  await expect(page.getByText(/What import capacity can be assessed for charging/i)).toBeVisible();
  await expect(
    page.getByText(/What export capacity can be assessed for discharging/i),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Download screening report/i })).toBeEnabled();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("gridpulse-finder-active-project")))
    .toContain("Brandenburg storage screen");
  await page.reload();
  await expect(page.getByLabel("Project name")).toHaveValue("Brandenburg storage screen");
  await page.getByText("Operator Questions & Report", { exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download screening report/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/finder-screening\.pdf$/);
});

test("unsafe coordinates are handled inline and malformed URLs do not crash", async ({ page }) => {
  await page.goto("/power-finder?lat=60&lng=99&mw=2000&projectType=battery_storage");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("connection context");
  await expect(page.getByText("Something went wrong!")).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.has("lat")).toBe(false);
  await page.getByText("Map Layers", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /Registered generation/ })).toBeEnabled({
    timeout: 15_000,
  });
  expect(new URL(page.url()).searchParams.get("lat")).toBeNull();
  expect(new URL(page.url()).searchParams.get("lng")).toBeNull();
  expect(new URL(page.url()).searchParams.get("mw")).toBeNull();
});

test("comparison supports multiple candidates and resets when the site changes", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto(
    "/power-finder?lat=52.31&lng=13.36&projectType=battery_storage&mw=50&exportMw=40",
  );
  await expect(page.getByText(/candidate site-to-node matches/i).first()).toBeVisible();

  const candidates = page.getByRole("button", { name: /Show .* on map, .*\/100/ });
  await candidates.nth(0).click();
  let detail = page.locator(".power-finder-detail.open");
  await expect(detail).toBeVisible({ timeout: 15_000 });
  await detail.getByRole("button", { name: "Add to Comparison" }).click();
  await page.getByRole("button", { name: "Close detail" }).click();
  await candidates.nth(1).click();
  detail = page.locator(".power-finder-detail.open");
  await expect(detail).toBeVisible({ timeout: 15_000 });
  await detail.getByRole("button", { name: "Add to Comparison" }).click();
  await expect(page.getByText("Compare 2 Candidates")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("compare")?.split(",")).toHaveLength(2);

  await page.getByLabel("Latitude").fill("52.32");
  await expect(page.getByText(/Compare \d/)).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("compare")).toBe(false);
  expect(new URL(page.url()).searchParams.has("candidate")).toBe(false);
});

test("registered generation and storage are available without an account", async ({ page }) => {
  await page.goto("/power-finder");
  await page.getByText("Map Layers", { exact: true }).click();
  const generation = page.getByRole("checkbox", { name: /Registered generation/ });
  const storage = page.getByRole("checkbox", { name: /Registered storage/ });
  await expect(generation).toBeEnabled({ timeout: 15_000 });
  await expect(storage).toBeEnabled({ timeout: 15_000 });
  await expect(generation.locator("..")).toContainText(/\d+ in view/);
  await expect(storage.locator("..")).toContainText(/\d+ in view/);
  await generation.check();
  await storage.check();
  await expect(generation).toBeChecked();
  await expect(storage).toBeChecked();
});

test("public MVP excludes experimental capacity and network-study outputs", async ({ page }) => {
  const scenarioRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/power-finder/scenario")) scenarioRequests.push(request.url());
  });
  await page.goto("/power-finder?lat=52.31&lng=13.36&mw=20&distance=20");
  const candidates = page.getByRole("button", { name: /Show .* on map, .*\/100/ });
  await expect(candidates.first()).toBeVisible({ timeout: 15_000 });
  await candidates.first().click();
  const detail = page.locator(".power-finder-detail.open");
  await expect(detail).toBeVisible({ timeout: 15_000 });
  await expect(detail.getByText("Public Data Confidence", { exact: true })).toBeVisible();
  await expect(page.getByText("German Connection Framework")).toBeVisible();
  await expect(page.getByText(/Synthetic firm|N-0|N-1|security limit/i)).toHaveCount(0);
  await expect(page.getByText("Release A capacity-scenario assumptions")).toHaveCount(0);
  expect(scenarioRequests).toHaveLength(0);
});

test("calculated capacity separates solved reference buses from private mapped capacity", async ({
  page,
}) => {
  await page.goto("/power-finder?lat=52.31&lng=13.36&mw=20&distance=20&mapMode=capacity");
  await expect(page.getByText(/candidate site-to-node matches/i).first()).toBeVisible({
    timeout: 15_000,
  });
  const overlay = page.getByRole("switch", { name: /Capacity opportunities/i });
  await expect(overlay).toBeChecked();
  const metric = page.locator('select[name="capacity-overlay-metric"]');
  await expect(metric).toBeVisible();
  await expect(page.locator('input[name="required-capacity-range"]')).toHaveValue("20");
  await expect(page.getByRole("button", { name: "Illustrative" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Reviewed" })).toBeDisabled();
  await expect(page.getByText(/Illustrative values.*not real grid capacity/i)).toBeVisible();
  const fitSummary = page.locator(".capacity-fit-summary");
  const initialSummary = await fitSummary.innerText();
  await page.getByLabel("Exact MW").fill("100");
  await expect(fitSummary).not.toHaveText(initialSummary);
  await page.getByRole("button", { name: /Open Reference Capacity Lab/i }).click();
  await expect(page.getByText("Reference Capacity Lab", { exact: true })).toBeVisible();
  await expect(page.locator('select[name="reference-capacity-metric"]')).toHaveValue(
    "n0_import_mw",
  );
  await expect(page.getByText(/not capacity at a mapped public node/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Reference bus 01.*megawatts/i })).toBeVisible();
  await page.getByRole("button", { name: /Reference bus 01.*megawatts/i }).click();
  await expect(page.getByText("N-0 calculated")).toBeVisible();
  await expect(page.getByText("Additional unlocked")).toBeVisible();
  await page.getByRole("button", { name: "Explore Activation Options" }).click();
  await expect(page.getByText("Calculated reference network")).toBeVisible();
  await expect(page.getByText(/activatable in the representative annual envelope/i)).toBeVisible();
  await expect(page.getByText("Operating scenario range (P10 / P50 / P90)")).toBeVisible();
  await page.getByRole("tab", { name: "Evidence" }).click();
  await expect(page.getByText("Next Evidence Gate")).toBeVisible();
  await page.getByText("Technical Audit & Model Governance").click();
  await expect(page.getByText("Release 2 AI role")).toBeVisible();
  await expect(page.getByText(/6\/10 prioritised cases verified by physics/)).toBeVisible();
  await expect(page.getByText("Release 3 shadow validation")).toBeVisible();
  await expect(page.getByText(/36\/36 physics verified/)).toBeVisible();
  await expect(page.getByText("Release 4 operator-pilot readiness")).toBeVisible();
  await expect(page.getByText(/16\/16 repository gates passed/)).toBeVisible();
  await expect(page.getByText("Neo4j and physics boundary")).toBeVisible();
  await expect(page.getByText(/4\/8 graph-prioritised cases replayed/)).toBeVisible();
  await expect(page.getByText("Promotion state")).toBeVisible();
  await expect(page.getByText("Release 5 operator evidence control")).toBeVisible();
  await expect(page.getByText(/6\/6 gates passed/)).toBeVisible();
  await expect(page.getByText("Restriction rehearsal")).toBeVisible();
  await expect(page.getByText(/14\.0 MW of 17\.5 MW/)).toBeVisible();
  await expect(page.getByText("Control authority")).toBeVisible();
  await page.getByRole("button", { name: /Back to map/i }).click();
  await expect(page.getByText(/0 MW firm result means.*not N-1 secure/i)).toBeVisible();
  await expect(
    page.getByText(/Illustrative demo.*synthetic values, not grid capacity/i),
  ).toBeVisible();
  await metric.selectOption("bess_assisted_import_mw");
  await expect(metric).toHaveValue("bess_assisted_import_mw");
  await expect(page.locator(".power-finder-legend strong")).toContainText("BESS-assisted import");
});

test("static fallback remains honest when the public viewport is unavailable", async ({ page }) => {
  await page.route("**/api/power-finder/viewport?**", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"offline"}' }),
  );
  await page.goto("/power-finder");
  await page.getByText("Map Layers", { exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: /Registered generation Unavailable in this release/ }),
  ).toBeDisabled({ timeout: 15_000 });
  await expect(
    page.getByRole("checkbox", { name: /Registered storage Unavailable in this release/ }),
  ).toBeDisabled();
});

test("unclustered grid lines and industrial polygons render in the Brandenburg view", async ({
  page,
}) => {
  await page.goto(
    "/power-finder?lat=52.232112&lng=13.305687&mw=20&distance=20&voltage=20&region=DE-BB",
  );
  await page.getByText("Map Layers", { exact: true }).click();
  const gridLines = page.getByRole("checkbox", { name: /Grid lines/ });
  const industrialSites = page.getByRole("checkbox", { name: /Industrial sites/ });
  await expect(gridLines).toBeChecked();
  await expect(industrialSites).toBeChecked();
  await expect
    .poll(() => gridLines.locator("..").textContent(), { timeout: 15_000 })
    .toMatch(/[1-9]\d* visible · 233 total/);
  await expect
    .poll(() => industrialSites.locator("..").textContent(), { timeout: 15_000 })
    .toMatch(/[1-9]\d* visible · 142 total/);
});

test("comparison enforces five candidates and supports independent removal", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/power-finder?lat=52.31&lng=13.36&mw=50");
  await expect(page.getByText(/candidate site-to-node matches/i).first()).toBeVisible();
  const candidates = page.getByRole("button", { name: /Show .* on map, .*\/100/ });
  await expect(candidates.nth(5)).toBeVisible({ timeout: 15_000 });
  const candidateNames = await candidates.evaluateAll((items) =>
    items.slice(0, 6).map((item) => item.getAttribute("aria-label") ?? ""),
  );
  for (let index = 0; index < 5; index += 1) {
    await page.getByRole("button", { name: candidateNames[index], exact: true }).click();
    const detail = page.locator(".power-finder-detail.open");
    await expect(detail).toBeVisible({ timeout: 15_000 });
    await detail.getByRole("button", { name: "Add to Comparison" }).click();
    await expect(
      page.getByText(`Compare ${index + 1} ${index === 0 ? "Candidate" : "Candidates"}`),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close detail" }).click();
    await expect(page.locator(".power-finder-detail.open")).toHaveCount(0);
  }
  await expect(page.getByText("Compare 5 Candidates")).toBeVisible();

  await page.getByRole("button", { name: candidateNames[5], exact: true }).click();
  await page
    .locator(".power-finder-detail.open")
    .getByRole("button", { name: "Add to Comparison" })
    .click();
  await expect(page.getByText("You can compare up to 5 candidates.")).toBeAttached();
  await expect(page.getByText("Compare 5 Candidates")).toBeVisible();

  await page
    .getByRole("button", { name: /Remove .* from comparison/ })
    .first()
    .click();
  await expect(page.getByText("Compare 4 Candidates")).toBeVisible();
  const clearComparison = page.getByRole("button", { name: "Clear comparison" });
  page.once("dialog", (dialog) => dialog.accept());
  await clearComparison.focus();
  await clearComparison.press("Enter");
  await expect(page.getByText(/Compare \d/)).toHaveCount(0);
});

test("selected candidates remain highlighted independently of the node layer", async ({ page }) => {
  await page.goto("/power-finder?lat=52.31&lng=13.36&mw=20&distance=20");
  const candidates = page.getByRole("button", { name: /Show .* on map, .*\/100/ });
  await expect(candidates.first()).toBeVisible({ timeout: 15_000 });
  await candidates.first().focus();
  await expect(page.getByRole("application", { name: /Interactive grid/ })).not.toHaveAttribute(
    "data-preview-feature",
    "",
  );
  await candidates.first().click();
  const map = page.getByRole("application", { name: /Interactive grid/ });
  await expect(map).not.toHaveAttribute("data-selected-feature", "");
  await expect(page.getByText("Selected candidate connection point")).toBeVisible();
  await page.getByText("Map Layers", { exact: true }).click();
  await page.getByRole("checkbox", { name: /Grid nodes/ }).uncheck();
  await expect(map).not.toHaveAttribute("data-selected-feature", "");
  await page.getByRole("button", { name: "Close detail" }).click();
  await expect(map).toHaveAttribute("data-selected-feature", "");
});

test("Finder controls and comparison remain usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/power-finder?lat=52.31&lng=13.36&mw=50");
  await expect(page.getByRole("button", { name: "Edit Project" })).toBeVisible();
  await expect(page.getByRole("application", { name: /Interactive grid/ })).toBeVisible();
  const candidates = page.getByRole("button", { name: /Show .* on map, .*\/100/ });
  await expect(candidates.first()).toBeVisible({ timeout: 15_000 });
  await candidates.first().click();
  await page.getByRole("button", { name: "Add to Comparison" }).click();
  await page.getByRole("button", { name: "Close detail" }).click();
  await expect(page.getByText("Compare 1 Candidate")).toBeVisible();
  await expect(page.getByRole("button", { name: /Remove .* from comparison/ })).toBeVisible();
});

test("candidate detail prioritises decisions, contains its layout and omits candidate contact", async ({
  page,
}) => {
  await page.goto("/power-finder?lat=52.31&lng=13.36&mw=100&distance=20");
  const candidates = page.getByRole("button", { name: /Show .* on map, .*\/100/ });
  await expect(candidates.first()).toBeVisible({ timeout: 15_000 });
  await candidates.first().click();

  const detail = page.locator(".power-finder-detail.open");
  await expect(detail).toBeVisible({ timeout: 15_000 });
  await expect(detail.getByText("Selected candidate connection point")).toBeVisible();
  await expect(detail.getByText("Screening Recommendation")).toBeVisible();
  await expect(
    detail.getByRole("heading", { name: "Why This Candidate Was Shortlisted" }),
  ).toBeVisible();
  await expect(detail.getByText("Public Data Confidence", { exact: true })).toBeVisible();
  await expect(detail.getByRole("heading", { name: "What We Know" })).toBeVisible();
  await expect(detail.getByRole("heading", { name: "What Remains Unknown" })).toBeVisible();
  await expect(detail.getByText("Grid Study Status", { exact: true })).toBeVisible();
  await expect(detail.getByText("Hourly Connection Envelope", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(detail.getByText("Evidence Readiness", { exact: true })).toHaveCount(0);
  await expect(detail.getByText("German Connection Framework")).toBeVisible();
  await expect(detail.getByText(/Experimental Hourly Demonstration/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Discuss this candidate/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add to Comparison" })).toBeVisible();
  expect(await detail.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  );
  const candidateLabels = await candidates.evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("aria-label") ?? ""),
  );
  expect(candidateLabels.some((label) => /\d\.\d{2,}/.test(label))).toBe(false);
});
