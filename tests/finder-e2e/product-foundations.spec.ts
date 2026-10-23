import { expect, test } from "@playwright/test";

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
