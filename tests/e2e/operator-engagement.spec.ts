import { expect, test } from "@playwright/test";

test("operator evidence review remains inside the private workspace", async ({ page }) => {
  await page.goto("/evidence-review");
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign In to Continue" })).toHaveAttribute(
    "href",
    /auth\?redirect=.*evidence-review/,
  );
});

test("public routes do not expose private engagement records", async ({ request }) => {
  const response = await request.get("/rest/v1/operator_engagements");
  expect([401, 404]).toContain(response.status());
});
