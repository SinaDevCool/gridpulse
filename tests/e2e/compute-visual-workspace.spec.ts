import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openScenarioInputs, openComputeQueue } from "./operations-inputs";

test("compute starts with visual summary and linked windows, not a queue or recommendation panel", async ({
  page,
}) => {
  await page.goto("/operations?view=compute");
  await expect(page.getByRole("region", { name: "Compute operating summary" })).toContainText(
    "3.6 MW",
  );
  await expect(
    page.getByRole("img", { name: /1 recommended candidates from 4 eligible/ }),
  ).toBeVisible();
  await expect(page.locator(".compute-queue-disclosure")).not.toHaveAttribute("open", "");
  await expect(page.locator(".compute-table-wrap")).not.toBeVisible();
  await expect(page.locator(".compute-recommendation")).toHaveCount(0);
  await expect(page.locator(".compute-window-lane")).toHaveCount(1);
  await expect(page.locator(".compute-validation-status")).toContainText(
    "not a deadline guarantee",
  );
  await page.locator(".compute-lane-title").click();
  await expect(page.getByRole("complementary", { name: /Workload details/ })).toBeVisible();
  await page.getByRole("button", { name: "Close workload details" }).click();
  await expect(page.locator(".compute-lane-title")).toBeFocused();
  await openComputeQueue(page);
  await expect(page.locator(".compute-table-wrap tbody tr")).toHaveCount(5);
});

test("shared time cursor, optional overlays and eligible windows work with keyboard", async ({
  page,
}) => {
  await page.goto("/operations?view=compute");
  const slider = page.getByRole("slider", { name: /Inspect time/ });
  await expect(slider).toBeEnabled();
  await slider.press("End");
  await expect(slider).toHaveAttribute("aria-valuetext", "23:45 UTC");
  await page.getByLabel("Show eligible workload windows").check();
  await expect(page.locator(".compute-window-lane")).toHaveCount(4);
  await page.getByText("Chart options", { exact: true }).click();
  await page.getByLabel("Show GPU power", { exact: true }).check();
  await page.getByLabel(/Show aggregate scenario response/).check();
  await expect(page.getByText("MW · not a job schedule", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByRole("link", { name: "Compute & Workloads", exact: true }).click();
  const panel = await openScenarioInputs(page);
  await panel.getByLabel("Facility Limit", { exact: false }).fill("120");
  await panel.getByRole("button", { name: "Recalculate Scenario" }).click();
  await expect(page.locator(".compute-validation-status")).toContainText("No workload movement");
  await expect(page.locator(".compute-window-lane")).toHaveCount(0);
});

for (const width of [390, 768, 1280, 1920])
  test(`compute visual workspace fits ${width}px in both themes`, async ({ page }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/operations?view=compute");
    await expect(page.getByRole("button", { name: /^Inputs/ })).toBeEnabled();
    for (const theme of ["dark", "light"]) {
      const toggle = page.getByRole("button", {
        name: new RegExp(`Theme: ${theme === "dark" ? "light" : "dark"}`),
      });
      if (await toggle.count()) await toggle.click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.getByLabel("Show eligible workload windows").check();
      const result = await new AxeBuilder({ page })
        .include(".operations-v2")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.failureSummary) })),
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      await page.screenshot({
        path: info.outputPath(`compute-${width}-${theme}.png`),
        fullPage: true,
      });
    }
  });
