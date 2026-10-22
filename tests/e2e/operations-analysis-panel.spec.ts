import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openScenarioInputs } from "./operations-inputs";

for (const view of ["overview", "compute", "power"]) {
  test(`${view}: specialist analysis opens outside the rail and preserves the draft`, async ({
    page,
  }) => {
    await page.goto(`/operations?view=${view}&window=today&mode=scenario`);
    await openScenarioInputs(page);
    const trigger = page.getByRole("button", { name: "Open planning workbench" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Planning workbench" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Planning workbench" })).toBeFocused();
    await expect(dialog.getByRole("button", { name: "Validate and run" })).toBeDisabled();
    if (view === "overview") await page.screenshot({ path: ".codex-tmp/analysis-desktop.png" });
    await dialog.getByLabel("Canonical request JSON").fill("not valid JSON");
    await dialog.getByRole("button", { name: "Validate and run" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(dialog.getByLabel("Canonical request JSON")).toHaveValue("not valid JSON");
    const results = await new AxeBuilder({ page }).include(".ops-analysis-dialog").analyze();
    expect(results.violations).toEqual([]);
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    if (view === "overview") {
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
      });
      const dark = await new AxeBuilder({ page }).include(".ops-analysis-dialog").analyze();
      expect(dark.violations).toEqual([]);
      await page.screenshot({ path: ".codex-tmp/analysis-dark.png" });
    }
  });
}

test("scenario footer separates unapplied edits, discard and recalculation", async ({ page }) => {
  await page.goto("/operations");
  const panel = await openScenarioInputs(page);
  const actions = panel.getByRole("group", { name: "Scenario actions" });
  await expect(actions.getByRole("button", { name: "Recalculate Scenario" })).toBeEnabled();
  await expect(actions.getByRole("button", { name: "Discard changes" })).toBeDisabled();
  const limit = panel.getByRole("spinbutton", { name: "Facility Limit MW", exact: true });
  await limit.fill("110");
  await expect(actions).toContainText("Changes ready to apply");
  await actions.getByRole("button", { name: "Discard changes" }).click();
  await expect(limit).toHaveValue("100");
  await limit.fill("110");
  await actions.getByRole("button", { name: "Recalculate Scenario" }).click();
  await expect(actions).toContainText("Scenario inputs applied");
  await expect(limit).toHaveValue("110");
});

test("mobile analysis has usable controls and returns to the input drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/operations");
  await openScenarioInputs(page);
  await page.getByRole("button", { name: "Open planning workbench" }).click();
  const dialog = page.getByRole("dialog", { name: "Planning workbench" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: ".codex-tmp/analysis-mobile.png" });
  await dialog.getByLabel("Analysis", { exact: true }).selectOption("rolling_facility_plan");
  await expect(dialog.getByLabel("Canonical request JSON")).toHaveAttribute(
    "placeholder",
    /rolling facility plan/,
  );
  await dialog.getByRole("button", { name: "Close planning workbench" }).click();
  await expect(page.getByRole("button", { name: "Open planning workbench" })).toBeFocused();
  await page.getByRole("button", { name: "Close inputs", exact: true }).click();
  await expect(page.locator("#operations-inputs")).not.toBeVisible();
});
