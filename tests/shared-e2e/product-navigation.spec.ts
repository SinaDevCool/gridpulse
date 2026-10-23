import { expect, test } from "@playwright/test";

test("every visible workflow destination resolves to meaningful content", async ({ page }) => {
  await page.goto("/power-finder");
  const navigation = page.getByRole("navigation", { name: "GridPulse workspace" });
  await expect(navigation.getByRole("link")).toHaveCount(2);
  for (const [label, heading] of [
    ["Sites", /Sites|portfolio/i],
    ["Power Finder", /Germany connection context/i],
  ] as const) {
    await navigation.getByRole("link", { name: new RegExp(label) }).click();
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
  }
  await page.getByRole("button", { name: "Solution: Site Selection", exact: true }).click();
  await page.getByRole("link", { name: /Facility Operations Assess/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Power Operations" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Power Operations views" }).getByRole("link"),
  ).toHaveCount(3);
});

test("solution navigation is visible and keyboard-operable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/power-finder");
  await expect(page.getByRole("navigation", { name: "GridPulse workspace" })).toBeVisible();
  const toggle = page.getByRole("button", { name: "Solution: Site Selection", exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await page.getByRole("link", { name: /Facility Operations Assess/ }).click();
  await expect(page).toHaveURL(/operations/);
  await expect(page.getByRole("link", { name: "Overview", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("dormant workspace URLs redirect into the focused product", async ({ page }) => {
  for (const [path, destination] of [
    ["/data-centre-planner", /\/power-finder$/],
    ["/evidence", /\/power-finder$/],
    ["/evidence-review", /\/power-finder$/],
    ["/constraint-explorer", /\/operations(?:\?|$)/],
    ["/reports", /\/portfolio$/],
    ["/activation", /\/power-finder$/],
    ["/operations/site-1", /\/operations(?:\?|$)/],
  ] as const) {
    await page.goto(path);
    await expect(page).toHaveURL(destination);
  }
});
