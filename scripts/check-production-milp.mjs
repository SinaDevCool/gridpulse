// One real public calculation; no fixture result or heuristic substitution.
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";

const base = process.env.GRIDPULSE_HEALTH_BASE_URL ?? "https://gridpulseinsights.com";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await fs.mkdir("test-results", { recursive: true });
try {
  await page.goto(`${base}/operations?view=overview&mode=scenario&window=today`);
  const run = page.getByRole("button", { name: "Recalculate MILP", exact: true });
  await run.waitFor({ state: "visible", timeout: 30000 });
  await run.click();
  const result = page.locator("[data-assessment-id]");
  await result.waitFor({ state: "visible", timeout: 180000 });
  const fingerprint = await result.getAttribute("data-assessment-id");
  if (!/^[a-f0-9]{64}$/.test(fingerprint ?? "")) throw new Error("Accepted result identity missing");
  for (const [label, heading] of [["Compute & Workloads", "Solved workload schedule"], ["Power & Battery", "Joint-plan battery response"], ["Overview", "Optimised facility plan"]]) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await page.getByRole("heading", { name: heading, exact: true }).waitFor({ state: "visible", timeout: 15000 });
    if (await page.locator("[data-assessment-id]").getAttribute("data-assessment-id") !== fingerprint)
      throw new Error("Operations tabs do not share the accepted MILP result");
    const panels = page.locator("[data-assessment-id] .power-timeline-panel");
    await expect(panels).toHaveCount(label === "Power & Battery" ? 3 : 1);
    for (const panel of await panels.all()) {
      if ((await panel.boundingBox())?.height < 140) throw new Error("MILP chart panel collapsed");
      await expect(panel.locator("svg.recharts-surface")).toBeVisible();
    }
    if (label === "Power & Battery") {
      await result.getByText("View Full Interval Data", { exact: true }).click();
      const rows = result.locator("tbody tr");
      for (const row of await rows.all()) {
        for (const column of [3, 4]) {
          const soc = Number((await row.locator("td").nth(column).innerText()).replace("%", "").replace(",", "."));
          if (!Number.isFinite(soc) || soc < 19.99 || soc > 95.01) throw new Error(`Invalid displayed SOC: ${soc}`);
        }
      }
      await expect(rows.first().locator("td").nth(3)).toHaveText("78%");
      await rows.nth(2).locator("td").first().hover();
      await expect(rows.nth(2)).toHaveAttribute("data-preview", "true");
      await rows.nth(2).locator("td").first().click();
      await result.getByRole("heading").first().hover();
      await expect(rows.nth(2)).toHaveAttribute("aria-selected", "true");
      for (const theme of ["light", "dark"]) {
        await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
        await panels.first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/production-milp-${theme}.png`, fullPage: true });
      }
      await panels.last().scrollIntoViewIfNeeded();
      await page.setViewportSize({ width: 390, height: 844 });
      for (const panel of await panels.all()) {
        if ((await panel.boundingBox())?.height < 140) throw new Error("Mobile MILP chart panel collapsed");
      }
      await page.screenshot({ path: "test-results/production-milp-mobile.png", fullPage: true });
      await page.setViewportSize({ width: 1600, height: 1000 });
    }
  }
  const limit = page.getByRole("spinbutton", { name: "Facility Limit MW", exact: true });
  await limit.fill(String(Number(await limit.inputValue()) + 1));
  await page.getByRole("heading", { name: "MILP inputs changed", exact: true }).waitFor({ state: "visible" });
  await page.screenshot({ path: "test-results/production-milp.png", fullPage: true });
  console.log(JSON.stringify({ real_public_milp_completed: true, result_fingerprint: fingerprint,
    all_three_tabs_same_result: true, input_changes_mark_stale: true, physical_dispatch: false,
    soc_bounds_verified: true, three_battery_panels_visible: true, linked_rows_verified: true }));
} catch (error) {
  await page.screenshot({ path: "test-results/production-milp-failure.png", fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); }
