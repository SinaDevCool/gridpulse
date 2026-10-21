import { expect, test } from "@playwright/test";
test("display zoom does not request a new plan and legacy tomorrow is not a forecast", async ({
  page,
}) => {
  let assessments = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/api/operations/assess")) assessments++;
  });
  await page.goto("/operations?window=tomorrow&view=overview");
  await expect(page).toHaveURL(/window=today/);
  await expect(page.getByRole("button", { name: /^Inputs/ })).toBeEnabled();
  const select = page.locator(".operations-context-strip .operations-select-trigger").first();
  await expect(page.locator('select[name="operating-window"] option')).toHaveCount(3);
  await expect(page.locator(".ops-service-status")).toContainText("Calculation service available");
  const before = assessments;
  await select.click();
  await page.getByRole("option", { name: "4-hour risk inspection", exact: true }).click();
  await expect(page.locator(".ops-context-summary")).toContainText("4-hour risk inspection");
  await expect(page.getByText(/240 minutes displayed/)).toBeVisible();
  await select.click();
  await page.getByRole("option", { name: "Assessed peak", exact: true }).click();
  await expect(page.getByText(/15 minutes displayed/)).toBeVisible();
  expect(assessments).toBe(before);
  await page.getByRole("link", { name: "Compute & Workloads", exact: true }).click();
  await expect(page.getByText(/Aggregate recovery gap/)).toContainText("1.7");
});
