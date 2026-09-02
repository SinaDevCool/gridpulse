import { expect, test } from "@playwright/test";

test("every visible workflow destination resolves to meaningful content", async ({ page }) => {
  await page.goto("/power-finder");
  const navigation = page.getByRole("navigation", { name: "Grid workspace navigation" });
  await expect(navigation).toBeVisible();
  const expectations = [
    ["Sites", /Sites|portfolio/i],
    ["Power Finder", /Germany connection context/i],
    ["Constraints", /Understand what may constrain/i],
    ["Planner", /Untitled Data Centre/i],
    ["Activation", /Activation prerequisites/i],
    ["Operations", /Shadow verification prerequisites/i],
    ["Evidence", /Evidence ledger/i],
    ["Reports", /Operator enquiry package/i],
  ] as const;
  for (const [label, heading] of expectations) {
    await navigation.getByRole("link", { name: new RegExp(label) }).click();
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
  }
});

test("theme persists and constraint filters are URL-addressable", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("gridpulse-theme")) localStorage.setItem("gridpulse-theme", "dark");
  });
  await page.goto("/constraint-explorer");
  await expect(
    page.getByRole("heading", { name: "Understand what may constrain a site" }),
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
  await page.goto("/constraint-explorer?severity=critical");
  await expect(page).toHaveURL(/severity=critical/);
  await expect(page.getByText("Equipment rating gap")).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByLabel("Severity")).toHaveValue("critical");
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
  await page.getByText("Map Layers", { exact: true }).click();
  await expect(page.locator(".power-finder-layer-list label").first()).toHaveCSS(
    "color",
    "rgb(16, 24, 40)",
  );
});

test("Constraint Explorer reuses the Germany-wide generation registry", async ({ page }) => {
  await page.goto("/constraint-explorer");
  await expect(
    page.getByRole("application", { name: "Interactive grid and industrial-site screening map" }),
  ).toBeVisible();
  await expect(page.getByText("MaStR public asset context").first()).toBeVisible();
  await page.getByRole("button", { name: "Show only Solar" }).click();
  await expect(page).toHaveURL(/isolateTechnology=solar/);
  await expect(page.getByRole("button", { name: "Show all Solar" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("constraint legend isolates voltage and severity through shareable state", async ({
  page,
}) => {
  await page.goto("/constraint-explorer");
  await expect(
    page.getByRole("application", { name: "Interactive grid and industrial-site screening map" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show only 380 kV and above" }).click();
  await expect(page).toHaveURL(/isolateVoltage=ehv/);
  await expect(page.getByRole("button", { name: "Show all 380 kV and above" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Show only Critical" }).click();
  await expect(page).toHaveURL(/severity=critical/);
  await expect(page).not.toHaveURL(/isolateVoltage/);
});
