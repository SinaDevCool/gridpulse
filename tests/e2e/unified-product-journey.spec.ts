import { expect, test } from "@playwright/test";

test("workspace shell exposes the unified decision destinations", async ({ page }) => {
  await page.goto("/portfolio?q=berlin&stage=screening&sort=name");

  const navigation = page.getByRole("navigation", { name: "Grid workspace navigation" });
  for (const destination of [
    "Sites",
    "Power Finder",
    "Constraints",
    "Planner",
    "Activation",
    "Operations",
    "Evidence",
    "Reports",
  ]) {
    await expect(navigation.getByRole("link", { name: new RegExp(destination) })).toBeVisible();
  }
  await expect(page).toHaveURL(/q=berlin/);
  await expect(page).toHaveURL(/stage=screening/);
  await expect(page).toHaveURL(/sort=name/);
});

test("Power Finder opportunity criteria are deep-linkable before authentication", async ({
  page,
}) => {
  await page.goto(
    "/power-finder?q=substation&voltage=110&operator=E.DIS&sort=voltage&mw=250&distance=10&region=DE&mapMode=evidence&candidate=site-a%3Anode-a&compare=site-a%3Anode-a",
  );
  await expect(page).toHaveURL(/q=substation/);
  await expect(page).toHaveURL(/voltage=110/);
  await expect(page).toHaveURL(/operator=E.DIS/);
  await expect(page).toHaveURL(/sort=voltage/);
  await expect(page).toHaveURL(/mw=250/);
  await expect(page).toHaveURL(/distance=10/);
  await expect(page).toHaveURL(/region=DE/);
  await expect(page).toHaveURL(/mapMode=evidence/);
  await expect(page).toHaveURL(/candidate=site-a/);
  await expect(page).toHaveURL(/compare=site-a/);
});
