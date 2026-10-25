import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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

test("landing gives both independent services clear destinations and honest product proof", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Choose the site. Plan the operation.",
  );
  await expect(
    page.getByRole("link", { name: "Open Power Finder", exact: true }).first(),
  ).toHaveAttribute("href", "/power-finder");
  await expect(
    page.getByRole("link", { name: "Explore Operations demo", exact: true }).first(),
  ).toHaveAttribute("href", "/operations");
  await expect(page.getByText("Synthetic MILP demo · read-only", { exact: true })).toBeVisible();
  for (const image of await page.locator("main img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute("loading", "lazy");
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
      )
      .toBe(true);
  }
  expect(
    requests.some((url) => /maplibre|\/auth\/v1\/signup|\/v1\/jobs|\/api\/power-finder/.test(url)),
  ).toBe(false);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
  ).toEqual([]);
  await page.getByRole("link", { name: "Explore Operations demo", exact: true }).first().click();
  await expect(page).toHaveURL(/\/operations/);
});

test("landing remains readable and both services reachable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  const nav = page.getByRole("navigation", { name: "Public navigation" });
  await expect(nav.getByRole("link", { name: "Site Selection", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Facility Operations", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
  ).toEqual([]);
});

test("legacy activation redirects safely to Power Finder", async ({ page }) => {
  await page.goto("/activation");
  await expect(page).toHaveURL(/\/power-finder$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
