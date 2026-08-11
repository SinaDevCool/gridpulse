import { expect, test } from "@playwright/test";

test("public product navigation contains exactly the 3 product stages", async ({ page }) => {
  await page.goto("/activation");
  const navigation = page.getByRole("navigation", { name: "GridPulse product stages" });
  await expect(navigation.getByRole("link")).toHaveCount(3);
  await expect(navigation.getByRole("link", { name: /Find Capacity/ })).toBeVisible();
  await expect(navigation.getByRole("link", { name: /Plan Activation/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(navigation.getByRole("link", { name: /Run Operations/ })).toBeVisible();
  await expect(page.getByText(/Sign in/i)).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Grid connection lifecycle" })).toHaveCount(0);
});

test("activation is public and its evidence disclosure works", async ({ page }) => {
  await page.goto("/activation");
  await expect(
    page.getByRole("heading", { name: "Plan a Flexible Grid Connection" }),
  ).toBeVisible();
  await expect(page.getByText("500 MW", { exact: true }).first()).toBeVisible();
  const disclosure = page.getByText("Calculation & Evidence Details", { exact: true });
  await disclosure.click();
  await expect(page.getByText("Estimated restrictions")).toBeVisible();
  await disclosure.click();
  await expect(page.getByText("Estimated restrictions")).toBeHidden();
  await page.getByRole("link", { name: "Continue to Operations" }).click();
  await expect(page).toHaveURL(/\/operations$/);
});

test("operations is public and remains explicitly simulation-only", async ({ page }) => {
  await page.goto("/operations");
  await expect(page.getByRole("heading", { name: "Operate Within Approved Limits" })).toBeVisible();
  await expect(page.getByText("SIMULATION", { exact: true })).toBeVisible();
  await expect(page.getByText("Not authorized", { exact: true })).toBeVisible();
  await expect(page.getByText("FAIL CLOSED", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to Activation" }).click();
  await expect(page).toHaveURL(/\/activation$/);
});

test("the 3-stage product navigation fits mobile without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/activation");
  await expect(page.getByRole("navigation", { name: "GridPulse product stages" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
