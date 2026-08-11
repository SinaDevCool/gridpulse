import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public Finder has no serious or critical automated accessibility violations", async ({
  page,
}) => {
  await page.goto("/power-finder?lat=52.3316&lng=13.4995&mw=20&distance=20&region=DE-BB");
  await expect(page.getByRole("heading", { name: "Grid candidates" })).toBeVisible({
    timeout: 15_000,
  });
  const result = await new AxeBuilder({ page })
    .exclude(".maplibregl-canvas")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = result.violations.filter(
    (item) => item.impact === "serious" || item.impact === "critical",
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});

test("Site Pipeline and Decision Centre have no serious or critical violations", async ({
  page,
}) => {
  await page.goto("/power-finder?lat=52.52&lng=13.405&mw=55&projectType=data_centre");
  await expect(page.getByText(/candidate site-to-node matches/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /Create pipeline site|Shortlist for/i }).click();
  await expect(page.getByRole("button", { name: /Screening saved/i })).toBeDisabled();
  for (const path of ["/portfolio", "/reports"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = result.violations.filter(
      (item) => item.impact === "serious" || item.impact === "critical",
    );
    expect(blocking, `${path}: ${JSON.stringify(blocking, null, 2)}`).toEqual([]);
  }
  await page.goto("/portfolio");
  await page.getByRole("button", { name: /Untitled screening project/i }).click();
  await page.getByRole("link", { name: "Open Site Workspace" }).click();
  const siteResult = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    siteResult.violations.filter((item) => item.impact === "serious" || item.impact === "critical"),
    JSON.stringify(siteResult.violations, null, 2),
  ).toEqual([]);
});
