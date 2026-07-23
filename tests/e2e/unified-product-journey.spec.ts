import { expect, test } from "@playwright/test";

test("private shell exposes the unified lifecycle and customer destinations", async ({ page }) => {
  await page.goto("/portfolio?q=berlin&stage=screening&sort=name");

  const primary = page.getByRole("navigation", { name: "Primary" });
  await expect(primary.getByRole("link", { name: "Portfolio" })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Power Finder" })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Evidence", exact: true })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Reports" })).toBeVisible();

  const lifecycle = page.getByRole("navigation", { name: "Grid connection lifecycle" });
  for (const stage of ["Discover", "Qualify", "Prepare", "Engage", "Decide", "Learn"]) {
    await expect(lifecycle.getByRole("link", { name: new RegExp(stage) })).toBeVisible();
  }
  await expect(page).toHaveURL(/q=berlin/);
  await expect(page).toHaveURL(/stage=screening/);
  await expect(page).toHaveURL(/sort=name/);
});

test("Power Finder filters are deep-linkable before authentication", async ({ page }) => {
  await page.goto("/power-finder?q=substation&voltage=110&operator=E.DIS&sort=voltage");
  await expect(page).toHaveURL(/q=substation/);
  await expect(page).toHaveURL(/voltage=110/);
  await expect(page).toHaveURL(/operator=E.DIS/);
  await expect(page).toHaveURL(/sort=voltage/);
});
