import { expect, test } from "@playwright/test";
import { openScenarioInputs } from "./operations-inputs";

test("docked rail expands results without recalculating or losing drafts", async ({ page }) => {
  let assessments = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/operations/assess") && request.method() === "POST")
      assessments++;
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/operations");
  await expect(page.locator(".ops-service-status")).toContainText("available");
  const panel = await openScenarioInputs(page);
  await panel.getByLabel("Facility Limit", { exact: false }).fill("125");
  const count = assessments;
  const before = await page.locator(".ops-dashboard-canvas").boundingBox();
  expect((await page.locator("main.operations-v2").boundingBox())!.x).toBe(0);
  expect((await panel.boundingBox())!.width).toBe(352);
  await page.getByRole("button", { name: "Hide panel", exact: true }).click();
  await expect(panel).toBeHidden();
  expect((await page.locator(".ops-dashboard-canvas").boundingBox())!.width).toBeGreaterThan(
    before!.width,
  );
  await page.getByRole("link", { name: "Compute & Workloads", exact: true }).click();
  await page.getByRole("button", { name: "Show panel", exact: true }).click();
  await expect(panel.getByLabel("Facility Limit", { exact: false })).toHaveValue("125");
  expect(assessments).toBe(count);
  await panel.locator(".ops-input-body").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(panel.getByRole("button", { name: "Recalculate Scenario" })).toBeInViewport();
  await expect(panel.getByRole("button", { name: "Discard changes" })).toBeInViewport();
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.getByRole("button", { name: "Show panel", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.getByRole("button", { name: "Hide panel", exact: true })).toBeVisible();
  await expect(page.getByLabel("Facility Limit", { exact: false })).toHaveValue("125");
});

for (const width of [390, 768, 1024, 1280, 1440, 2560]) {
  test(`workspace fits all tabs at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/operations");
    await expect(page.locator(".ops-service-status")).toContainText("available");
    for (const label of ["Overview", "Compute & Workloads", "Power & Battery"]) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page.locator(".ops-canvas-content")).toBeVisible();
      await expect(page.locator(".ops-canvas-toolbar")).not.toContainText(
        /Power Operations|Power & Battery/,
      );
      const heading = page.getByRole("heading", { level: 1 });
      await expect(heading).toHaveClass("sr-only");
      await expect(heading).toHaveText(label === "Power & Battery" ? label : "Power Operations");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const content = await page.locator(".ops-canvas-content").boundingBox();
      expect(content!.width).toBeGreaterThan(300);
      expect(content!.y + content!.height).toBeLessThanOrEqual(900);
    }
    if (width < 1100) {
      await page.getByRole("button", { name: "Show panel", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Inputs & evidence" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Recalculate Scenario" })).toBeInViewport();
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
    }
    await page.screenshot({ path: `test-results/workspace-${width}.png` });
  });
}
