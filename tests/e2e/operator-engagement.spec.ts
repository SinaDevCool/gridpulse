import { expect, test } from "@playwright/test";

test("operator evidence review redirects safely when its workspace capability is unavailable", async ({
  page,
}) => {
  await page.goto("/evidence-review");
  await expect(page).toHaveURL(/\/power-finder$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("public routes do not expose private engagement records", async ({ request }) => {
  const response = await request.get("/rest/v1/operator_engagements");
  expect([401, 404]).toContain(response.status());
});
