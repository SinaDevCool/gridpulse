import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [390, 1440]) {
  for (const view of ["overview", "compute", "power"]) {
    test(`${view}: light surfaces and expanded records stay readable at ${width}px`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/operations?view=${view}&window=today&mode=scenario`);
      await expect(page.locator(".ops-service-status")).toContainText(
        "Calculation service available",
        { timeout: 20_000 },
      );
      const theme = page.getByRole("button", { name: "Theme: dark" });
      if (await theme.count()) await theme.click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      const canvas = page.locator(".ops-canvas-content");
      expect(await canvas.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
        "rgb(241, 245, 249)",
      );
      if (view === "compute") {
        await page.locator(".compute-queue-disclosure > summary").click();
        const header = page.locator(".compute-table-wrap thead th").first();
        expect(await header.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
          "rgb(234, 240, 246)",
        );
      }
      const records = page.locator(".operations-v2-chart-data");
      if (await records.count()) await records.locator(":scope > summary").click();
      const result = await new AxeBuilder({ page })
        .include(".operations-v2")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, issue: n.failureSummary })),
        })),
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const legend = page.locator(".operations-chart-legend button").first();
      await legend.click();
      await expect(legend).toHaveAttribute("aria-pressed", "false");
      await legend.focus();
      await page.keyboard.press("Space");
      await expect(legend).toHaveAttribute("aria-pressed", "true");
      const axis = page.locator(".recharts-cartesian-axis-tick-value");
      for (const label of await axis.allTextContents()) expect(label).not.toMatch(/\d\.\d{4}/);
      await canvas.screenshot({ path: `.codex-tmp/light-${view}-${width}.png` });
      if (width === 1440) {
        const detail = page.locator(
          view === "compute"
            ? ".compute-queue-card"
            : view === "overview"
              ? ".ops-response-explorer"
              : ".battery-interval-inspector",
        );
        await detail.scrollIntoViewIfNeeded();
        await detail.screenshot({ path: `.codex-tmp/light-${view}-detail.png` });
      }
      await page.getByRole("button", { name: "Theme: light" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      expect(
        await page
          .locator(".operations-v2")
          .evaluate((node) => getComputedStyle(node).getPropertyValue("--ops-soc").trim()),
      ).toBe("#42dc94");
    });
  }
}
