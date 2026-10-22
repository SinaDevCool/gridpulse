import { expect, test } from "@playwright/test";
import { openEvidenceInputs, openScenarioInputs } from "./operations-inputs";
import type { OperationsOverviewModel } from "../../src/features/operations/scenario-engine";

test("recalculated backend values reach each tab's diagram summary and interval table", async ({
  page,
}) => {
  await page.goto("/operations?view=overview&window=today&mode=scenario");
  await expect(page.locator(".ops-service-status")).toContainText("Calculation service available");
  const panel = await openScenarioInputs(page);
  await panel.getByRole("spinbutton", { name: "GPU Active Power W", exact: true }).fill("900");
  const pending = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/operations/assess") &&
      response.request().postDataJSON()?.scenario?.gpuActivePowerWatts === 900,
  );
  await panel.getByRole("button", { name: "Recalculate Scenario" }).click();
  const reply = await (await pending).json();
  const model = reply.result as OperationsOverviewModel;
  const combined = model.summaries.find((s) => s.kind === "battery_workload")!;
  await expect(page.getByRole("meter", { name: "Peak import after response" })).toHaveAttribute(
    "aria-valuenow",
    String(combined.peakDemandMw),
  );
  const point = model.intervals[32];
  const numeric = (text: string) => Number(text.replace(/[^\d.\-]/g, ""));
  const overview = page.locator(".operations-v2-chart-data");
  await overview.locator(":scope > summary").click();
  const overviewCells = overview.locator("tbody tr").nth(32).locator("td");
  expect(numeric(await overviewCells.nth(1).innerText())).toBeCloseTo(point.batteryDemandMw, 1);
  expect(numeric(await overviewCells.nth(3).innerText())).toBeCloseTo(point.combinedDemandMw, 1);

  await page.getByRole("link", { name: "Compute & Workloads", exact: true }).click();
  await expect(page.locator(".compute-decision-headline h3")).toContainText(
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(
      model.assessmentPlan!.workloads.requiredWorkloadResponseMw,
    ),
  );
  const compute = page.locator(".operations-v2-chart-data");
  await compute.locator(":scope > summary").click();
  await page.getByLabel("Include facility context columns").check();
  const computeCells = compute.locator("tbody tr").nth(32).locator("td");
  expect(numeric(await computeCells.nth(0).innerText())).toBeCloseTo(
    Math.max(
      0,
      point.batteryDemandMw - (model.scenario.importLimitMw - model.scenario.safetyReserveMw),
    ),
    1,
  );
  expect(numeric(await computeCells.nth(4).innerText())).toBeCloseTo(point.combinedDemandMw, 1);
  expect(numeric(await computeCells.nth(5).innerText())).toBeCloseTo(point.gpuPowerMw, 1);

  await page.getByRole("link", { name: "Power & Battery", exact: true }).click();
  await expect(page.locator(".power-toolbar")).toContainText("Battery-only comparison");
  const power = page.locator(".battery-data-details");
  await power.locator(":scope > summary").click();
  const powerCells = power.locator("tbody tr").nth(32).locator("td");
  expect(numeric(await powerCells.nth(1).innerText())).toBeCloseTo(point.batteryPowerMw, 1);
  expect(numeric(await powerCells.nth(2).innerText())).toBeCloseTo(point.batteryDemandMw, 1);
  expect(numeric(await powerCells.nth(4).innerText())).toBeCloseTo(point.batterySocPercent, 1);
  const record = page.locator("#operations-assurance");
  await record.locator(":scope > summary").click();
  await expect(record).toContainText(reply.assessmentId);
  await expect(record).toContainText("not mathematical optimisation");
});

test("a mismatched calculation version cannot become an authoritative assessment", async ({
  page,
}) => {
  await page.route("**/api/operations/assess", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({
      response,
      json: { ...body, calculationVersion: "obsolete-calculation" },
    });
  });
  await page.goto("/operations?view=overview&window=today&mode=scenario");
  await expect(page.locator(".ops-service-status")).toContainText("backend unavailable");
  await expect(page.locator(".ops-assessment-notice")).toContainText("browser demonstration only");
});

test("one accepted import produces one shared assessment across all three tabs", async ({
  page,
}) => {
  await page.goto("/operations?view=compute&window=today&mode=scenario");
  await expect(page.locator(".ops-service-status")).toContainText("Calculation service available");
  const replies: { id: string; count: number }[] = [];
  page.on("response", async (response) => {
    if (!response.url().endsWith("/api/operations/assess") || !response.ok()) return;
    const body = await response.json();
    if (body.result.assessmentPlan?.evidenceCounts.workloads === 1)
      replies.push({
        id: body.assessmentId,
        count: body.result.assessmentPlan.workloads.recommendedJobs,
      });
  });
  await openEvidenceInputs(page);
  await page.getByLabel("Workload CSV", { exact: true }).setInputFiles({
    name: "outside-risk.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        "workload_id,name,workload_class,status,priority,earliest_start,deadline,expected_duration_minutes,requested_gpu_count,checkpointable,preemptible,maximum_delay_minutes",
        "early,Early completed window,batch,queued,20,2026-09-25T00:00:00Z,2026-09-25T23:00:00Z,60,100,true,true,60",
      ].join("\n"),
    ),
  });
  await expect(page.getByText(/1 scheduler records loaded/)).toBeVisible();
  await expect.poll(() => replies.length).toBe(1);
  expect(replies[0].count).toBe(0);
  for (const name of ["Overview", "Compute & Workloads", "Power & Battery"]) {
    await page.getByRole("link", { name, exact: true }).click();
    const record = page.locator("#operations-assurance");
    if ((await record.getAttribute("open")) === null)
      await record.locator("summary").first().click();
    await expect(record).toContainText(replies[0].id);
    await expect(record).toContainText("1 imported jobs");
    await expect(record).toContainText("Job schedule: not validated");
  }
  expect(replies).toHaveLength(1);
  const panel = await openScenarioInputs(page);
  await panel.getByLabel("Facility Limit", { exact: false }).fill("95");
  await panel.getByRole("button", { name: "Recalculate Scenario" }).click();
  await expect.poll(() => replies.length).toBe(2);
  expect(replies[1].id).not.toBe(replies[0].id);
});

test("small invalid imports preserve previously accepted evidence", async ({ page }) => {
  await page.goto("/operations?view=power&window=today&mode=scenario");
  await openEvidenceInputs(page);
  const meter = page.getByLabel("Facility meter CSV");
  await meter.setInputFiles({
    name: "accepted.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("timestamp,grid_import_mw\n2026-09-26T08:00:00Z,99"),
  });
  await expect(page.getByText(/1 facility meter records loaded/)).toBeVisible();
  await meter.setInputFiles({
    name: "ambiguous.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("timestamp,grid_import_mw\n2026-10-25T02:00:00,1"),
  });
  await expect(page.getByRole("alert")).toContainText("UTC offset");
  await expect(page.locator(".ops-evidence-inputs")).toContainText("accepted.csv");
  await expect(page.locator(".ops-evidence-inputs")).not.toContainText("ambiguous.csv");
});
