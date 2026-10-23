import { expect, test } from "@playwright/test";
import path from "node:path";
import { openEvidenceInputs } from "./operations-inputs";

test("theme persists on the Operations workspace", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("gridpulse-theme")) localStorage.setItem("gridpulse-theme", "dark");
  });
  await page.goto("/operations");
  await expect(page.getByRole("heading", { name: "Power Operations" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("gridpulse-theme")))
    .toBe("dark");
  const theme = page.getByRole("button", { name: "Theme: dark. Switch to light." });
  await expect(theme).toBeVisible();
  await theme.click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("gridpulse-theme")))
    .toBe("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("Operations imports real history without presenting it as a forecast or dispatch approval", async ({
  page,
}) => {
  await page.goto("/operations?view=power");
  await openEvidenceInputs(page);
  await page
    .getByLabel("Facility meter CSV")
    .setInputFiles(path.resolve("e2e/fixtures/operations-real-sample.csv"));
  await expect(page.getByText(/facility meter records loaded/)).toBeVisible();
  await expect(page).toHaveURL(/mode=historical/);
  await expect(page.locator(".ops-assessment-notice")).toContainText("not live control");
  await page.getByText("Assessment context", { exact: true }).click();
  await expect(page.locator(".power-context-details")).toContainText("no equipment commands");
  await expect(page.getByRole("button", { name: /Execute dispatch/i })).toHaveCount(0);
  await page.getByRole("link", { name: "Compute & Workloads", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Compute and Workloads", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Power & Battery", exact: true }).click();
  await expect(page.getByText(/facility meter records loaded/)).toBeVisible();
});

test("Operations rejects incomplete imported evidence without changing data mode", async ({
  page,
}) => {
  await page.goto("/operations?view=power");
  await openEvidenceInputs(page);
  await page.getByLabel("Facility meter CSV").setInputFiles({
    name: "invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("timestamp,value\n2026-09-25T00:00:00Z,42"),
  });
  await expect(page.getByRole("alert")).toContainText("Required columns");
  await expect(page).not.toHaveURL(/mode=historical/);
});

test("Operations remains legible and free of horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("gridpulse-theme", "dark"));
  await page.goto("/operations");
  await expect(page.getByRole("button", { name: /^(Show|Hide) panel/ })).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
  expect(
    await page
      .getByRole("button", { name: /^(Show|Hide) panel/ })
      .evaluate((button) => Number.parseFloat(getComputedStyle(button).fontSize)),
  ).toBeGreaterThanOrEqual(13);
  const tabSizes = await page
    .getByRole("navigation", { name: "Power Operations views" })
    .getByRole("link")
    .evaluateAll((buttons) =>
      buttons.map((button) => ({
        width: button.getBoundingClientRect().width,
        height: button.getBoundingClientRect().height,
      })),
    );
  expect(tabSizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
});
