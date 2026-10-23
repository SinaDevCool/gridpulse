import { expect, test } from "@playwright/test";

test("public product navigation focuses on property and grid qualification", async ({ page }) => {
  await page.goto("/power-finder");
  const navigation = page.getByRole("navigation", { name: "GridPulse workspace" });
  await expect(navigation.getByRole("link", { name: /Power Finder/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    navigation.getByRole("link", { name: /Plan Activation|Run Operations/ }),
  ).toHaveCount(0);
});

test("landing page presents the focused decision journey", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.locator("main").getByText(/activation strategy|operational envelope/i),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Open Power Finder" }).first().click();
  await expect(page).toHaveURL(/\/power-finder$/);
});

for (const legacyPath of ["/activation"]) {
  test(`${legacyPath} redirects safely to Power Finder`, async ({ page }) => {
    await page.goto(legacyPath);
    await expect(page).toHaveURL(/\/power-finder$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}
