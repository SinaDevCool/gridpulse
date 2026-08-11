import { expect, test } from "@playwright/test";

test("Finder exploration and local property portfolio are anonymous", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  await page.goto("/power-finder");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("connection context");
  await expect(page.getByRole("navigation", { name: "Grid workspace navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Discuss a site" })).toHaveCount(0);
  await expect(page.getByText(/Sign in|Sign up|Create account/i)).toHaveCount(0);
  await expect(page.getByText(/^Screening only\./i)).toHaveCount(0);
  await expect(page.getByText(/demand headroom is not established/i)).toHaveCount(0);
  await expect(page.getByText("No declared site yet")).toBeVisible();
  await expect(page.getByText(/Operator questions & report/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Show .* on map, .*\/100/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Create pipeline site/i })).toBeDisabled();
  expect(requests.some((url) => /\/auth\/v1\/(token|signup)/.test(url))).toBe(false);
});

test("Finder landing, sector pages and methodology form the public product site", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /See which sites are worth advancing/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Site Pipeline/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Review the data" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Discuss a site" })).toHaveCount(0);

  for (const [pathname, heading] of [
    ["/data-centres", /Make power availability a site-selection decision/i],
    ["/energy-storage", /Find where storage can strengthen/i],
    ["/hydrogen-industry", /Turn flexible demand into a more credible route/i],
  ] as const) {
    await page.goto(pathname);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("link", { name: "Screen a Project" })).toBeVisible();
  }

  await page.goto("/data-sources");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: /See which sites are worth advancing/i }),
  ).toBeVisible();

  for (const pathname of ["/portfolio", "/reports"]) {
    const response = await page.goto(pathname);
    expect(response?.status(), pathname).toBeLessThan(400);
    await expect(page.locator("main")).toBeVisible();
  }
  expect((await page.goto("/assessments/new"))?.status()).toBe(404);
  const pilotResponse = await page.goto("/pilot");
  expect(pilotResponse?.status()).toBe(404);
});

test("a Finder project saves locally, survives navigation, and opens a dossier", async ({
  page,
}) => {
  await page.goto("/power-finder?lat=52.52&lng=13.405&mw=55&projectType=data_centre");
  await expect(page.getByText(/candidate site-to-node matches/i).first()).toBeVisible({
    timeout: 15_000,
  });
  const save = page.getByRole("button", { name: /Create pipeline site|Shortlist for/i });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page).toHaveURL(/propertyId=/);
  await page.getByRole("link", { name: /Sites Manage portfolio decisions/i }).click();
  await expect(page.getByRole("heading", { name: "Sites", exact: true })).toBeVisible();
  await expect(page.getByText("Untitled screening project").first()).toBeVisible();
  await page.getByRole("link", { name: /Untitled screening project/i }).click();
  await page.getByRole("link", { name: "Review in Power Finder" }).click();
  await expect(page).toHaveURL(/propertyId=/);
  await expect(page).toHaveURL(/lat=52\.52/);
  await expect(page).toHaveURL(/lng=13\.405/);
  await expect(page).toHaveURL(/voltage=110/);
  await expect(page.getByRole("button", { name: "More Filters" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByLabel("Minimum voltage")).toHaveValue("110");
  await expect(page.getByText(/Suggested from the declared 55 MW load/i)).toBeVisible();
  await page.goto("/portfolio");
  await page.getByRole("link", { name: /Untitled screening project/i }).click();
  await page.getByRole("link", { name: "Open Site Workspace" }).click();
  await expect(page.getByRole("heading", { name: "Opportunity overview" })).toBeVisible();
  await page.getByRole("button", { name: "Decision", exact: true }).click();
  await page.getByRole("link", { name: /Open client decision record/i }).click();
  await expect(page.getByRole("heading", { name: "Untitled screening project" })).toBeVisible();
  await expect(page.getByText("Capacity not established", { exact: true })).toBeVisible();
});

test("anonymous site workspace qualifies a site and records operator evidence", async ({
  page,
}) => {
  await page.goto("/power-finder?lat=52.52&lng=13.405&mw=80&projectType=data_centre");
  await expect(page.getByText(/candidate site-to-node matches/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Create pipeline site", exact: true }).click();
  await expect(page).toHaveURL(/propertyId=/);
  await page.goto("/portfolio");
  await page.getByRole("link", { name: /Untitled screening project/i }).click();
  await page.getByRole("link", { name: "Open Site Workspace" }).click();
  await page.getByLabel("Site name").fill("Bremen Data Centre Campus");
  await page.getByLabel("Municipality").fill("Bremen");
  await page.getByLabel("Site area (ha)").fill("12.5");
  await page.getByRole("button", { name: /Save site brief/i }).click();
  await page.getByRole("button", { name: "Operator", exact: true }).click();
  await page.getByRole("textbox", { name: "Operator", exact: true }).fill("Example Netz GmbH");
  await page.getByLabel("Enquiry status").selectOption("submitted");
  await page.getByLabel("Enquiry reference").fill("NVP-2026-001");
  await page.getByRole("button", { name: /Save operator engagement/i }).click();
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await page.getByPlaceholder("Evidence title").fill("Operator acknowledgement");
  await page
    .getByPlaceholder("Claim supported by this evidence")
    .fill("The operator acknowledged receipt of the enquiry.");
  await page.getByLabel("Category").selectOption("operator");
  await page.getByRole("button", { name: /Add evidence/i }).click();
  await expect(page.getByText("Operator acknowledgement")).toBeVisible();
  await page.getByRole("link", { name: /Sites Manage portfolio decisions/i }).click();
  await page.getByRole("button", { name: "Readiness" }).click();
  await expect(page.getByText("Bremen Data Centre Campus").first()).toBeVisible();
});

test("site decisions flow into the unified Decision Review view", async ({ page }) => {
  await page.goto("/power-finder?lat=52.52&lng=13.405&mw=65&projectType=data_centre");
  await expect(page.getByText(/candidate site-to-node matches/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Create pipeline site", exact: true }).click();
  await expect(page.getByRole("button", { name: /Screening saved/i })).toBeDisabled();
  await page.getByRole("link", { name: /Sites Manage portfolio decisions/i }).click();
  await page.getByRole("link", { name: /Untitled screening project/i }).click();
  await expect(page).toHaveURL(/selected=[0-9a-f-]{36}/);
  await page.getByRole("link", { name: "Review Decision" }).click();
  await page.getByRole("radio", { name: "Hold" }).check();
  await page
    .getByLabel("Decision rationale")
    .fill("Hold until the responsible operator and evidence are confirmed.");
  await page.getByRole("button", { name: "Save recommendation" }).click();
  await expect(page.getByText("hold", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: /Sites Manage portfolio decisions/i }).click();
  await page.getByRole("button", { name: "Decision Review" }).click();
  await expect(page.getByRole("heading", { name: "Decision Review" }).first()).toBeVisible();
  await expect(page.getByText("Untitled screening project").first()).toBeVisible();
  await expect(page.getByText("hold", { exact: true }).first()).toBeVisible();
});

test("portfolio views are URL-backed and the site workspace is directly discoverable", async ({
  page,
}) => {
  await page.goto("/power-finder?lat=52.52&lng=13.405&mw=65&projectType=data_centre");
  await expect(page.getByText(/candidate site-to-node matches/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Create pipeline site", exact: true }).click();
  await page.getByRole("link", { name: /Sites Manage portfolio decisions/i }).click();
  await page.getByLabel("Stage").selectOption("draft");
  await expect(page).toHaveURL(/stage=draft/);
  await expect(page.getByRole("heading", { name: "No Sites Match This View" })).toBeVisible();
  await page.getByRole("button", { name: "Reset Filters" }).click();
  await expect(page.getByText("Untitled screening project").first()).toBeVisible();
  await page.getByRole("button", { name: "Decision Review" }).click();
  await page.locator('select[name="pipeline-decision"]').selectOption("reject");
  await expect(page).toHaveURL(/decision=reject/);
  await expect(page.getByRole("heading", { name: "No Matching Sites" })).toBeVisible();
  await page.getByRole("button", { name: "Reset Filters" }).click();
  await page.getByRole("button", { name: "Pipeline" }).click();
  await page.getByRole("link", { name: /Untitled screening project/i }).click();
  await page.getByRole("link", { name: /Open Site Workspace/i }).click();
  await expect(page.getByRole("heading", { name: "Opportunity overview" })).toBeVisible();
});

test("a stale site link cannot trap a new Power Finder screening in saving state", async ({
  page,
}) => {
  const staleId = "f002ed17-2f75-446d-968b-7e89b86b7e47";
  await page.goto(
    `/power-finder?lat=51.4232&lng=12.3566&mw=100&projectType=data_centre&propertyId=${staleId}`,
  );
  await expect(page.getByText(/candidate site-to-node matches/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("heading", { name: /Define the site and power requirement/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close brief" }).click();
  await page.getByRole("button", { name: "Screening brief" }).click();
  await expect(
    page.getByRole("heading", { name: /Define the site and power requirement/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create pipeline site", exact: true }).click();
  await expect(page.getByRole("button", { name: "Screening saved", exact: true })).toBeDisabled();
  await expect(page).not.toHaveURL(new RegExp(`propertyId=${staleId}`));
  await expect(page.getByRole("link", { name: "Return to Site Workspace" }).first()).toBeVisible();
});

test("the MVP decision package is concise and downloads a valid PDF", async ({
  page,
}, testInfo) => {
  await page.goto("/power-finder?lat=53.54&lng=8.58&mw=125&projectType=data_centre");
  await expect(page.getByText(/candidate site-to-node matches/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Create pipeline site", exact: true }).click();
  await page.getByRole("link", { name: "Return to Site Workspace" }).first().click();
  await page.getByRole("button", { name: "Decision", exact: true }).click();
  await page.getByRole("link", { name: "Open client decision record" }).click();
  await expect(page.getByRole("heading", { name: "Essential Qualification" })).toBeVisible();
  await expect(page.getByText("N-0 Capacity")).toHaveCount(0);
  await expect(page.getByText("BESS-Assisted")).toHaveCount(0);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  await download.saveAs(testInfo.outputPath("mvp-decision-package.pdf"));
  expect(download.suggestedFilename()).toMatch(/decision-package\.pdf$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);
  expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  expect(bytes.length).toBeGreaterThan(5_000);
});

test("the release workbook passes the browser import preview", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/portfolio");
  await expect(page.getByRole("heading", { name: "No Sites in the Pipeline" })).toBeVisible();
  await page.getByText("Workspace Data").click();
  await page.getByRole("button", { name: "Import Sites" }).click();
  await expect(page).toHaveURL(/import=open/);
  await page
    .locator('input[name="property-portfolio-file"]')
    .setInputFiles("outputs/client-demo-portfolio/gridpulse-client-portfolio-sample.xlsx");
  await expect(page.getByText("10 rows")).toBeVisible();
  await expect(page.getByText("Ready to import")).toBeVisible();
  await expect(page.getByText("GP-DE-001")).toBeVisible();
  await page.getByLabel("Enrich imported sites from accepted public sources").uncheck();
  await page.getByRole("button", { name: "Import 10 Properties" }).click();
  await expect(page.getByText("Hunte Edge Campus").first()).toBeVisible();
  await expect(page.getByText(/10 of 10 sites shown/i)).toBeVisible();

  await page.reload();
  await expect(page.getByText("Hunte Edge Campus").first()).toBeVisible();
  await expect(page.getByText(/10 of 10 sites shown/i)).toBeVisible();
  await page.getByRole("link", { name: /Brandenburg South Campus/i }).click();
  await page.getByRole("link", { name: "Review in Power Finder" }).click();
  await expect(page).toHaveURL(/propertyId=/);
  await expect(page).toHaveURL(/lat=52\.3031/);
  await expect(page).toHaveURL(/lng=13\.254/);
  await expect(page.getByText(/candidate site-to-node matches/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("Maximum distance").selectOption("50");
  await page.getByLabel(/Minimum voltage/).selectOption("0");
  const candidates = page.getByRole("button", { name: /Show .* on map, .*\/100/ });
  await expect(candidates.first()).toBeVisible({ timeout: 15_000 });
  await candidates.first().click();
  const shortlist = page.getByRole("button", { name: /Shortlist for Brandenburg South Campus/i });
  await expect(shortlist).toBeEnabled();
  await shortlist.click();
  await expect(page.locator('p.sr-only[role="status"]')).toContainText(
    "shortlisted for Brandenburg South Campus",
  );
  await page.getByRole("link", { name: "Return to Site Workspace" }).first().click();
  await expect(page.getByRole("heading", { name: "Brandenburg South Campus" })).toBeVisible();
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await page.getByRole("button", { name: /Enrich site|Retry incomplete sources/i }).click();
  await expect(page.getByText(/sources completed/i)).toBeVisible({ timeout: 25_000 });
  await page.getByPlaceholder("Evidence title").fill("Client site declaration");
  await page
    .getByPlaceholder("Claim supported by this evidence")
    .fill("The client declared the site coordinates and required total site load.");
  await page.getByLabel("Category").selectOption("property");
  await page.getByRole("button", { name: /Add evidence/i }).click();
  await expect(page.getByText("Client site declaration")).toBeVisible();
  await page.getByRole("button", { name: "Operator", exact: true }).click();
  await page.getByRole("textbox", { name: "Operator", exact: true }).fill("Example Netz GmbH");
  await page.getByLabel("Enquiry status").selectOption("submitted");
  await page.getByLabel("Enquiry reference").fill("GP-DE-005-ENQUIRY");
  await page.getByRole("button", { name: /Save operator engagement/i }).click();
  await page.getByRole("button", { name: "Decision", exact: true }).click();
  await page.getByRole("radio", { name: "Hold" }).check();
  await page
    .getByLabel("Decision rationale")
    .fill("Hold pending operator confirmation of capacity, connection point, cost and programme.");
  await page.getByRole("button", { name: "Save recommendation" }).click();
  await expect(page.getByText("hold", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: /Open client decision record/i }).click();
  const decisionDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const decisionPdf = await decisionDownload;
  await decisionPdf.saveAs(testInfo.outputPath("brandenburg-south-decision-record.pdf"));
});

test("legacy portfolio destinations redirect into unified Sites views", async ({ page }) => {
  await page.goto("/workspaces");
  await expect(page).toHaveURL(/\/portfolio\?view=pipeline/);
  await expect(page.getByRole("heading", { name: "Sites", exact: true })).toBeVisible();
  await page.goto("/reports?view=qualification");
  await expect(page).toHaveURL(/\/portfolio\?view=readiness/);
  await expect(page.getByRole("button", { name: "Readiness" })).toHaveClass(/active/);
});

test("Sites remains usable without horizontal page overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/power-finder?lat=52.52&lng=13.405&mw=55&projectType=data_centre");
  await expect(page.getByText(/candidate site-to-node matches/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Create pipeline site", exact: true }).click();
  await expect(page).toHaveURL(/propertyId=/);
  await page.goto("/portfolio");
  await expect(page.getByRole("heading", { name: "Sites", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Untitled screening project/i })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("account-free MVP keeps a custom site inside the data-centre workflow", async ({ page }) => {
  await page.goto(
    "/power-finder?lat=52.31&lng=13.36&projectType=battery_storage&mw=50&exportMw=50&distance=20",
  );
  await expect(
    page.getByRole("heading", { name: "Define the site and power requirement" }),
  ).toBeVisible();
  await expect(page.getByLabel("Project type")).toHaveCount(0);
  await expect(page.getByLabel("Latitude")).toHaveValue("52.31");
  await expect(page.getByLabel("Longitude")).toHaveValue("13.36");
  await expect(page.getByLabel("Total site load (MW)")).toHaveValue("50");
  await expect(page.getByLabel("Export MW")).toHaveValue("50");
  await expect(page.getByText(/candidate site-to-node matches/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("Site opportunity").fill("Brandenburg data-centre screen");
  await expect(page.getByLabel("Site opportunity")).toHaveValue("Brandenburg data-centre screen");
  await expect(page.getByText(/Operator questions & report/i)).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("gridpulse-finder-active-project")))
    .toContain("Brandenburg data-centre screen");
  await page.reload();
  await expect(page.getByLabel("Site opportunity")).toHaveValue("Brandenburg data-centre screen");
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
  await detail.getByRole("button", { name: "Compare candidate" }).click();
  await page.getByRole("button", { name: "Close detail" }).click();
  await candidates.nth(1).click();
  detail = page.locator(".power-finder-detail.open");
  await expect(detail).toBeVisible({ timeout: 15_000 });
  await detail.getByRole("button", { name: "Compare candidate" }).click();
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
  await expect(detail.getByText("Public Data Confidence", { exact: true })).toHaveCount(0);
  await expect(page.getByText("German Connection Framework")).toHaveCount(0);
  await expect(page.getByText(/Synthetic firm|N-0|N-1|security limit/i)).toHaveCount(0);
  await expect(page.getByText("Release A capacity-scenario assumptions")).toHaveCount(0);
  expect(scenarioRequests).toHaveLength(0);
});

test("anonymous MVP hides synthetic capacity controls even when requested by URL", async ({
  page,
}) => {
  await page.goto("/power-finder?lat=52.31&lng=13.36&mw=20&distance=20&mapMode=capacity");
  await expect(page.getByText(/candidate site-to-node matches/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("switch", { name: /Capacity opportunities/i })).toHaveCount(0);
  await expect(page.locator('select[name="capacity-overlay-metric"]')).toHaveCount(0);
  await expect(page.locator('input[name="required-capacity-range"]')).toHaveCount(0);
  await expect(page.getByText("Berlin synthetic calculation", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Open Reference Capacity Lab/i })).toHaveCount(0);
  await expect(page.getByText("Reference Capacity Lab", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/candidate site-to-node matches/i).first()).toBeVisible();
});

test("static fallback remains honest when the public viewport is unavailable", async ({ page }) => {
  await page.route("**/api/power-finder/viewport?**", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"offline"}' }),
  );
  await page.goto("/power-finder");
  await page.getByText("Map Layers", { exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: /Registered generation.*0 in current detail view/ }),
  ).not.toBeChecked({ timeout: 15_000 });
  await expect(
    page.getByRole("checkbox", { name: /Registered storage 0 in current detail view/ }),
  ).not.toBeChecked();
});

test("unclustered grid lines and industrial polygons render in the Brandenburg view", async ({
  page,
}) => {
  await page.goto(
    "/power-finder?lat=52.232112&lng=13.305687&mw=20&distance=20&voltage=20&region=DE-BB",
  );
  await page.getByText("Map Layers", { exact: true }).click();
  const gridLines = page.getByRole("checkbox", { name: /Mapped grid corridors/ });
  const industrialSites = page.getByRole("checkbox", { name: /Industrial sites/ });
  await expect(gridLines).toBeChecked();
  await expect(industrialSites).toBeChecked();
  await expect
    .poll(() => gridLines.locator("..").textContent(), { timeout: 15_000 })
    .toMatch(/[1-9]\d* visible/);
  await expect
    .poll(() => industrialSites.locator("..").textContent(), { timeout: 15_000 })
    .toMatch(/[1-9]\d* visible/);
});

test("comparison enforces five candidates and supports independent removal", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/power-finder?lat=52.31&lng=13.36&mw=50");
  await expect(page.getByText(/candidate site-to-node matches/i).first()).toBeVisible();
  await page.getByRole("button", { name: /Show all \d+ candidates/i }).click();
  const candidates = page.getByRole("button", { name: /Show .* on map, .*\/100/ });
  await expect(candidates.nth(5)).toBeVisible({ timeout: 15_000 });
  const candidateNames = await candidates.evaluateAll((items) =>
    items.slice(0, 6).map((item) => item.getAttribute("aria-label") ?? ""),
  );
  for (let index = 0; index < 5; index += 1) {
    await page.getByRole("button", { name: candidateNames[index], exact: true }).click();
    const detail = page.locator(".power-finder-detail.open");
    await expect(detail).toBeVisible({ timeout: 15_000 });
    await detail.getByRole("button", { name: "Compare candidate" }).click();
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
    .getByRole("button", { name: "Compare candidate" })
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
  await expect(page.getByRole("button", { name: "Screening brief" })).toBeVisible();
  await expect(page.getByRole("application", { name: /Interactive grid/ })).toBeVisible();
  const candidates = page.getByRole("button", { name: /Show .* on map, .*\/100/ });
  await expect(candidates.first()).toBeVisible({ timeout: 15_000 });
  await candidates.first().click();
  await page.getByRole("button", { name: "Compare candidate" }).click();
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
  await expect(detail.getByText("Investigation recommendation")).toBeVisible();
  await expect(
    detail.getByRole("heading", { name: /Why this candidate (ranks highly|was shortlisted)/i }),
  ).toBeVisible();
  await expect(detail.getByText("Public Data Confidence", { exact: true })).toHaveCount(0);
  await expect(detail.getByRole("heading", { name: "Connection Context" })).toBeVisible();
  await expect(detail.getByRole("heading", { name: "What Remains Unknown" })).toHaveCount(0);
  await expect(detail.getByText("Grid Study Status", { exact: true })).toHaveCount(0);
  await expect(detail.getByText("Hourly Connection Envelope", { exact: true })).toHaveCount(0);
  await expect(detail.getByText("Evidence Readiness", { exact: true })).toHaveCount(0);
  await expect(detail.getByText("German Connection Framework")).toHaveCount(0);
  await expect(detail.getByText(/Experimental Hourly Demonstration/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Discuss this candidate/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Compare candidate" })).toBeVisible();
  expect(await detail.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  );
  const candidateLabels = await candidates.evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("aria-label") ?? ""),
  );
  expect(candidateLabels.some((label) => /\d\.\d{2,}/.test(label))).toBe(false);
});
