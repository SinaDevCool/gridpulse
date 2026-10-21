import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("cockpit integrates comparisons and retains full-horizon recovery", async ({ page }) => {
  await page.goto("/operations?view=overview&window=today&mode=scenario");
  await expect(page.getByRole("button", { name: /^Inputs/ })).toBeEnabled();
  const obligations = page.locator("#operations-recovery");
  await expect(obligations).toContainText("1.7 MWh has no recovery slot");
  const ledger = await obligations.getByRole("img").getAttribute("aria-label");
  await expect(
    page.getByText("Planning assumptions & recovery obligations", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".ops-advanced-tools")).not.toHaveAttribute("open", "");
  await page.getByText("Compare responses", { exact: true }).click();
  const comparison = page.locator(".ops-response-comparison");
  await expect(comparison.locator("tbody tr")).toHaveCount(4);
  await comparison.getByRole("button", { name: "Select Workload Only comparison" }).click();
  await expect(obligations).toContainText("4.5 MWh has no recovery slot");
  await comparison.getByRole("button", { name: "Select Baseline comparison" }).click();
  await expect(obligations).toContainText("No workload deferral");
  await expect(obligations.getByRole("img")).toHaveCount(0);
  await page.getByRole("button", { name: "Battery + Workload", exact: true }).click();
  await page.getByRole("link", { name: "Review workload recovery" }).click();
  await expect(page).toHaveURL(/view=compute/);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.locator(".operations-select-trigger").filter({ hasText: "Full scenario day" }).click();
  await page.getByRole("option", { name: "Assessed peak", exact: true }).click();
  await expect(obligations.getByRole("img")).toHaveAttribute("aria-label", ledger!);
  await page.getByRole("link", { name: "Inspect reserve" }).click();
  await expect(page).toHaveURL(/view=power&window=now/);
});

test("headroom, evidence and technical tools remain available without overcrowding", async ({
  page,
}, testInfo) => {
  await page.goto("/operations");
  await expect(page.getByRole("button", { name: /^Inputs/ })).toBeEnabled();
  await page.getByText("Inspect headroom", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Illustrative response envelope" })).toBeVisible();
  await expect(page.locator(".ops-headroom-detail")).toContainText("not calibrated confidence");
  await page.getByRole("link", { name: "Evidence & assumptions", exact: true }).click();
  await expect(page.locator("#operations-assurance")).toHaveAttribute("open", "");
  await expect(page.locator("#operations-assurance")).toContainText("Physical dispatch is locked");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      const result = await new AxeBuilder({ page })
        .include(".operations-v2")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.failureSummary) })),
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      await page.screenshot({
        path: testInfo.outputPath(`obligations-${theme}-${width}.png`),
        fullPage: true,
      });
    }
  }
});

test("advanced model contracts remain usable inside mobile inputs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/operations");
  await page.getByRole("button", { name: /^Inputs/ }).click();
  const drawer = page.getByRole("dialog", { name: "Inputs & evidence" });
  await drawer.getByText("Advanced tools", { exact: true }).click();
  await drawer
    .getByText("Canonical planning, rolling analysis & historical replay", { exact: true })
    .click();
  await drawer.getByLabel("Canonical request JSON").fill("{}");
  await drawer.getByRole("button", { name: "Validate and run" }).click();
  await expect(drawer.getByRole("alert")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const results = await new AxeBuilder({ page })
    .include("#operations-inputs")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
});
