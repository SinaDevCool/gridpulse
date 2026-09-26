import { expect, test } from "@playwright/test";

test("pilot-ready laboratory redirects safely when its capability is unavailable", async ({
  page,
}) => {
  await page.goto("/pilot-ready");
  await expect(page).toHaveURL(/\/power-finder$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
