import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public Finder has no serious or critical automated accessibility violations", async ({
  page,
}) => {
  await page.goto("/power-finder?lat=52.3316&lng=13.4995&mw=20&distance=20&region=DE-BB");
  await expect(page.getByRole("heading", { name: "Candidate connection points" })).toBeVisible({
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
