import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("Power Operations onboarding has no serious or critical violations", async ({ page }) => {
  await page.goto("/operations");
  await expect(page.getByRole("heading", { name: "Power Operations", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Show|Hide) panel/ })).toBeEnabled();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = result.violations.filter(
    (item) => item.impact === "serious" || item.impact === "critical",
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});
