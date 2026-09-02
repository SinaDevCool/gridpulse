import { expect, test } from "@playwright/test";

test("public product navigation focuses on property and grid qualification", async ({ page }) => {
  await page.goto("/power-finder");
  const navigation = page.getByRole("navigation", { name: "Grid workspace navigation" });
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
  await page.getByRole("link", { name: "Explore Power Finder" }).click();
  await expect(page).toHaveURL(/\/power-finder$/);
});

for (const legacyPath of ["/activation", "/operations"]) {
  test(`${legacyPath} redirects safely to Power Finder`, async ({ page }) => {
    await page.goto(legacyPath);
    await expect(page).toHaveURL(/\/power-finder$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

test("focused workspace navigation fits mobile without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/power-finder");
  await expect(page.getByRole("navigation", { name: "Grid workspace navigation" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
});
