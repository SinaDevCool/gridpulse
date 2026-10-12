import { expect, test } from "@playwright/test";

test("window dropdown keyboard navigation and all tabs preserve context", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/operations?view=overview&window=today&mode=scenario");
  const trigger = page.locator(".operations-context-strip .operations-select-trigger").first();
  await expect(trigger).toBeEnabled();
  await trigger.press("ArrowDown");
  await page.getByRole("option", { name: "Full scenario day", exact: true }).press("Home");
  await expect(page.getByRole("option", { name: "Assessed peak", exact: true })).toBeFocused();
  await page.getByRole("option", { name: "Assessed peak", exact: true }).press("End");
  await expect(
    page.getByRole("option", { name: "Repeat scenario day", exact: true }),
  ).toBeFocused();
  await page.getByRole("option", { name: "Repeat scenario day", exact: true }).press("Escape");
  await expect(trigger).toBeFocused();
  for (const [label, value] of [
    ["Assessed peak", "now"],
    ["4-hour risk window", "next-4h"],
    ["Repeat scenario day", "tomorrow"],
    ["Full scenario day", "today"],
  ]) {
    await trigger.click();
    await page.getByRole("option", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`window=${value}`));
    for (const name of ["Compute & Workloads", "Power & Battery", "Overview"]) {
      await page.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`window=${value}.*mode=scenario`));
    }
  }
});

test("all canonical analysis choices reject invalid contracts without submitting a job", async ({
  page,
}) => {
  let submitted = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/v1/")) submitted++;
  });
  await page.goto("/operations?view=overview");
  await page.getByText("Assessment details & advanced planning", { exact: true }).click();
  await page
    .getByText("Canonical planning, rolling analysis & historical replay", { exact: true })
    .click();
  const panel = page.getByRole("region", { name: "Facility planning workbench" });
  await expect(panel.getByRole("button", { name: "Validate and run" })).toBeDisabled();
  for (const value of [
    "facility_plan",
    "facility_uncertainty",
    "rolling_facility_plan",
    "market_qualification",
    "facility_historical_replay",
  ]) {
    await panel.getByRole("combobox", { name: "Analysis", exact: true }).selectOption(value);
    await panel.getByLabel("Canonical request JSON").fill("{}");
    await panel.getByRole("button", { name: "Validate and run" }).click();
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Validate and run" })).toBeEnabled();
  }
  expect(submitted).toBe(0);
});

test("measured import enables historical selection and switching back retains evidence", async ({
  page,
}) => {
  await page.goto("/operations?view=power&mode=scenario");
  await page.getByRole("button", { name: "Connect evidence" }).click();
  await page.getByLabel("Facility meter CSV").setInputFiles({
    name: "release-meter.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "timestamp,facility_import_mw,operating_limit_mw\n2026-09-26T00:00:00Z,90,100\n2026-09-26T00:15:00Z,92,100",
    ),
  });
  await expect(page).toHaveURL(/mode=historical/);
  const mode = page.locator(".operations-context-strip .operations-select-trigger").last();
  await mode.click();
  await expect(page.getByRole("option", { name: /Live/ })).toBeDisabled();
  await page.getByRole("option", { name: /^Scenario / }).click();
  await expect(page).toHaveURL(/mode=scenario/);
  await mode.click();
  const historical = page
    .locator(".operations-select-popover")
    .getByRole("option", { name: /Historical/ });
  await expect(historical).toBeEnabled();
  await historical.click();
  await expect(page).toHaveURL(/mode=historical/);
  await expect(page.getByText("Measured", { exact: true }).first()).toBeVisible();
});
