import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("legacy synthetic-study links preserve inputs and move into Power Finder", async ({
  page,
}) => {
  await page.goto(
    "/synthetic-network-study?project=data_centre&mw=20&exportMw=0&batteryMw=10&batteryMwh=30",
  );
  await expect(page).toHaveURL(/\/power-finder/);
  await expect(page).toHaveURL(/study=activation/);
  await expect(page.getByRole("heading", { name: /connection context/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Synthetic Study" })).toHaveCount(0);
});

test("a selected Power Finder candidate opens the integrated Activation Study", async ({
  page,
}) => {
  await page.goto(
    "/power-finder?lat=52.31&lng=13.36&mw=20&distance=20&flexibleMw=4&batteryMw=10&batteryMwh=30",
  );
  const candidates = page.getByRole("button", { name: /Show .* on map, .*\/100/ });
  await expect(candidates.first()).toBeVisible({ timeout: 15_000 });
  await candidates.first().click();
  await page.getByRole("button", { name: "Explore activation options" }).click();
  const study = page.getByRole("complementary", { name: "Activation Study" });
  await expect(study).toBeVisible();
  await expect(study.getByText(/Representative benchmark.*not calculated capacity/i)).toBeVisible();
  await expect(study.getByText("Activation decision overview")).toBeVisible();
  await study.getByRole("button", { name: "Hourly" }).click();
  await expect(
    study.getByRole("img", { name: /Baseline demand, connection limit/i }),
  ).toBeVisible();
  await study.getByRole("button", { name: "Strategies" }).click();
  await expect(study.getByRole("heading", { name: "Staged connection" })).toBeVisible();
  await expect(study.getByText("Leading representative pathway")).toBeVisible();
  await study.getByRole("button", { name: "Value" }).click();
  await expect(study.getByText("Representative commercial comparison")).toBeVisible();
  await study.getByRole("button", { name: "Evidence" }).click();
  await expect(study.getByText("No node-linked model")).toBeVisible();
  const result = await new AxeBuilder({ page })
    .include(".activation-study-panel")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    result.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? "")),
  ).toEqual([]);
});
