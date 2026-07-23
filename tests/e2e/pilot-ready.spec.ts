import { expect, test } from "@playwright/test";

test("keeps the pilot-ready laboratory behind workspace authentication", async ({ page }) => {
  await page.goto("/pilot-ready");
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible({
    timeout: 10_000,
  });
  const signIn = page.getByRole("link", { name: "Sign In to Continue" });
  await expect(signIn).toHaveAttribute("href", /auth\?redirect=.*pilot-ready/);
  await expect(page.getByTestId("profile-import")).toHaveCount(0);
});
