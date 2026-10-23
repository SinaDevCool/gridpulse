import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openEvidenceInputs } from "../e2e/operations-inputs";

test("solution switching warns about session-only imported evidence", async ({ page }) => {
  await page.goto("/operations?view=power");
  await openEvidenceInputs(page);
  await page.getByLabel("Facility meter CSV").setInputFiles({
    name: "meter.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "timestamp,facility_import_mw,operating_limit_mw\n2026-09-26T00:00:00Z,98,100\n2026-09-26T00:15:00Z,104,100",
    ),
  });
  await expect(page).toHaveURL(/mode=historical/);
  await page.getByRole("button", { name: "Solution: Facility Operations", exact: true }).click();
  await page.getByRole("link", { name: /Site Selection Evaluate/ }).click();
  const warning = page.getByRole("dialog", { name: "Leave Facility Operations?" });
  await expect(warning).toContainText("Uploaded evidence is held only in this session");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/mode=historical/);
  await expect(page.locator(".power-response-review")).toContainText("Observed power balance");
});

test("solution switcher separates customer tasks and preserves Operations tab context", async ({
  page,
}) => {
  await page.goto("/operations?view=compute&window=next-4h&mode=scenario");
  const header = page.getByRole("banner");
  await expect(header.getByRole("navigation", { name: "Power Operations views" })).toHaveCount(1);
  await expect(page.locator(".ops-canvas-toolbar nav")).toHaveCount(0);
  await expect(
    header.getByRole("link", { name: "Compute & Workloads", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await header.getByRole("link", { name: "Power & Battery", exact: true }).click();
  await expect(page).toHaveURL(/window=next-4h/);
  const trigger = header.getByRole("button", {
    name: "Solution: Facility Operations",
    exact: true,
  });
  await trigger.click();
  await expect(page.getByRole("navigation", { name: "Choose solution" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await page.getByRole("link", { name: /Site Selection Evaluate/ }).click();
  await expect(page).toHaveURL(/power-finder/);
  await expect(
    page.getByRole("navigation", { name: "GridPulse workspace" }).getByRole("link"),
  ).toHaveCount(2);
});

test("leaving protects drafts but switching Operations tabs does not reset them", async ({
  page,
}) => {
  await page.goto("/operations");
  await page.getByLabel("Facility Limit MW", { exact: true }).fill("120");
  await page.getByRole("link", { name: "Compute & Workloads", exact: true }).click();
  await expect(page.getByLabel("Facility Limit MW", { exact: true })).toHaveValue("120");
  await page.getByRole("button", { name: "Solution: Facility Operations", exact: true }).click();
  await page.getByRole("link", { name: /Site Selection Evaluate/ }).click();
  const warning = page.getByRole("dialog", { name: "Leave Facility Operations?" });
  await expect(warning).toContainText("unapplied scenario edits");
  expect(
    (
      await new AxeBuilder({ page })
        .include(".ops-exit-dialog")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await warning.getByRole("button", { name: "Stay in Operations" }).click();
  await expect(
    page.getByRole("button", { name: "Solution: Facility Operations", exact: true }),
  ).toBeFocused();
  await expect(page).toHaveURL(/operations/);
  await page.getByRole("link", { name: "GridPulse home", exact: true }).click();
  await warning.getByRole("button", { name: "Leave without saving" }).click();
  await expect(page).toHaveURL(/\/$/);
});

for (const width of [390, 768, 1024, 1440, 2560])
  test(`solution ribbon and panel controls fit ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/operations");
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Power & Battery", exact: true }),
    ).toBeVisible();
    if (width >= 1100) {
      await expect(page.getByRole("button", { name: "Close inputs", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Hide panel", exact: true }).click();
      await page.getByRole("button", { name: "Show panel", exact: true }).click();
    } else {
      await page.getByRole("button", { name: "Show panel", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Inputs & evidence" })
        .getByRole("button", { name: "Close inputs", exact: true })
        .click();
      await expect(page.getByRole("button", { name: "Show panel", exact: true })).toBeFocused();
    }
    for (const theme of ["dark", "light"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(result.violations).toEqual([]);
      const switcher = page.getByRole("button", {
        name: "Solution: Facility Operations",
        exact: true,
      });
      await switcher.click();
      const menuReport = await new AxeBuilder({ page })
        .include(".product-header--application")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(menuReport.violations).toEqual([]);
      await page.keyboard.press("Escape");
      await page.screenshot({ path: info.outputPath(`${width}-${theme}.png`) });
    }
  });
