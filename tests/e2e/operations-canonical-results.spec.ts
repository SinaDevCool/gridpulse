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
  await page.route("**/v1/jobs/**", route => {
    if (route.request().method() === "POST") {
      request = route.request().postDataJSON() as FacilityPlanRequest;
      return route.fulfill({ json: { job_id: "00000000-0000-4000-8000-000000000001", status: "queued" } });
    }
    return route.fulfill({ json: canonicalMilpJob(request) });
  });
  await page.goto("/operations?view=power&mode=scenario&window=today");
  const run = page.getByRole("button", { name: "Recalculate MILP", exact: true });
  test.skip(!await run.isVisible(), "MILP flag disabled in this candidate; production candidate exercises this spec");
  await run.click();
  const result = page.locator("[data-assessment-id]");
  await expect(result).toBeVisible();
  await expect(result.getByLabel("Model checks")).toContainText("SOC 78%");
  await expect(result.getByLabel("Model checks")).toContainText("reserve 20%");
  const panels = result.locator(".power-timeline-panel");
  await expect(panels).toHaveCount(3);
  for (const panel of await panels.all()) {
    expect((await panel.boundingBox())!.height).toBeGreaterThan(140);
    await expect(panel.locator("svg.recharts-surface")).toBeVisible();
  }
  const legend = result.getByRole("button", { name: /State of charge/ });
  await legend.click();
  await expect(legend).toHaveAttribute("aria-pressed", "false");
  await legend.click();
  await expect(legend).toHaveAttribute("aria-pressed", "true");
  await result.getByText("View Full Interval Data", { exact: true }).click();
  const row = result.locator("tbody tr").nth(2);
  const time = "2026-09-26T02:00:00.000Z";
  await row.locator("td").first().hover();
  await expect(result).toHaveAttribute("data-inspected-time", time);
  await row.locator("td").first().click();
  await result.getByRole("heading").first().hover();
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
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(result.getByText("Peak reduction · baseline → plan", { exact: true })).toBeVisible();
  await expect(result.locator(".power-timeline-panel")).toHaveCount(1);
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    expect((await new AxeBuilder({ page }).include(".ops-canonical").analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/canonical-${theme}.png`, fullPage: true });
  }
  await page.getByRole("link", { name: "Power & Battery", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const panel of await panels.all()) expect((await panel.boundingBox())!.height).toBeGreaterThan(140);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: "test-results/canonical-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1600, height: 1000 });
  const batterySection = page.locator("#operations-inputs").getByText("Battery", { exact: true });
  await batterySection.click();
  await page.getByText("Advanced battery settings", { exact: true }).click();
  await page.getByRole("checkbox", { name: "Battery available", exact: true }).uncheck();
  await run.click();
  await expect(result.getByLabel("Model checks")).toContainText("No battery in this plan");
  await expect(result.locator(".power-timeline-panel")).toHaveCount(1);
});
