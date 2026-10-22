import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("result hierarchy keeps peak, duration and recovery meanings separate", async ({ page }) => {
  await page.goto("/operations?view=overview&window=today&mode=scenario");
  await expect(page.getByRole("button", { name: /^(Show|Hide) panel/ })).toBeEnabled();
  await expect(page.locator(".ops-impact-summary > strong")).toHaveText(/8.6\sMW/);
  await expect(page.locator(".ops-impact-summary small")).toHaveText(/106.6\sMW → 98\sMW/);
  const before = page.locator(".ops-impact-lane").first();
  await expect(before).toContainText("2 h 45 min");
  await before.getByRole("button").first().click();
  await page.getByRole("button", { name: "Explain selected interval", exact: true }).click();
  await expect(page.locator(".ops-response-breakdown")).toBeVisible();
  await expect(page.locator("#operations-recovery")).toContainText("1.7 MWh has no recovery slot");
  await expect(page.locator("#operations-recovery")).toContainText("Not validated");
  await page.getByRole("button", { name: "Baseline", exact: true }).click();
  await expect(page.locator(".ops-impact-summary > strong")).toHaveText(/0\sMW/);
  await expect(page.locator("#operations-recovery")).toContainText("No workload deferral");
});

test("result workbench is legible and accessible across lenses, themes and sizes", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/operations?view=overview&window=today&mode=scenario");
  await expect(page.getByRole("button", { name: /^(Show|Hide) panel/ })).toBeEnabled();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["dark", "light"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      for (const label of ["Compare plans", "Explain selected interval", "Modeled headroom"]) {
        await page.getByRole("button", { name: label, exact: true }).click();
        const results = await new AxeBuilder({ page }).include(".ops-response-explorer").analyze();
        expect(results.violations).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
      const number = await page
        .locator(".ops-impact-summary > strong")
        .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
      expect(number).toBeGreaterThanOrEqual(28);
      const tableFont = await page
        .locator(".operations-v2-chart-data table")
        .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
      expect(tableFont).toBeGreaterThanOrEqual(14);
      const next = await page
        .getByRole("button", { name: "Next interval", exact: true })
        .boundingBox();
      expect(next!.height).toBeGreaterThanOrEqual(44);
      await page
        .locator(".ops-response-explorer")
        .screenshot({ path: `.codex-tmp/results-${width}-${theme}.png` });
      await page
        .locator(".ops-impact-lanes")
        .screenshot({ path: `.codex-tmp/impact-${width}-${theme}.png` });
      await page
        .locator(".ops-inspection-tools")
        .screenshot({ path: `.codex-tmp/inspection-${width}-${theme}.png` });
    }
  }
});
