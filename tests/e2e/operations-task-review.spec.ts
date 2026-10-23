import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openEvidenceInputs } from "./operations-inputs";

test("shared evidence stays in inputs and missing historical battery data is not zero-filled", async ({
  page,
}) => {
  await page.goto("/operations?view=power");
  await openEvidenceInputs(page);
  const inputs = page.locator("#operations-inputs");
  await inputs.getByText("Evidence & connector readiness", { exact: true }).click();
  await expect(inputs.locator(".ops-source-readiness")).toContainText(
    "No live connectors configured",
  );
  await inputs.getByLabel("Facility meter CSV").setInputFiles({
    name: "meter.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "timestamp,facility_import_mw,operating_limit_mw\n2026-09-26T00:00:00Z,98,100\n2026-09-26T00:15:00Z,104,100",
    ),
  });
  await expect(page).toHaveURL(/mode=historical/);
  await expect(inputs.locator(".ops-source-readiness")).toContainText("2 uploaded records");
  const budget = page.getByRole("region", { name: "Battery response capability" });
  await expect(budget).toContainText("Observed power balance");
  await expect(budget).toContainText("Unavailable");
  await expect(budget).not.toContainText("0 MW");
  await expect(inputs.locator("#operations-assurance")).toHaveCount(1);
  await expect(page.locator(".ops-canvas-content #operations-assurance")).toHaveCount(0);
});

test("workload groups filter the existing queue and persist across tabs", async ({ page }) => {
  await page.goto("/operations?view=compute");
  const review = page.getByRole("region", { name: "What needs your attention?" });
  await expect(review.getByRole("img")).toHaveAttribute(
    "aria-label",
    /Candidates for review: 1; Other eligible workloads: 3; Protected workloads: 1/,
  );
  await expect(page.locator(".compute-table-wrap")).not.toBeVisible();
  await review.getByRole("button", { name: /1 Candidates for review/ }).click();
  await expect(page.locator(".compute-table-wrap tbody tr")).toHaveCount(1);
  await expect(page.locator(".compute-table-wrap")).toContainText("Embedding refresh");
  await page.locator(".ops-canvas-content").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.getByRole("link", { name: "Power & Battery", exact: true }).click();
  await expect
    .poll(() => page.locator(".ops-canvas-content").evaluate((element) => element.scrollTop))
    .toBe(0);
  await page.getByRole("link", { name: "Compute & Workloads", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Decision group", exact: true })).toHaveValue(
    "candidate",
  );
  await page.getByRole("button", { name: /1 Protected workloads/ }).click();
  await expect(page.locator(".compute-table-wrap tbody tr")).toHaveCount(1);
  await expect(page.locator(".compute-table-wrap")).toContainText("Production inference");
  await page.getByRole("combobox", { name: "Decision group", exact: true }).selectOption("all");
  await expect(page.locator(".compute-table-wrap tbody tr")).toHaveCount(5);
  await review.getByText("Inspect inventory & nominal flexibility", { exact: true }).click();
  await expect(review).toContainText("49 MW");
  await expect(review).toContainText("not simultaneous, deliverable MW");
});

test("power budget is interval-specific and directs residual response to workloads", async ({
  page,
}) => {
  await page.goto("/operations?view=power");
  const budget = page.getByRole("region", { name: "Battery response capability" });
  await expect(budget).toContainText("8.6 MW");
  await expect(budget).toContainText("5 MW");
  await expect(budget).toContainText("3.6 MW");
  await expect(budget).toContainText("Power limit");
  await expect(page.locator(".ops-canvas-content #operations-assurance")).toHaveCount(0);
  await expect(page.getByText("Compare scenario responses", { exact: true })).toHaveCount(0);
  await budget.getByRole("link", { name: "Review workload flexibility" }).click();
  await expect(page).toHaveURL(/view=compute/);
  await page.getByRole("link", { name: "Power & Battery", exact: true }).click();
  await page.locator(".power-interval-control .operations-select-trigger").click();
  await page.getByRole("option", { name: "00:00 UTC", exact: true }).click();
  await expect(budget).toContainText("No discharge needed this interval");
  await expect(budget.getByRole("link")).toHaveCount(0);
});

for (const width of [390, 1440])
  test(`task-specific details are accessible and fit ${width}px`, async ({ page }, info) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/operations?view=compute");
    await expect(page.getByRole("button", { name: /^(Show|Hide) panel/ })).toBeEnabled();
    for (const view of ["compute", "power"]) {
      await page
        .getByRole("link", {
          name: view === "compute" ? "Compute & Workloads" : "Power & Battery",
          exact: true,
        })
        .click();
      for (const theme of ["dark", "light"]) {
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value;
        }, theme);
        const result = await new AxeBuilder({ page })
          .include(".operations-v2")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(
          result.violations.map((item) => ({
            id: item.id,
            nodes: item.nodes.map((node) => node.failureSummary),
          })),
        ).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({ path: info.outputPath(`${view}-${theme}.png`) });
      }
    }
  });
