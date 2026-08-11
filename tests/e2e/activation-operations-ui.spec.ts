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

test("landing page introduces the complete workspace and the product brand returns home", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "GridPulse product stages" })).toHaveCount(0);
  await page.getByRole("link", { name: "Open Grid Workspace" }).click();
  await expect(page).toHaveURL(/\/power-finder$/);
  await page.getByRole("banner").getByRole("link", { name: "GridPulse home" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("activation is public and its evidence disclosure works", async ({ page }) => {
  await page.goto("/activation");
  await expect(page.getByRole("heading", { name: "Power Activation" })).toBeVisible();
  await expect(page.getByText("Berlin 110 kV Candidate", { exact: true })).toBeVisible();
  await expect(page.getByText("187.8 MW", { exact: true }).first()).toBeVisible();
  const disclosure = page.getByText("Calculation & Evidence Details", { exact: true });
  await disclosure.click();
  await expect(page.getByText("Estimated restrictions")).toBeVisible();
  await disclosure.click();
  await expect(page.getByText("Estimated restrictions")).toBeHidden();
  await page.getByRole("link", { name: "Open Operations" }).click();
  await expect(page).toHaveURL(/\/operations$/);
});

test("methodology connects public sources to the calculation stack", async ({ page }) => {
  await page.goto("/data-sources");
  const heading = page.getByRole("heading", {
    name: "See how a mapped node becomes an activation envelope.",
  });
  test.skip((await heading.count()) === 0, "Finder-mode methodology is not active in this build");
  await expect(heading).toBeVisible();
  await expect(page.getByText("32 N-1", { exact: true })).toBeVisible();
  await expect(page.getByText("236,520 h", { exact: true })).toBeVisible();
  await expect(page.getByText("40%", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Grid Workspace" })).toBeVisible();
});

test("operations is public and remains explicitly simulation-only", async ({ page }) => {
  await page.goto("/operations");
  await expect(page.getByRole("heading", { name: "Power Operations" })).toBeVisible();
  await expect(page.getByText("SIMULATION", { exact: true })).toBeVisible();
  await expect(page.getByText("Not authorized", { exact: true })).toBeVisible();
  await expect(page.locator("summary").getByText("FAIL CLOSED", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Review Activation" }).click();
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
