import { expect, test } from "@playwright/test";

const publicRoutes = [
  ["/", "Build a credible route to power in Germany."],
  ["/service", "Turn an uncertain site into an operator-ready connection strategy."],
  ["/demo", "Follow one German project from site screening to operator preparation."],
  [
    "/data-sources",
    "Know what supports the decision—and what still requires operator confirmation.",
  ],
  ["/pilot", "What the Pilot Includes for One Real Connection Decision"],
] as const;

for (const [route, heading] of publicRoutes) {
  test(`${route} uses the public journey and keeps its primary content visible`, async ({
    page,
  }) => {
    await page.goto(route);
    await expect(page.getByRole("navigation", { name: "Public navigation" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Start a Pilot", exact: true }).first(),
    ).toBeVisible();
  });
}

test("the product tour uses real read-only product interaction without private navigation", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("tab", { name: /Connection scenarios/ })).toBeVisible();
  await page.getByRole("tab", { name: /Connection scenarios/ }).click();
  await expect(page.getByRole("heading", { name: "Connection scenarios" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Portfolio" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "New project" })).toHaveCount(0);
});

test("public navigation remains usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const menuButton = page.getByRole("button", { name: "Open navigation" });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.getByRole("button", { name: "Close navigation" })).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Public navigation" });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Product Tour" })).toBeVisible();
});
