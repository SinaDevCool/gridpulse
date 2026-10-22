import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openScenarioInputs } from "./operations-inputs";

test("constrained battery story, events and interval records share one selection", async ({
  page,
}) => {
  await page.goto("/operations?view=power&window=today&mode=scenario");
  // A cold CI Vite server may still be hydrating; wait for the real readiness gate, not a delay.
  await expect(page.getByRole("button", { name: /^(Show|Hide) panel/ })).toBeEnabled({
    timeout: 20000,
  });
  const inputs = await openScenarioInputs(page);
  await inputs.getByLabel("Facility Limit", { exact: false }).fill("50");
  await inputs.getByRole("button", { name: "Recalculate Scenario" }).click();
  await expect(page.locator(".power-kpis")).toContainText("48 MW");
  await expect(page.locator(".power-response-budget")).toContainText("58.6 MW");
  await expect(page.locator(".power-toolbar")).toContainText("target unmet · reserve protected");
  const reserveEvent = page.getByRole("button", { name: /Protected reserve reached in interval/ });
  await expect(reserveEvent).toContainText("08:30 UTC");
  const stateBand = page.locator(".battery-state-band");
  await expect(stateBand.locator("span")).toHaveCount(3);
  const widths = await stateBand
    .locator("span")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width));
  expect(widths[0]).toBeGreaterThan(widths[1] * 20);
  expect(widths[2]).toBeGreaterThan(widths[0]);
  expect((await reserveEvent.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  await reserveEvent.click();
  const inspector = page.getByRole("complementary", { name: "Selected battery interval" });
  await expect(inspector).toContainText("08:30 UTC – 08:45 UTC");
  await expect(inspector).toContainText("Energy limit");
  await page.getByRole("button", { name: "Next interval", exact: true }).click();
  await expect(inspector).toContainText("08:45 UTC – 09:00 UTC");
  await expect(inspector).toContainText("Minimum SOC");
  await page.getByText("View Full Interval Data", { exact: true }).click();
  await page.getByRole("combobox", { name: "Show intervals" }).selectOption("constraint");
  await expect(page.locator(".battery-table-scroll tbody tr")).toHaveCount(96);
  await page
    .locator(".battery-table-scroll")
    .getByRole("button", { name: "08:00 UTC – 08:15 UTC", exact: true })
    .click();
  await expect(inspector).toContainText("08:00 UTC – 08:15 UTC");
  await expect(inspector).toContainText("Start → end SOC");
  await page.getByRole("combobox", { name: "Show intervals" }).selectOption("missing");
  await expect(page.getByText("No records match this filter.")).toBeVisible();
  await expect(page.getByText("Starting reserve", { exact: true })).toHaveCount(0);
  await expect(page.locator(".power-dispatch-card")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Inspect constraint period" })
    .selectOption({ index: 0 });
  await expect(inspector).toContainText("00:00 UTC – 00:15 UTC");
});

test("chart clicks select an interval and keyboard controls remain available", async ({ page }) => {
  await page.goto("/operations?view=power&window=today&mode=scenario");
  await expect(page.getByRole("button", { name: "Connect evidence" })).toBeEnabled();
  const plot = page.locator(".power-timeline-panel--facility .recharts-wrapper");
  await expect(plot).toBeVisible();
  const bounds = await plot.boundingBox();
  await plot.click({ position: { x: bounds!.width * 0.25, y: bounds!.height * 0.5 } });
  const inspector = page.getByRole("complementary", { name: "Selected battery interval" });
  await expect(inspector).not.toContainText("08:00 UTC – 08:15 UTC");
  const before = await inspector.locator("header").first().innerText();
  await page.getByRole("button", { name: "Next interval", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(inspector.locator("header").first()).not.toHaveText(before);
  await expect(page.locator(".power-flow-card")).not.toBeVisible();
  await page.getByText("Power path", { exact: true }).click();
  await expect(page.locator(".power-flow-card")).toBeVisible();
});

for (const width of [390, 1440])
  test(`battery workspace, expanded data and reserve fit ${width}px`, async ({ page }, info) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/operations?view=power&window=today&mode=scenario");
    await expect(page.locator(".battery-workspace-grid .recharts-wrapper").first()).toBeVisible();
    for (const theme of ["dark", "light"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      const result = await new AxeBuilder({ page })
        .include(".battery-workspace")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        result.violations.map((item) => ({
          id: item.id,
          nodes: item.nodes.map((node) => node.failureSummary),
        })),
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`battery-${theme}-${width}.png`),
        fullPage: true,
      });
    }
    await page.getByText("View Full Interval Data", { exact: true }).click();
    await expect(page.locator(".battery-table-scroll tbody tr")).toHaveCount(96);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
