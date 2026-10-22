import { expect, test } from "@playwright/test";
import { openEvidenceInputs, openScenarioInputs } from "./operations-inputs";

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
