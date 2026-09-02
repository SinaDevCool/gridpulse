import { expect, test } from "@playwright/test";

test("homepage decision links match their promised destinations", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Open Site Pipeline" }).first()).toHaveAttribute(
    "href",
    "/portfolio",
  );
  await expect(page.getByRole("link", { name: "Explore Power Finder" })).toHaveAttribute(
    "href",
    "/power-finder",
  );
});

test("pilot scope and application form are deep-linkable", async ({ page }) => {
  await page.goto("/pilot#what-is-included");
  await expect(page.getByRole("heading", { name: "What the Pilot Includes" })).toBeVisible();
  await expect(page.locator("#pilot-form")).toBeAttached();
});

test("product tour final CTA does not link to itself", async ({ page }) => {
  await page.goto("/demo");
  const finalCta = page.locator(".public-final-cta");
  await expect(finalCta.getByRole("link", { name: "Review the Assessment" })).toHaveAttribute(
    "href",
    "/service",
  );
  await expect(finalCta.getByRole("link", { name: "View the Product Tour" })).toHaveCount(0);
});

test("methodology route identifies itself and exposes source governance", async ({ page }) => {
  await page.goto("/data-sources");
  const header = page.locator(".public-header");
  await expect(header.getByRole("link", { name: "Methodology & Sources" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    page.getByRole("heading", { name: "Different sources support different decisions." }),
  ).toBeVisible();
  await expect(page.getByText("Last verified", { exact: false }).first()).toBeVisible();
});

test("pilot first step has no meaningless back action", async ({ page }) => {
  await page.goto("/pilot#pilot-form");
  const form = page.locator("#pilot-form");
  await expect(form.getByRole("button", { name: "Back" })).toHaveCount(0);
  await expect(form.getByRole("button", { name: "Continue to Location" })).toBeVisible();
  await expect(form.locator(".pilot-form-footer .pilot-submit-boundary")).toBeVisible();
});

test("pilot header continues the current application", async ({ page }) => {
  await page.goto("/pilot");
  await expect(
    page.locator(".public-header").getByRole("link", { name: "Continue Application" }),
  ).toHaveAttribute("href", "/pilot#pilot-form");
});
