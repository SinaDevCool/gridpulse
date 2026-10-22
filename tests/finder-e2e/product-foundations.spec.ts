import { expect, test } from "@playwright/test";
import path from "node:path";
import { openEvidenceInputs } from "../e2e/operations-inputs";

test("every visible workflow destination resolves to meaningful content", async ({ page }) => {
  await page.goto("/power-finder");
  const navigation = page.getByRole("navigation", { name: "GridPulse workspace" });
  await expect(navigation.getByRole("link")).toHaveCount(2);
  for (const [label, heading] of [
    ["Sites", /Sites|portfolio/i],
    ["Power Finder", /Germany connection context/i],
  ] as const) {
    await navigation.getByRole("link", { name: new RegExp(label) }).click();
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
  }
  await page.getByRole("button", { name: "Solution: Site Selection", exact: true }).click();
  await page.getByRole("link", { name: /Facility Operations Assess/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Power Operations" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Power Operations views" }).getByRole("link"),
  ).toHaveCount(3);
});

test("solution navigation is visible and keyboard-operable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/power-finder");
  await expect(page.getByRole("navigation", { name: "GridPulse workspace" })).toBeVisible();
  const toggle = page.getByRole("button", { name: "Solution: Site Selection", exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await page.getByRole("link", { name: /Facility Operations Assess/ }).click();
  await expect(page).toHaveURL(/operations/);
  await expect(page.getByRole("link", { name: "Overview", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("dormant workspace URLs redirect into the focused product", async ({ page }) => {
  for (const [path, destination] of [
    ["/data-centre-planner", /\/power-finder$/],
    ["/evidence", /\/power-finder$/],
    ["/evidence-review", /\/power-finder$/],
    ["/constraint-explorer", /\/operations(?:\?|$)/],
    ["/reports", /\/portfolio$/],
    ["/activation", /\/power-finder$/],
    ["/operations/site-1", /\/operations(?:\?|$)/],
  ] as const) {
    await page.goto(path);
    await expect(page).toHaveURL(destination);
  }
});

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

test("Power Finder rail follows the resolved light theme", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gridpulse-theme", "light"));
  await page.goto("/power-finder");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".finder-workflow-switch")).toHaveCSS(
    "background-color",
    "rgb(244, 247, 249)",
  );
  await expect(page.locator(".finder-rail-sticky")).toHaveCSS(
    "background-color",
    "rgba(244, 247, 249, 0.98)",
  );
  await page.getByText("Map view & optional layers", { exact: true }).click();
  await expect(page.locator(".power-finder-layer-list label").first()).toHaveCSS(
    "color",
    "rgb(23, 33, 43)",
  );
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
  await expect(page.getByText(/No physical control commands are issued/).first()).toBeVisible();
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
