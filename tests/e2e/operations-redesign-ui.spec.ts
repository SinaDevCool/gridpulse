import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("response selection updates overview values and illustrative uncertainty is opt-in", async ({
  page,
}) => {
  await page.goto("/operations?view=overview");
  const demand = page
    .locator(".operations-v2-metric")
    .filter({ hasText: "Peak import after response" });
  await expect(demand).toContainText("98 MW");
  await page.getByRole("button", { name: "Baseline", exact: true }).click();
  await expect(demand).toContainText("106.6 MW");
  await page.getByRole("button", { name: "Battery Response", exact: true }).click();
  await expect(demand).toContainText("101.6 MW");
  await page.getByRole("button", { name: "Battery + Workload", exact: true }).click();
  await expect(demand).toContainText("98 MW");
  const range = page.getByRole("checkbox", { name: /Show illustrative planning range/ });
  await expect(range).not.toBeChecked();
  await range.check();
  await expect(range).toBeChecked();
  await range.uncheck();
  await page.getByText("Operating envelope & uncertainty", { exact: true }).click();
  await expect(page.locator(".operations-envelope-map")).toBeVisible();
  await page.getByRole("link", { name: "Inspect evidence" }).click();
  await expect(page.locator("#operations-assurance")).toHaveAttribute("open", "");
});

test("battery configuration recalculates across all three tabs and invalid assumptions are rejected", async ({
  page,
}) => {
  await page.goto("/operations?view=power");
  await page.getByRole("button", { name: "Configure Scenario", exact: true }).click();
  await page.locator("#ops-pue").fill("0.5");
  await page.getByRole("button", { name: "Recalculate Scenario" }).click();
  await expect(page.locator(".operations-v2-form-error")).toBeVisible();
  for (const [id, value] of Object.entries({
    "facility-limit": "100",
    "safety-reserve": "2",
    pue: "1.25",
    "gpu-count": "125000",
    "gpu-active-power": "700",
    "battery-power": "10",
    "battery-energy": "80",
    "shiftable-workload": "18",
  })) {
    await page.locator(`#ops-${id}`).fill(value);
  }
  await page.getByRole("button", { name: "Recalculate Scenario" }).click();
  await expect(page.locator(".power-kpis")).toContainText("98");
  await expect(page.locator(".power-flow-card")).toContainText("8.6");
  await page.getByRole("link", { name: "Compute & Workloads", exact: true }).click();
  await expect(page.getByText("No workload movement is required", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.locator(".operations-v2-metric").filter({ hasText: "Peak import after response" }),
  ).toContainText("98 MW");
  await page.getByRole("button", { name: "Configure Scenario", exact: true }).click();
  await expect(page.locator("#ops-battery-power")).toHaveValue("10");
  await page.getByRole("button", { name: "Close scenario configuration" }).click();
});

test("all workload drawers and status filters work with keyboard dismissal", async ({ page }) => {
  await page.goto("/operations?view=compute");
  const buttons = page.locator(".compute-table-wrap tbody button");
  await expect(buttons).toHaveCount(5);
  for (let index = 0; index < 5; index++) {
    await buttons.nth(index).click();
    const drawer = page.getByRole("complementary", { name: /Workload details/ });
    await expect(drawer).toBeVisible();
    await expect(page.getByRole("button", { name: "Close workload details" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(buttons.nth(index)).toBeFocused();
  }
  for (const value of ["running", "queued", "held", "completed", "all"]) {
    await page.getByRole("combobox", { name: "Show", exact: true }).selectOption(value);
    await expect(page.getByRole("combobox", { name: "Show", exact: true })).toHaveValue(value);
  }
  await expect(buttons).toHaveCount(5);
});

test("power interval selection and advanced panels expose consistent units", async ({ page }) => {
  await page.goto("/operations?view=power");
  await page.locator(".power-interval-control .operations-select-trigger").click();
  await page.getByRole("option", { name: "00:00 UTC", exact: true }).click();
  await expect(page.locator(".power-flow-card")).toContainText("00:00 UTC");
  await expect(page.locator(".power-flow-card")).toContainText("charge");
  for (const name of [
    "Battery constraints & balance provenance",
    "Compare scenario responses",
    "Evidence & connector readiness",
  ]) {
    await page
      .getByLabel("Power & Battery", { exact: true })
      .getByText(name, { exact: true })
      .click();
    await expect(
      page
        .getByLabel("Power & Battery", { exact: true })
        .locator("details")
        .filter({ has: page.getByText(name, { exact: true }) }),
    ).toHaveAttribute("open", "");
  }
  await expect(page.getByText("Battery Dispatch", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Battery State of Charge", { exact: true })).toBeVisible();
});

test("historical import without battery evidence does not invent demand or SOC", async ({
  page,
}) => {
  await page.goto("/operations?view=power");
  await page.getByRole("button", { name: "Connect evidence" }).click();
  await page.getByLabel("Facility meter CSV").setInputFiles({
    name: "facility.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "timestamp,facility_import_mw,operating_limit_mw\n2026-09-26T00:00:00Z,98,100\n2026-09-26T00:15:00Z,104,100",
    ),
  });
  await expect(page.getByText("2 facility meter records loaded from facility.csv.")).toBeVisible();
  await expect(page.locator(".power-flow-card")).toContainText("Power balance unavailable");
  await page.getByText("View Full Interval Data", { exact: true }).click();
  await expect(
    page
      .getByLabel("Power & Battery", { exact: true })
      .locator(".operations-v2-chart-data tbody tr")
      .first(),
  ).toContainText("Unavailable");
});

for (const view of ["overview", "compute", "power"]) {
  test(`${view} fits desktop and mobile in both themes`, async ({ page }, testInfo) => {
    await page.goto(`/operations?view=${view}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Configure Scenario", exact: true }),
    ).toBeEnabled();
    for (const theme of ["dark", "light"]) {
      const toggle = page.getByRole("button", {
        name: new RegExp(`Theme: ${theme === "dark" ? "light" : "dark"}`),
      });
      if (await toggle.count()) await toggle.click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        const tabBounds = await page.locator(".operations-v2-tabs").boundingBox();
        expect(tabBounds!.height).toBeLessThan(110);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
        ).toBe(false);
        if (view === "power" && theme === "dark" && width === 1440) {
          await page
            .locator(".power-insight-grid")
            .screenshot({ path: testInfo.outputPath("power-balance-dark.png") });
        }
        await page.screenshot({
          path: testInfo.outputPath(`${view}-${theme}-${width}.png`),
          fullPage: true,
        });
      }
    }
  });
}

test("large imported workload queues are bounded and paginate without losing records", async ({
  page,
}) => {
  await page.goto("/operations?view=compute");
  await page.getByRole("button", { name: "Connect Evidence", exact: true }).click();
  const header =
    "workload_id,name,workload_class,status,priority,earliest_start,deadline,expected_duration_minutes,requested_gpu_count,minimum_gpu_count,checkpointable,preemptible,maximum_delay_minutes";
  const records = Array.from(
    { length: 55 },
    (_, index) =>
      `job-${index},Batch ${index},batch,queued,10,2026-09-26T00:00:00Z,2026-09-26T20:00:00Z,60,8,4,true,true,120`,
  );
  await page
    .getByLabel(/Workload CSV/)
    .setInputFiles({
      name: "queue.csv",
      mimeType: "text/csv",
      buffer: Buffer.from([header, ...records].join("\n")),
    });
  await expect(page.getByText("55 scheduler records loaded from queue.csv.")).toBeVisible();
  await expect(page.locator(".compute-table-wrap tbody tr")).toHaveCount(50);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator(".compute-table-wrap tbody tr")).toHaveCount(5);
  await page.getByRole("button", { name: "Previous page", exact: true }).click();
  await expect(page.locator(".compute-table-wrap tbody tr")).toHaveCount(50);
});

test("window scopes every scenario timeline without truncating recovery calculations", async ({
  page,
}) => {
  await page.goto("/operations?view=overview&window=next-4h&mode=scenario");
  await expect(page.locator(".operations-context-health")).toContainText("16 displayed intervals");
  await page.getByText("View Chart Data", { exact: true }).click();
  await expect(
    page
      .getByLabel("Operations Overview", { exact: true })
      .locator(".operations-v2-chart-data tbody tr"),
  ).toHaveCount(16);
  await page.getByRole("link", { name: "Compute & Workloads", exact: true }).click();
  await page.getByText("View Full Chart Data", { exact: true }).click();
  await expect(
    page
      .getByLabel("Compute and Workloads", { exact: true })
      .locator(".operations-v2-chart-data tbody tr"),
  ).toHaveCount(16);
  await expect(page.getByText(/not the selected candidate job schedule/)).toBeVisible();
  await page.getByRole("link", { name: "Power & Battery", exact: true }).click();
  await page.getByText("View Full Interval Data", { exact: true }).click();
  await expect(
    page
      .getByLabel("Power & Battery", { exact: true })
      .locator(".operations-v2-chart-data tbody tr"),
  ).toHaveCount(16);
  await expect(page.getByText("Discharge time · full horizon", { exact: true })).toBeVisible();
  await expect(page.locator(".power-interval-control")).toBeVisible();
  const intervalBounds = await page.locator(".power-interval-control").boundingBox();
  const flowBounds = await page.locator(".power-insight-grid").boundingBox();
  expect(intervalBounds!.y).toBeLessThan(flowBounds!.y);
});

test("power compliance does not hide unrecovered work and advanced contracts are secondary", async ({
  page,
}) => {
  await page.goto("/operations?view=overview");
  await expect(page.locator(".operations-decision-message")).toContainText(
    /Power target met, but .* deferred work remains unrecovered/,
  );
  await expect(page.locator(".operations-decision-statuses")).toContainText(
    "Unrecovered work · full horizon",
  );
  await expect(page.locator(".operations-decision-facts")).toContainText("Scenario only");
  await expect(page.locator(".operations-technical-details")).not.toHaveAttribute("open", "");
  const chart = await page.locator(".operations-v2-chart-card").first().boundingBox();
  const advanced = await page.locator(".operations-technical-details").boundingBox();
  expect(chart!.y).toBeLessThan(advanced!.y);
});

for (const view of ["overview", "compute", "power"]) {
  test(`${view} meets automated WCAG checks in both themes`, async ({ page }) => {
    await page.goto(`/operations?view=${view}`);
    await expect(
      page.getByRole("button", { name: "Configure Scenario", exact: true }),
    ).toBeEnabled();
    for (const theme of ["light", "dark"]) {
      const toggle = page.getByRole("button", {
        name: new RegExp(`Theme: ${theme === "dark" ? "light" : "dark"}`),
      });
      if (await toggle.count()) await toggle.click();
      const report = await new AxeBuilder({ page })
        .include(".operations-v2")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        report.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      ).toEqual([]);
    }
  });
}
