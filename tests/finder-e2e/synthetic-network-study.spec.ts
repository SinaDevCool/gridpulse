import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("legacy synthetic-study links preserve inputs and move into Power Finder", async ({
  page,
}) => {
  await page.goto(
    "/synthetic-network-study?project=data_centre&mw=20&exportMw=0&batteryMw=10&batteryMwh=30",
  );
  await expect(page).toHaveURL(/\/power-finder/);
  await expect(page).not.toHaveURL(/study=activation/);
  await expect(page.getByRole("heading", { name: /connection context/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Synthetic Study" })).toHaveCount(0);
});

test("public Power Finder does not present synthetic activation as candidate capacity", async ({
  page,
}) => {
  await page.goto(
    "/power-finder?lat=52.31&lng=13.36&mw=20&distance=20&flexibleMw=4&batteryMw=10&batteryMwh=30",
  );
  const candidates = page.getByRole("button", { name: /Show .* on map, .*\/100/ });
  await expect(candidates.first()).toBeVisible({ timeout: 15_000 });
  await candidates.first().click();
  await expect(page.getByRole("button", { name: "Assess activation pathways" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const result = await new AxeBuilder({ page })
    .include(".power-finder-detail")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    result.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? "")),
  ).toEqual([]);
});
