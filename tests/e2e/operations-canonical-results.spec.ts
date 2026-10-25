import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { canonicalMilpJob } from "../fixtures/canonical-milp-job";
import type { FacilityPlanRequest } from "../../src/features/analytics/contracts";

test.use({ storageState: { cookies: [], origins: [] } });
test("MILP charts retain physical SOC, geometry and shared keyboard/pointer inspection", async ({ page }) => {
  const token = `e30.${Buffer.from(JSON.stringify({ role: "gridpulse_public_visitor", exp: 4102444800 })).toString("base64url")}.fixture`;
  await page.route("**/auth/v1/signup", route => route.fulfill({ json: { access_token: token,
    token_type: "bearer", refresh_token: "fixture", expires_in: 3600,
    user: { id: "00000000-0000-4000-8000-000000000002", is_anonymous: true, aud: "authenticated" } } }));
  let request: FacilityPlanRequest;
  let submissions = 0;
  let exerciseFlows = false;
  await page.route("**/v1/jobs/**", route => {
    if (route.request().method() === "POST") {
      submissions++;
      request = route.request().postDataJSON() as FacilityPlanRequest;
      return route.fulfill({ json: { job_id: "00000000-0000-4000-8000-000000000001", status: "queued" } });
    }
    const job = canonicalMilpJob(request);
    if (exerciseFlows && request.batteries?.length) {
      const result = job.result_payload.result;
      const discharge = request.intervals.findIndex(interval => String(interval.start).includes("T08:00:"));
      const charge = request.intervals.findIndex(interval => String(interval.start).includes("T09:00:"));
      Object.assign(result.facility.points[discharge], { battery_discharge_mw: 4.8, grid_import_mw: 46.2 });
      Object.assign(result.facility.points[charge], { battery_charge_mw: 5 / .95, grid_import_mw: 51 + 5 / .95 });
      const used = 5 * Number(request.intervals[discharge].duration_minutes) / 60;
      for (let index = discharge; index < charge; index++) {
        result.battery_trajectories[0].points[index].soc_mwh = Number(request.batteries[0].initial_soc_mwh) - used;
      }
    }
    return route.fulfill({ json: job });
  });
  await page.goto("/operations?view=power&mode=scenario&window=today");
  await expect(page.getByRole("button", { name: /^(Show|Hide) panel/ })).toBeEnabled();
  const run = page.getByRole("button", { name: "Recalculate MILP", exact: true });
  if (process.env.GRIDPULSE_TEST_MILP_REQUIRED === "1") await expect(run).toBeVisible();
  else test.skip(!await run.isVisible(), "MILP flag disabled in this candidate; focused qualification requires it");
  await run.click();
  const result = page.locator("[data-assessment-id]");
  await expect(result).toBeVisible();
  expect(request!.intervals).toHaveLength(96);
  expect(request!.intervals.at(-1)!.start).toBe("2026-09-26T23:45:00.000Z");
  await expect(result.getByLabel("Selected battery interval")).toContainText("SOC 78%");
  await expect(result.getByLabel("Selected battery interval")).toContainText("reserve 20%");
  const panels = result.locator(".power-timeline-panel");
  await expect(panels).toHaveCount(3);
  for (const panel of await panels.all()) {
    expect((await panel.boundingBox())!.height).toBeGreaterThan(140);
    await expect(panel.locator("svg.recharts-surface")).toBeVisible();
  }
  await expect(result.getByLabel("Selected interval power facts")).toContainText("Battery · idle");
  await expect(result.getByLabel("Selected battery interval")).toContainText("78");
  await expect(result.getByLabel("Full-horizon battery assessment")).toContainText("Reserve protected");
  await result.getByText("Power path", { exact: true }).click();
  await expect(result.getByRole("img", { name: /Proportional power flows/ })).toBeVisible();
  await result.getByText("Power path", { exact: true }).click();
  expect(submissions).toBe(1);
  const legend = result.getByRole("button", { name: /State of charge/ });
  await legend.click();
  await expect(legend).toHaveAttribute("aria-pressed", "false");
  await legend.click();
  await expect(legend).toHaveAttribute("aria-pressed", "true");
  await result.getByText("View Full Interval Data", { exact: true }).click();
  await result.getByLabel("Show intervals").selectOption("constraint");
  await expect(result.getByText("No records match this filter.", { exact: true })).toBeVisible();
  await result.getByLabel("Show intervals").selectOption("all");
  const row = result.locator("tbody tr").nth(2);
  const time = "2026-09-26T00:30:00.000Z";
  await row.locator("td").first().hover();
  await expect(result).toHaveAttribute("data-inspected-time", time);
  await row.locator("td").first().click();
  await result.getByRole("heading", { name: "Facility Power & Battery Response", exact: true }).hover();
  await expect(result).toHaveAttribute("data-inspected-time", time);
  await row.getByRole("button").focus();
  await page.keyboard.press("Enter");
  await expect(row).toHaveAttribute("aria-selected", "true");
  await page.getByRole("link", { name: "Compute & Workloads", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Solved workload schedule" })).toBeVisible();
  await expect(result.locator(".power-timeline-panel")).toHaveCount(1);
  const lane = result.getByRole("button", { name: /Foundation model training.*06:00/ });
  await lane.click();
  await expect(result).toHaveAttribute("data-inspected-time", "2026-09-26T06:00:00.000Z");
  await expect(result.getByLabel("Execution time axis UTC")).toBeVisible();
  await expect(result.getByRole("region", { name: "Scheduled workload demand" })).toBeVisible();
  await expect(result.getByLabel("Workload outcomes")).toContainText("Remaining work");
  const reviewFilters = result.getByLabel("Workload review filters");
  await reviewFilters.getByRole("button", { name: /^Protected workloads/ }).click();
  await expect(result.locator(".canonical-execution .compute-window-lane")).toHaveCount(1);
  await expect(result.locator(".canonical-compute-review tbody tr")).toHaveCount(1);
  await expect(result.getByLabel(/Workload details:/)).toHaveCount(0);
  await reviewFilters.getByRole("button", { name: /^All workloads/ }).click();
  await expect(result.locator(".canonical-execution .compute-window-lane")).toHaveCount(5);
  await result.getByRole("button", { name: "Facility context", exact: true }).click();
  await expect(result.getByText("Facility Power", { exact: true })).toBeVisible();
  await result.getByRole("button", { name: "Workload demand", exact: true }).click();
  await result.getByRole("checkbox", { name: "Show earliest-start/deadline envelopes" }).check();
  await expect(result.locator(".canonical-permitted")).toHaveCount(5);
  await lane.click();
  const inspector = result.getByLabel("Workload details: Foundation model training", { exact: true });
  await expect(inspector).toContainText("Submitted constraints");
  await expect(inspector).toContainText("GPU allocation");
  await expect(result.getByRole("button", { name: /Selected workload.*Included in total/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(inspector).toHaveCount(0);
  await lane.focus();
  await page.keyboard.press("ArrowRight");
  await expect(result).toHaveAttribute("data-inspected-time", "2026-09-26T06:15:00.000Z");
  await page.keyboard.press("ArrowRight");
  await expect(result).toHaveAttribute("data-inspected-time", "2026-09-26T06:30:00.000Z");
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    expect((await new AxeBuilder({ page }).include(".canonical-compute").analyze()).violations).toEqual([]);
    const colors = await result.evaluate(element => {
      const style = getComputedStyle(element);
      return [style.getPropertyValue("--ops-flexible"), style.getPropertyValue("--ops-protected"), style.getPropertyValue("--ops-selected")];
    });
    expect(new Set(colors).size).toBe(3);
    await result.locator(".canonical-workload-chart").scrollIntoViewIfNeeded();
    await result.locator(".canonical-workload-chart").screenshot({ path: `test-results/canonical-compute-chart-${theme}.png` });
    await result.locator(".canonical-execution .compute-window-lane").first().screenshot({ path: `test-results/canonical-compute-lane-${theme}.png` });
    await page.screenshot({ path: `test-results/canonical-compute-${theme}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.setViewportSize({ width: 390, height: 1100 });
  await result.locator(".canonical-workload-chart").screenshot({ path: "test-results/canonical-compute-chart-mobile.png" });
  await result.locator(".canonical-execution .compute-window-lane").first().screenshot({ path: "test-results/canonical-compute-lane-mobile.png" });
  await page.screenshot({ path: "test-results/canonical-compute-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1600, height: 1000 });
  expect(submissions).toBe(1);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(result.getByText("Peak reduced by", { exact: true })).toBeVisible();
  await expect(result.getByText("Plan peak import", { exact: true })).toHaveCount(0);
  await expect(result.locator(".power-timeline-panel")).toHaveCount(1);
  await expect(result.getByRole("meter", { name: "Peak import after response" })).toHaveAttribute("aria-valuenow", "51");
  const explorer = result.getByRole("region", { name: "MILP response explorer" });
  await expect(explorer.locator(".ops-compact-comparison tbody tr")).toHaveCount(2);
  await expect(explorer.locator(".ops-peak-comparison")).toHaveCount(2);
  await expect(explorer).toContainText("Passed within model");
  await explorer.getByRole("button", { name: "Operating margins", exact: true }).click();
  await expect(explorer.getByRole("region", { name: "Operating margins", exact: true })).toContainText("Peak safety-target margin");
  await expect(explorer).toContainText("Selected-interval safety-target margin");
  await explorer.getByRole("button", { name: "Explain selected interval", exact: true }).click();
  await expect(explorer.getByRole("img", { name: /Selected interval power balance/ })).toBeVisible();
  await expect(explorer.getByText(/Balance discrepancy/)).toHaveCount(0);
  await result.getByText("Set inspection range", { exact: true }).click();
  await result.getByLabel("Range start", { exact: true }).selectOption("2");
  await expect(result).toHaveAttribute("data-inspected-time", "2026-09-26T00:30:00.000Z");
  await expect(result.getByRole("meter")).toHaveAttribute("aria-valuenow", "51");
  await result.getByRole("button", { name: "Reset inspection range", exact: true }).click();
  await result.getByRole("button", { name: "Inspect plan peak", exact: true }).click();
  expect(submissions).toBe(1);
  await expect(result).toHaveAttribute("data-assessment-id", "a".repeat(64));
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    expect((await new AxeBuilder({ page }).include(".ops-canonical").analyze()).violations).toEqual([]);
    await result.getByLabel("Operating summary", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/canonical-summary-${theme}.png` });
    await explorer.locator(".ops-waterfall").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/canonical-balance-${theme}.png` });
    await result.locator(".power-timeline-panel").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/canonical-${theme}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await explorer.locator(".ops-waterfall").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/canonical-overview-mobile.png" });
  await explorer.getByRole("button", { name: "Compare plans", exact: true }).click();
  await expect(explorer.locator(".ops-compact-comparison tbody tr")).toHaveCount(2);
  await explorer.getByText("Review completion & battery details", { exact: true }).click();
  await expect(explorer.getByRole("table", { name: "Workload completion · full submitted horizon", exact: true })).toBeVisible();
  await expect(result.locator(".ops-canonical-selected")).toBeVisible();
  expect(submissions).toBe(1);
  await page.getByRole("link", { name: "Power & Battery", exact: true }).click();
  for (const panel of await panels.all()) expect((await panel.boundingBox())!.height).toBeGreaterThan(140);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  for (const theme of ["dark", "light"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    expect((await new AxeBuilder({ page }).include(".ops-canonical").analyze()).violations).toEqual([]);
    await result.getByLabel("Selected battery interval").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/canonical-battery-inspector-${theme}.png` });
  }
  await panels.last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/canonical-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1600, height: 1000 });
  const batterySection = page.locator("#operations-inputs").getByText("Battery", { exact: true });
  await batterySection.click();
  await page.getByText("Advanced battery settings", { exact: true }).click();
  await page.getByRole("checkbox", { name: "Battery available", exact: true }).uncheck();
  await run.click();
  await expect(result.getByLabel("Selected battery interval")).toContainText("No battery in this plan");
  await expect(result.locator(".power-timeline-panel")).toHaveCount(1);
  exerciseFlows = true;
  await page.getByRole("checkbox", { name: "Battery available", exact: true }).check();
  await run.click();
  await expect(result.locator(".power-timeline-panel")).toHaveCount(3);
  await result.getByRole("button", { name: /First charge/ }).click();
  await expect(result).toHaveAttribute("data-inspected-time", "2026-09-26T09:00:00.000Z");
  await expect(result.getByLabel("Selected interval power facts")).toContainText("Battery · charging");
  await expect(result.getByLabel("Selected interval power facts")).toContainText("-5.3 MW");
  await result.getByRole("button", { name: /First discharge/ }).click();
  await expect(result.getByLabel("Selected interval power facts")).toContainText("Battery · discharging");
  await expect(result.locator(".power-timeline-panel").nth(1).locator(".recharts-reference-area")).toHaveCount(2);
});
