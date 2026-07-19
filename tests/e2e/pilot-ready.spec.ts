import { expect, test } from "@playwright/test";

test("runs the credential-free Phase 4.5 pilot workflow", async ({ page }) => {
  await page.goto("/pilot-ready");
  await expect(
    page.getByRole("heading", {
      name: "Bring one real load profile. Leave with an inspectable operator conversation.",
    }),
  ).toBeVisible();
  await expect(page.getByTestId("profile-import")).toContainText("Import CSV or XLSX");
  await expect(page.getByTestId("candidate-portfolio").getByRole("row")).toHaveCount(4);
  await expect(page.getByTestId("option-laboratory").locator("article")).toHaveCount(6);
  await expect(page.getByTestId("operations-simulation")).toContainText(
    "Simulation—not a network instruction",
  );
  await expect(page.getByTestId("review-gates")).toContainText("Independent review required");
  await expect(page.getByTestId("evidence-room")).toContainText("Single-line diagram · missing");
  const download = page.waitForEvent("download");
  await page
    .getByTestId("operator-package")
    .getByRole("button", { name: "Download JSON package" })
    .click();
  expect((await download).suggestedFilename()).toBe("gridpulse-operator-engagement-package.json");
});
