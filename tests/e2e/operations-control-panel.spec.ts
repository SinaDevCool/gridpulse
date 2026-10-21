import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openScenarioInputs } from "./operations-inputs";

test("backend failures stay explicit and input preferences never save facility values", async ({
  page,
}) => {
  await page.route("**/api/operations/assess", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unavailable" }),
    }),
  );
  await page.goto("/operations");
  await expect(page.locator(".ops-service-status")).toContainText("backend unavailable");
  await expect(page.locator(".ops-assessment-notice")).toContainText("browser demonstration only");
  const panel = await openScenarioInputs(page);
  await panel.getByLabel("Facility Limit", { exact: false }).fill("137");
  await panel.getByRole("button", { name: "Close inputs" }).click();
  const preferences = await page.evaluate(() =>
    Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.includes("operations"))),
  );
  expect(preferences).toEqual({ "gridpulse-operations-inputs": "closed" });
  await page.reload();
  await expect(page.getByRole("button", { name: /^Inputs/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.getByRole("button", { name: /^Inputs/ }).click();
  await expect(page.getByLabel("Facility Limit", { exact: false })).toHaveValue("100");
});

test("battery availability and zero power recompute response without stale contributions", async ({
  page,
}) => {
  await page.goto("/operations");
  const panel = await openScenarioInputs(page);
  await panel.getByLabel("Battery available", { exact: true }).uncheck();
  await panel.getByRole("button", { name: "Recalculate Scenario" }).click();
  await page.getByRole("button", { name: "Battery Response", exact: true }).click();
  await expect(page.getByRole("meter")).toHaveAttribute("aria-valuenow", "106.6");
  await expect(
    page
      .getByRole("region", { name: "Selected response breakdown" })
      .getByText("0 MW", { exact: true })
      .first(),
  ).toBeVisible();
  await panel.getByLabel("Battery available", { exact: true }).check();
  await panel.getByLabel("Battery Power", { exact: false }).fill("0");
  await panel.getByRole("button", { name: "Recalculate Scenario" }).click();
  await expect(page.getByRole("meter")).toHaveAttribute("aria-valuenow", "106.6");
  await page.getByRole("link", { name: "Power & Battery", exact: true }).click();
  await expect(page.locator(".power-flow-card")).toContainText("0 MW");
});

test("mobile input dropdowns remain visible and keyboard navigation stays inside the drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/operations");
  await page.getByRole("button", { name: /^Inputs/ }).click();
  const dialog = page.getByRole("dialog", { name: "Inputs & evidence" });
  await dialog
    .getByRole("combobox", { name: "Operating Window", exact: true })
    .selectOption("next-4h");
  await expect(page).toHaveURL(/window=next-4h/);
  await expect(
    dialog
      .getByRole("combobox", { name: "Data Mode", exact: true })
      .getByRole("option", { name: "Live", exact: true }),
  ).toBeDisabled();
  await dialog.getByText("Evidence imports", { exact: true }).click();
  const report = await new AxeBuilder({ page })
    .include("#operations-inputs")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(report.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("single input panel retains drafts, validates fields and recalculates every tab", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/operations");
  const panel = page.getByRole("complementary", { name: "Inputs & evidence" });
  await expect(panel).toBeVisible();
  await panel.getByLabel("Facility Limit", { exact: false }).fill("120");
  await expect(page.getByRole("meter")).toHaveAttribute("aria-valuenow", "98");
  await expect(page.getByText(/Unapplied changes/).first()).toBeVisible();
  await panel.getByRole("button", { name: "Close inputs" }).click();
  await page.getByRole("link", { name: "Power & Battery", exact: true }).click();
  await page.getByRole("button", { name: /^Inputs/ }).click();
  await expect(panel.getByLabel("Facility Limit", { exact: false })).toHaveValue("120");
  await panel.getByText("Facility assumptions", { exact: true }).click();
  await panel.getByLabel("PUE", { exact: false }).fill("0.5");
  await panel.getByRole("button", { name: "Recalculate Scenario" }).click();
  await expect(panel.getByLabel("PUE", { exact: false })).toBeFocused();
  await expect(panel.getByRole("alert")).toBeVisible();
  await panel.getByLabel("PUE", { exact: false }).fill("1.25");
  await panel.getByRole("button", { name: "Recalculate Scenario" }).click();
  await expect(
    page.getByRole("heading", {
      name: "No battery response is required for the selected interval",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("meter")).toHaveAttribute("aria-valuetext", /facility limit 120\sMW/);
  await panel.getByLabel("Facility Limit", { exact: false }).fill("95");
  await panel.getByRole("button", { name: "Discard changes" }).click();
  await expect(panel.getByLabel("Facility Limit", { exact: false })).toHaveValue("120");
});

test("gauge, response selection and recovery use the same assessment", async ({ page }) => {
  await page.goto("/operations?view=overview");
  const meter = page.getByRole("meter");
  await expect(meter).toHaveAttribute("aria-valuenow", "98");
  await expect(page.locator(".ops-plan-status")).toContainText("remains unrecovered");
  await page.getByRole("button", { name: "Baseline", exact: true }).click();
  await expect(meter).toHaveAttribute("aria-valuenow", "106.6");
  await expect(page.locator(".ops-headroom-summary")).toContainText("-8.6 MW");
  await page.getByRole("button", { name: "Battery Response", exact: true }).click();
  await expect(meter).toHaveAttribute("aria-valuenow", "101.6");
  await page.getByRole("button", { name: "Battery + Workload", exact: true }).click();
  await expect(meter).toHaveAttribute("aria-valuenow", "98");
  await expect(page.getByRole("region", { name: "Selected response breakdown" })).toContainText(
    "5 MW",
  );
  await page.getByRole("link", { name: "Review recovery & assumptions" }).click();
  await expect(page.locator("#operations-recovery")).toHaveAttribute("open", "");
  await page.getByText("Chart options", { exact: true }).click();
  await page.getByRole("checkbox", { name: /Show illustrative/ }).check();
});

test("mobile drawer traps focus, closes with Escape and preserves edits", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/operations");
  const trigger = page.getByRole("button", { name: /^Inputs/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Inputs & evidence" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Facility Limit", { exact: false }).fill("130");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog.getByLabel("Facility Limit", { exact: false })).toHaveValue("130");
  await page.keyboard.press("Tab");
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await dialog.getByRole("button", { name: "Close inputs" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("sidebar and all tabs meet automated accessibility checks in both themes", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/operations");
  for (const theme of ["dark", "light"]) {
    await page.evaluate((value) => {
      localStorage.setItem("gridpulse-theme", value);
      document.documentElement.dataset.theme = value;
    }, theme);
    for (const tab of ["Overview", "Compute & Workloads", "Power & Battery"]) {
      await page.getByRole("link", { name: tab, exact: true }).click();
      await expect(page.getByRole("button", { name: /^Inputs/ })).toBeEnabled();
      const result = await new AxeBuilder({ page })
        .include(".operations-v2")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.failureSummary) })),
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      if (tab === "Overview") {
        const textFill = await page
          .locator(".ops-gauge-number")
          .evaluate((node) => getComputedStyle(node).fill);
        await expect(page.locator(".operations-v2-chart .recharts-label").first()).toHaveCSS(
          "fill",
          textFill,
        );
      }
      await page.screenshot({
        path: testInfo.outputPath(`${tab.replaceAll(" ", "-")}-${theme}.png`),
        fullPage: true,
      });
    }
  }
});
