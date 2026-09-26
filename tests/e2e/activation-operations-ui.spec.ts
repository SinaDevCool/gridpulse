import { expect, test } from "@playwright/test";

test("public product navigation focuses on property and grid qualification", async ({ page }) => {
  await page.goto("/power-finder");
  const navigation = page.getByRole("navigation", { name: "GridPulse workspace" });
  await expect(navigation.getByRole("link", { name: /Power Finder/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    navigation.getByRole("link", { name: /Plan Activation|Run Operations/ }),
  ).toHaveCount(0);
});

test("landing page presents the focused decision journey", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.locator("main").getByText(/activation strategy|operational envelope/i),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Explore Power Finder" }).click();
  await expect(page).toHaveURL(/\/power-finder$/);
});

for (const legacyPath of ["/activation"]) {
  test(`${legacyPath} redirects safely to Power Finder`, async ({ page }) => {
    await page.goto(legacyPath);
    await expect(page).toHaveURL(/\/power-finder$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

test("Operations exposes the focused three-view facility workflow", async ({ page }) => {
  await page.goto("/operations?view=overview");
  await expect(page.getByRole("heading", { level: 1, name: "Power Operations" })).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Power Operations views" });
  await expect(navigation.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(navigation.getByRole("link", { name: "Compute & Workloads" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Power & Battery" })).toBeVisible();
  await expect(navigation.getByRole("link")).toHaveCount(3);
  await expect(page.getByText("Scenario workspace", { exact: true })).toBeVisible();
  await expect(page.getByText(/No control commands are issued/)).toBeVisible();
  await expect(page.getByText("GPU-Hours Enabled").locator("xpath=..").locator("dd"))
    .toHaveText(/^\d[\d,.]* h$/);
});

test("legacy Operations views resolve to a supported destination", async ({ page }) => {
  await page.goto("/operations?view=battery");
  await expect(page).toHaveURL(/view=power/);
  await expect(page.getByRole("link", { name: "Power & Battery" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("Operations scenario assumptions recalculate the dashboard", async ({ page }) => {
  await page.goto("/operations?view=overview");
  const configureButton = page.getByRole("button", { name: "Configure Scenario" });
  await expect(configureButton).toBeVisible();
  await expect(page.locator(".recharts-wrapper").first()).toBeVisible();
  await page.waitForTimeout(250);
  await configureButton.click();
  const limitInput = page.locator("#ops-facility-limit");
  await expect(limitInput).toBeVisible();
  await limitInput.fill("95");
  await page.getByRole("button", { name: "Recalculate Scenario" }).click();
  await expect(
    page.locator(".operations-v2-metric").filter({ hasText: "Operational Limit" }),
  ).toContainText("95 MW");
  await expect(
    page.getByText("Scenario assumptions updated. Dashboard results recalculated."),
  ).toBeAttached();
});

test("Compute & Workloads keeps scenario evidence distinct and supports workload inspection", async ({
  page,
}) => {
  await page.goto("/operations?view=compute");
  await expect(page.getByText("Power-Aware Workload Decision")).toBeVisible();
  await expect(page.getByText(/minimum recommended response/i)).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText("reference", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /Embedding refresh/ }).click();
  await expect(
    page.getByRole("complementary", { name: /Workload details: Embedding refresh/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close workload details" }).click();
  await expect(page.getByRole("complementary", { name: /Workload details/ })).toHaveCount(0);
});

test("Compute & Workloads imports real scheduler and DCGM-compatible evidence", async ({
  page,
}) => {
  await page.goto("/operations?view=compute");
  const connectEvidence = page.getByRole("button", { name: "Connect Evidence" });
  await expect(connectEvidence).toBeVisible();
  await expect(connectEvidence).toBeEnabled();
  await connectEvidence.click();
  await expect(page.getByRole("heading", { name: "Load Scheduler and GPU Records" })).toBeVisible();
  await page.getByLabel(/Workload CSV/).setInputFiles({
    name: "workloads.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        "workload_id,name,workload_class,status,priority,earliest_start,deadline,expected_duration_minutes,requested_gpu_count,minimum_gpu_count,checkpointable,preemptible,maximum_delay_minutes",
        "job-live,Customer batch,batch,running,10,2026-09-02T01:00:00Z,2026-09-02T08:00:00Z,120,8,4,true,true,120",
      ].join("\n"),
    ),
  });
  await expect(page.getByText("1 scheduler records loaded from workloads.csv.")).toBeVisible();
  await page.getByLabel(/GPU telemetry CSV/).setInputFiles({
    name: "gpu.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        "timestamp,workload_id,gpu_uuid,power_watts,gpu_utilization_percent",
        "2026-09-02T02:00:00Z,job-live,GPU-a,500000,75",
      ].join("\n"),
    ),
  });
  await expect(page.getByText("1 GPU telemetry records loaded from gpu.csv.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Customer batch/ })).toBeVisible();
  await expect(page.getByText("measured", { exact: true }).first()).toBeVisible();
});

test("Power & Battery exposes dispatch physics and imports measured evidence", async ({ page }) => {
  await page.goto("/operations?view=power");
  await expect(page.getByText("Read-only dispatch assessment")).toBeVisible();
  await expect(
    page.getByText("Positive battery power means discharge; negative power means charge."),
  ).toBeVisible();
  await expect(page.getByText("Facility Power & Battery Response")).toBeVisible();
  await expect(page.getByText("Facility Power", { exact: true })).toBeVisible();
  await expect(page.getByText("Battery Dispatch & State of Charge", { exact: true })).toBeVisible();
  await expect(page.getByText("No live connectors configured")).toBeVisible();
  const connect = page.getByRole("button", { name: "Connect evidence" });
  await expect(connect).toBeEnabled();
  await connect.click();
  await page.getByLabel("Facility meter CSV").setInputFiles({
    name: "facility.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "timestamp,facility_import_mw,operating_limit_mw\n2026-09-26T00:00:00Z,98,100\n2026-09-26T00:15:00Z,104,100",
    ),
  });
  await expect(page.getByText("2 facility meter records loaded from facility.csv.")).toBeVisible();
  await page.getByLabel("Battery telemetry CSV").setInputFiles({
    name: "battery.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "timestamp,soc_percent,active_power_mw,allowed_discharge_mw,inverter_state\n2026-09-26T00:00:00Z,80,0,5,available\n2026-09-26T00:15:00Z,78,4,5,available",
    ),
  });
  await expect(page.getByText("2 BMS/PCS records loaded from battery.csv.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Historical evidence" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("Measured", { exact: true }).first()).toBeVisible();
});

test("Operations charts expose explicit legends, units, targets, and full data alternatives", async ({
  page,
}) => {
  await page.goto("/operations?view=overview");
  await expect(page.getByText("Facility Demand vs Operating Target")).toBeVisible();
  await expect(page.getByText("Safety target", { exact: true })).toBeVisible();
  await expect(page.getByText("Facility limit", { exact: true })).toBeVisible();
  await expect(page.getByText("Peak Reduction", { exact: true }).first()).toBeVisible();
  await page.getByText("View Chart Data", { exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "Baseline (MW)" })).toBeVisible();
  await expect(page.locator(".operations-v2-chart-data tbody tr")).toHaveCount(96);

  await page.goto("/operations?view=compute");
  await expect(page.getByText("GPU power", { exact: true })).toBeVisible();
  await expect(page.getByText("MW · component of facility demand", { exact: true })).toBeVisible();
  await page.getByText("View Full Chart Data", { exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "GPU Power (MW)" })).toBeVisible();

  await page.goto("/operations?view=power");
  await expect(page.getByText("+ discharge / − charge", { exact: false })).toBeVisible();
  await expect(page.getByText("State of charge", { exact: true }).first()).toBeVisible();
  await page.getByText("View Full Interval Data", { exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "Battery Dispatch (MW)" })).toBeVisible();
  await expect(page.locator(".operations-v2-chart-data tbody tr")).toHaveCount(96);
});

test("Power & Battery remains usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/operations?view=power");
  await expect(page.getByText("Read-only dispatch assessment")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
});

test("legacy Operations project URLs resolve to the new overview", async ({ page }) => {
  await page.goto("/operations/retired-project");
  await expect(page).toHaveURL(/\/operations\?view=overview/);
  await expect(page.getByRole("heading", { level: 1, name: "Power Operations" })).toBeVisible();
});

test("focused workspace navigation fits mobile without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/power-finder");
  await expect(page.getByRole("navigation", { name: "GridPulse workspace" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
});

test("Compute & Workloads remains usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/operations?view=compute");
  await expect(page.getByText("Power-Aware Workload Decision")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
  await page.getByRole("button", { name: /Embedding refresh/ }).click();
  await expect(page.getByRole("complementary", { name: /Workload details/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
});
