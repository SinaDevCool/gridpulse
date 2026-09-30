import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("gridpulse-theme", "light"));
});

test("Sites renders the portfolio workspace with light surfaces", async ({ page }) => {
  await page.goto("/portfolio");

  await expect(page.getByRole("button", { name: /Theme: light/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sites Under Review" })).toBeVisible();

  const palette = await page.locator(".decision-workspace-page").evaluate((workspace) => {
    const pageStyle = getComputedStyle(workspace);
    const railStyle = getComputedStyle(workspace.querySelector(".decision-workspace-rail")!);
    const mainStyle = getComputedStyle(workspace.querySelector(".decision-workspace-main")!);
    return {
      colorScheme: pageStyle.colorScheme,
      pageBackground: pageStyle.backgroundColor,
      railBackground: railStyle.backgroundColor,
      mainBackground: mainStyle.backgroundColor,
    };
  });

  expect(palette).toEqual({
    colorScheme: "light",
    pageBackground: "rgb(243, 246, 249)",
    railBackground: "rgb(234, 240, 244)",
    mainBackground: "rgb(243, 246, 249)",
  });
});

test("Sites comparison and decision views retain the light workspace", async ({ page }) => {
  await page.goto("/portfolio?view=readiness");
  await expect(page.locator(".decision-workspace-page")).toHaveCSS(
    "background-color",
    "rgb(243, 246, 249)",
  );

  await page.goto("/portfolio?view=decisions");
  await expect(page.locator(".decision-kpi-strip")).toHaveCSS(
    "background-color",
    "rgb(174, 189, 202)",
  );
});

test("Sites light workspace remains usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/portfolio");

  await expect(page.getByRole("heading", { name: "Sites", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /New Site Screening/ })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 390);
});
