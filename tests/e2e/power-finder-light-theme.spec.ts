import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("gridpulse-theme", "light"));
});

test("Power Finder light mode uses coherent rail, form and map-control surfaces", async ({ page }) => {
  await page.goto("/power-finder");

  await expect(page.getByRole("button", { name: /Theme: light/ })).toBeVisible();
  await expect(page.locator(".power-finder-page")).toBeVisible();

  const palette = await page.locator(".power-finder-page").evaluate((workspace) => {
    const style = (selector: string) =>
      getComputedStyle(workspace.querySelector<HTMLElement>(selector)!);
    return {
      colorScheme: getComputedStyle(workspace).colorScheme,
      pageBackground: getComputedStyle(workspace).backgroundColor,
      railBackground: style(".power-finder-sidebar").backgroundColor,
      controlsBackground: style(".finder-screening-controls").backgroundColor,
      formBackground: style(".finder-project-grid--primary").backgroundColor,
      formBorder: style(".finder-project-grid--primary").borderColor,
      mapToggleBackground: style(".power-finder-sidebar-toggle").backgroundColor,
    };
  });

  expect(palette).toEqual({
    colorScheme: "light",
    pageBackground: "rgb(233, 238, 242)",
    railBackground: "rgb(244, 247, 249)",
    controlsBackground: "rgb(255, 255, 255)",
    formBackground: "rgb(247, 249, 251)",
    formBorder: "rgb(203, 213, 223)",
    mapToggleBackground: "rgba(255, 255, 255, 0.96)",
  });
});

test("Power Finder discovery and empty-result states remain light", async ({ page }) => {
  await page.goto("/power-finder?workflow=discover&region=DE-BB");

  await expect(page.locator(".finder-discovery-intro")).toBeVisible();
  await expect(page.locator(".finder-discovery-intro")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator(".finder-discovery-energy-filters")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
});

test("Power Finder light workspace remains contained on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/power-finder");

  await expect(page.locator(".power-finder-page")).toBeVisible();
  await expect(page.locator(".power-finder-sidebar")).toHaveCSS(
    "background-color",
    "rgb(244, 247, 249)",
  );
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 390);
});
