import { expect, test } from "@playwright/test";

test("reviews and exports the credential-free German validation case", async ({ page }) => {
  await page.goto("/validation-case");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Four inspectable connection options",
  );
  const options = page.getByTestId("connection-options").locator("[data-option]");
  await expect(options).toHaveCount(6);
  await expect(page.locator('[data-option="requested_firm"]')).toContainText("Requested firm");
  await expect(page.locator('[data-option="reduced_firm"]')).toContainText(
    "fails minimum viable capacity",
  );
  await expect(page.getByText("No network capacity", { exact: false }).first()).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download review artifact" }).click();
  expect((await download).suggestedFilename()).toBe("gridpulse-de-validation-case.json");
});
