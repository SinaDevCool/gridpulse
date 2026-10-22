import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openScenarioInputs, openComputeQueue } from "./operations-inputs";

test("compute starts with visual summary and linked windows, not a queue or recommendation panel", async ({
  page,
}) => {
  await page.goto("/operations?view=compute");
  await expect(page.getByRole("region", { name: "Compute operating summary" })).toContainText(
    "3.6 MW",
  );
  await expect(page.locator(".compute-decision-headline")).toContainText(
    "1 candidate · 4 eligible · 5 assessed",
  );
  await expect(page.locator(".compute-queue-disclosure")).not.toHaveAttribute("open", "");
  await expect(page.locator(".compute-table-wrap")).not.toBeVisible();
  await expect(page.locator(".compute-recommendation")).toHaveCount(0);
  await expect(page.locator(".compute-window-lane")).toHaveCount(1);
  await expect(page.locator(".compute-validation-status")).toContainText(
    "not a deadline guarantee",
  );
  await page.locator(".compute-lane-title").click();
  await expect(page.getByRole("complementary", { name: /Workload details/ })).toBeVisible();
  await page.getByRole("button", { name: "Close workload details" }).click();
  await expect(page.locator(".compute-lane-title")).toBeFocused();
  await openComputeQueue(page);
  await expect(page.locator(".compute-table-wrap tbody tr")).toHaveCount(5);
});

test("shared time cursor, optional overlays and eligible windows work with keyboard", async ({
  page,
}) => {
  await page.goto("/operations?view=compute");
  const slider = page.getByRole("slider", { name: /Inspect time/ });
  await expect(slider).toBeEnabled();
  await slider.press("End");
  await expect(slider).toHaveAttribute("aria-valuetext", "23:45 UTC");
  await page.getByLabel("Show eligible workload windows").check();
  await expect(page.locator(".compute-window-lane")).toHaveCount(4);
  await page.getByRole("button", { name: "Facility context", exact: true }).click();
  await page.getByRole("button", { name: /^GPU power MW/ }).click();
  await page.getByRole("button", { name: /^Aggregate scenario response MW/ }).click();
  await expect(page.getByText("MW · not a job schedule", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByRole("link", { name: "Compute & Workloads", exact: true }).click();
  const panel = await openScenarioInputs(page);
  await panel.getByLabel("Facility Limit", { exact: false }).fill("120");
  await panel.getByRole("button", { name: "Recalculate Scenario" }).click();
  await expect(page.locator(".compute-validation-status")).toContainText("No workload movement");
  await expect(page.locator(".compute-window-lane")).toHaveCount(0);
});

test("time, workload, timing legends and interval facts stay coordinated without rescheduling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/operations?view=compute");
  const slider = page.getByRole("slider", { name: /Inspect time/ });
  await expect(slider).toBeEnabled();
  await slider.fill("32");
  await page.locator(".compute-lane-title").click();
  const inspector = page.getByRole("complementary", { name: /Workload details/ });
  await expect(slider).toHaveValue("32");
  await expect(inspector).toContainText("At 08:00 UTC");
  await expect(inspector).toContainText("not execution");
  const plot = await page.locator(".compute-timeline .recharts-cartesian-grid").boundingBox();
  const lane = await page.locator(".compute-lane-track").boundingBox();
  expect(plot).not.toBeNull();
  expect(lane).not.toBeNull();
  expect(Math.abs(plot!.x - lane!.x)).toBeLessThan(2);
  expect(Math.abs(plot!.width - lane!.width)).toBeLessThan(2);
  await page.getByRole("button", { name: /^Proposed window Hatched/ }).click();
  await expect(page.locator(".compute-lane-track .proposed")).toHaveCount(0);
  await expect(slider).toHaveValue("32");
  await inspector.getByRole("button", { name: "Jump to candidate window" }).click();
  await expect(slider).toHaveValue("36");
  await page.getByText("View Full Chart Data", { exact: true }).click();
  const table = page.locator(".operations-v2-chart-data");
  await expect(table.locator('tr[aria-selected="true"]')).toContainText("09:00");
  await table.getByRole("button", { name: "10:00", exact: true }).click();
  await expect(inspector).toContainText("At 10:00 UTC");
  await expect(table.getByRole("columnheader", { name: "GPU Power (MW)" })).toHaveCount(0);
  await table.getByLabel("Include facility context columns").check();
  await expect(table.getByRole("columnheader", { name: "GPU Power (MW)" })).toBeVisible();
  await page.getByRole("button", { name: "Close workload details" }).click();
  await page.getByRole("button", { name: /1 Protected workloads/ }).click();
  await page.locator(".compute-lane-title").click();
  await expect(page.getByText("Selected workload is hidden by the queue filters.")).toBeVisible();
  await page.getByRole("button", { name: "Reveal selected workload" }).click();
  await expect(page.getByRole("combobox", { name: "Decision group", exact: true })).toHaveValue(
    "all",
  );
});

test("every compute display window has finite linked geometry and retains full-horizon screening", async ({
  page,
}) => {
  for (const window of ["now", "next-4h", "today"]) {
    await page.goto(`/operations?view=compute&window=${window}`);
    await expect(page.getByRole("slider", { name: /Inspect time/ })).toBeEnabled();
    await expect(page.locator(".compute-decision-headline")).toContainText("3.6 MW");
    const bad = await page
      .locator(".compute-integrated-workspace svg")
      .evaluateAll(
        (charts) =>
          charts
            .flatMap((svg) => Array.from(svg.querySelectorAll("*")))
            .filter((node) =>
              Array.from(node.attributes).some((attribute) => /NaN|Infinity/.test(attribute.value)),
            ).length,
      );
    expect(bad).toBe(0);
    await page.getByText("View Full Chart Data", { exact: true }).click();
    await expect(page.locator(".operations-v2-chart-data tbody tr")).toHaveCount(
      window === "now" ? 1 : window === "next-4h" ? 16 : 96,
    );
  }
});

for (const width of [390, 768, 1280, 1920])
  test(`compute visual workspace fits ${width}px in both themes`, async ({ page }, info) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/operations?view=compute");
    await expect(page.getByRole("button", { name: /^(Show|Hide) panel/ })).toBeEnabled();
    for (const theme of ["dark", "light"]) {
      const toggle = page.getByRole("button", {
        name: new RegExp(`Theme: ${theme === "dark" ? "light" : "dark"}`),
      });
      if (await toggle.count()) await toggle.click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.getByLabel("Show eligible workload windows").check();
      const result = await new AxeBuilder({ page })
        .include(".operations-v2")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, issue: n.failureSummary })),
        })),
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      await page.screenshot({
        path: info.outputPath(`compute-${width}-${theme}.png`),
        fullPage: true,
      });
    }
  });
