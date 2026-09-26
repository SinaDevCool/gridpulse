import { expect, test } from "@playwright/test";
import path from "node:path";

test("every visible workflow destination resolves to meaningful content", async ({ page }) => {
  await page.goto("/power-finder");
  const navigation = page.getByRole("navigation", { name: "GridPulse workspace" });
  await expect(navigation).toBeVisible();
  const expectations = [
    ["Sites", /Sites|portfolio/i],
    ["Power Finder", /Germany connection context/i],
    ["Operations", /Run more compute within the power limit/i],
  ] as const;
  await expect(navigation.getByRole("link")).toHaveCount(3);
  await expect(navigation).not.toContainText(/\b0[123]\b/);
  for (const hidden of ["Planner", "Activation", "Constraints", "Evidence", "Reports"]) {
    await expect(navigation.getByRole("link", { name: new RegExp(hidden) })).toHaveCount(0);
  }
  for (const [label, heading] of expectations) {
    await navigation.getByRole("link", { name: new RegExp(label) }).click();
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
  }
});

test("workspace destinations behave as independent navigation on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/power-finder");
  const navigation = page.getByRole("navigation", { name: "GridPulse workspace" });
  const toggle = page.getByRole("button", { name: "Open workspace navigation" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(page.getByRole("button", { name: "Close workspace navigation" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link")).toHaveCount(3);
  const targets = await navigation.getByRole("link").evaluateAll((links) =>
    links.map((link) => ({
      width: link.getBoundingClientRect().width,
      height: link.getBoundingClientRect().height,
    })),
  );
  expect(targets.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await navigation.getByRole("link", { name: /Operations/ }).click();
  await expect(page).toHaveURL(/\/operations\?view=overview$/);
  await expect(page.getByRole("link", { name: /Operations/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("dormant workspace URLs redirect into the focused product", async ({ page }) => {
  for (const [path, destination] of [
    ["/data-centre-planner", /\/power-finder$/],
    ["/evidence", /\/power-finder$/],
    ["/evidence-review", /\/power-finder$/],
    ["/constraint-explorer", /\/operations\?view=overview$/],
    ["/reports", /\/portfolio$/],
    ["/activation", /\/power-finder$/],
    ["/operations/site-1", /\/operations\?view=overview$/],
  ] as const) {
    await page.goto(path);
    await expect(page).toHaveURL(destination);
  }
});

test("theme persists on the Operations workspace", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("gridpulse-theme")) localStorage.setItem("gridpulse-theme", "dark");
  });
  await page.goto("/operations");
  await expect(
    page.getByRole("heading", { name: "Run more compute within the power limit" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("gridpulse-theme")))
    .toBe("dark");
  const theme = page.getByRole("button", { name: "Theme: dark. Switch to light." });
  await expect(theme).toBeVisible();
  await theme.click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("gridpulse-theme")))
    .toBe("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("Power Finder rail follows the resolved light theme", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gridpulse-theme", "light"));
  await page.goto("/power-finder");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".finder-workflow-switch")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator(".finder-rail-sticky")).toHaveCSS(
    "background-color",
    "rgba(255, 255, 255, 0.96)",
  );
  await page.getByText("Map view & optional layers", { exact: true }).click();
  await expect(page.locator(".power-finder-layer-list label").first()).toHaveCSS(
    "color",
    "rgb(16, 24, 40)",
  );
});

test("Operations loads a real CSV and keeps unaccepted forecasts unpublished", async ({ page }) => {
  await page.goto("/operations");
  await expect(page.locator("main.operations-page")).toHaveAttribute("data-hydrated", "true", {
    timeout: 20_000,
  });
  await page.getByLabel("Facility name").fill("E2E Facility");
  await page.getByLabel("Contracted import limit (MW)").fill("50");
  await page.getByLabel("Limit evidence").selectOption("contract_reviewed");
  const upload = page.getByLabel("Operational CSV");
  await upload.setInputFiles(path.resolve("e2e/fixtures/operations-real-sample.csv"));
  await expect(page.getByText(/valid measurements loaded/)).toBeVisible();
  await page.getByRole("button", { name: "Analyse Measured History" }).click();

  await expect(page.getByText("4 MW", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Power", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Power Envelope" })).toBeVisible();
  await page.getByRole("button", { name: "Compute" }).click();
  await expect(page.getByRole("heading", { name: "Compute intelligence" })).toBeVisible();
  await page.getByRole("button", { name: "Battery" }).click();
  await expect(page.getByRole("heading", { name: "Battery intelligence" })).toBeVisible();
  await page.getByRole("button", { name: "Forecast" }).click();
  await expect(page).toHaveURL(/view=forecast/);
  await expect(page.getByText("No accepted forecast").first()).toBeVisible();
  await page.getByRole("button", { name: "Verification" }).click();
  await expect(page.getByText("Automatic dispatch: not authorized")).toBeVisible();
  await page.getByRole("button", { name: "Data health" }).click();
  await expect(page.getByText("NVIDIA DCGM-compatible field")).toBeVisible();
});

test("Operations explains incomplete evidence and focuses the correction", async ({ page }) => {
  await page.goto("/operations");
  await expect(page.locator("main.operations-page")).toHaveAttribute("data-hydrated", "true", {
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Analyse Measured History" }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Check the highlighted inputs and try again");
  await expect(alert).toBeFocused();
});

test("Operations remains legible and free of horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("gridpulse-theme", "dark"));
  await page.goto("/operations");
  await expect(page.locator("main.operations-page")).toHaveAttribute("data-hydrated", "true", {
    timeout: 20_000,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
  expect(
    await page
      .getByRole("button", { name: "Analyse Measured History" })
      .evaluate((button) => Number.parseFloat(getComputedStyle(button).fontSize)),
  ).toBeGreaterThanOrEqual(13);
  const tabSizes = await page.locator(".operations-tabs button").evaluateAll((buttons) =>
    buttons.map((button) => ({
      width: button.getBoundingClientRect().width,
      height: button.getBoundingClientRect().height,
    })),
  );
  expect(tabSizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
});
