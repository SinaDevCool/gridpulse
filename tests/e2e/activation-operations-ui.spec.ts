import { expect, test } from "@playwright/test";

for (const workspace of ["activation", "operations"] as const) {
  test(`${workspace} uses the focused private workspace shell`, async ({ page }) => {
    await page.goto(`/${workspace}`);
    await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Grid connection lifecycle" })).toHaveCount(
      0,
    );
    await expect(page.getByLabel("Evidence and product scope")).toBeVisible();
    await expect(page.getByText("Evidence status controls every conclusion")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign In to Continue" })).toHaveAttribute(
      "href",
      new RegExp(`auth\\?redirect=.*${workspace}`),
    );
    await expect(page.getByRole("link", { name: "Activation", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Operations", exact: true })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
}

test("focused workspaces remain contained on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/activation");
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
