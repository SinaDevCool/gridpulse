// One real public calculation; no fixture result or heuristic substitution.
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { setTimeout as pause } from "node:timers/promises";

const base = process.env.GRIDPULSE_HEALTH_BASE_URL ?? "https://gridpulseinsights.com";
const browser = await chromium.launch({ headless: true, channel: process.env.GRIDPULSE_SMOKE_BROWSER_CHANNEL || undefined });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await fs.mkdir("test-results", { recursive: true });
try {
  await page.goto(`${base}/operations?view=overview&mode=scenario&window=today`);
  const run = page.getByRole("button", { name: "Optimise plan", exact: true });
  await run.waitFor({ state: "visible", timeout: 30000 });
  await expect(page.getByRole("status").filter({ hasText: "96 × 15-minute intervals · full modelled day" })).toBeVisible();
  await run.click();
  const result = page.locator("[data-assessment-id]");
  await result.waitFor({ state: "visible", timeout: 180000 });
  const fingerprint = await result.getAttribute("data-assessment-id");
  if (!/^[a-f0-9]{64}$/.test(fingerprint ?? "")) throw new Error("Accepted result identity missing");
  for (const [label, heading] of [["Compute & Workloads", "Solved workload schedule"], ["Power & Battery", "Facility Power & Battery Response"], ["Overview", "Optimised facility plan"]]) {
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
    if (label === "Compute & Workloads") {
      await expect(result.getByRole("region", { name: "Scheduled workload demand" })).toBeVisible();
      await expect(result.getByLabel("Workload outcomes")).toContainText("5 / 5");
      await expect(result.getByText("96 × 15-minute model intervals", { exact: false })).toBeVisible();
    }
    if (label === "Power & Battery") {
      await result.getByText("View Full Interval Data", { exact: true }).click();
      await expect(result.getByText(/96 of 96 records/)).toBeVisible();
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
      await result.getByRole("heading", { name: "Facility Power & Battery Response", exact: true }).hover();
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
  if (process.env.GRIDPULSE_CHECK_COPILOT === "true") {
    await page.getByRole("button", { name: "Plan copilot", exact: true }).click();
    const copilot = page.getByRole("dialog", { name: "Plan copilot", exact: true });
    const question = copilot.getByRole("textbox", { name: "Your question", exact: true });
    await question.fill("What did this plan achieve?");
    const conversationResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/operations/conversation" && response.request().method() === "POST", { timeout: 85_000 });
    await copilot.getByRole("button", { name: "Ask", exact: true }).click();
    const response = await conversationResponse;
    if (!response.ok()) throw new Error(`Production conversation HTTP ${response.status()}`);
    const answer = await response.json();
    if (answer.version !== "operations-conversation-v2" || answer.kind !== "answer" || answer.basis !== "model_evidence" ||
      answer.receipt?.resultFingerprint !== fingerprint || !answer.receipt?.jobId || !answer.receipt?.providerResponseId || !answer.evidence?.length)
      throw new Error("Production conversation is not grounded in this accepted plan/provider response");
    const expectedProvider = process.env.GRIDPULSE_EXPECT_COPILOT_PROVIDER;
    if (expectedProvider && answer.receipt?.generation?.provider !== expectedProvider)
      throw new Error("Production copilot provider does not match release configuration");
    if (answer.presentation !== "grounded_conversation")
      throw new Error("Production conversational writing did not pass its evidence checks");
    const answerLabel = answer.presentation === "grounded_conversation" ? "AI explanation · linked evidence"
      : answer.presentation === "checked_fallback" ? "Checked summary · conversational answer unavailable" : "Checked model evidence";
    await expect(copilot.getByRole("article").first()).toContainText(answerLabel);
    // Verify a real follow-up through the same UI and accepted assessment.
    for (const prompt of ["What happens at 08:00 UTC?", "Which workloads run then?"]) {
      // Brief and conversation share the production limit of two requests per minute.
      await pause(35_000);
      await question.fill(prompt);
      const pending = page.waitForResponse(response => new URL(response.url()).pathname === "/api/operations/conversation" && response.request().method() === "POST", { timeout: 85_000 });
      await copilot.getByRole("button", { name: "Ask", exact: true }).click();
      const http = await pending;
      if (!http.ok()) throw new Error("Production follow-up request failed");
      const followup = await http.json();
      if (followup.kind !== "answer" || followup.presentation !== "grounded_conversation" ||
        followup.receipt?.resultFingerprint !== fingerprint || followup.resolvedQuery?.intent !== "interval" ||
        !/^2026-09-26T08:00:00(?:\.000)?Z$/.test(followup.resolvedQuery?.start ?? "") ||
        expectedProvider && followup.receipt?.generation?.provider !== expectedProvider)
        throw new Error("Production follow-up lost the interval, assessment or provider identity");
    }
    await copilot.screenshot({ path: "test-results/production-copilot-conversation.png" });
    await copilot.getByRole("button", { name: "Plan brief", exact: true }).click();
    await pause(35_000);
    const briefResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/operations/brief" && response.request().method() === "POST", { timeout: 85_000 });
    await copilot.getByRole("button", { name: "Explain this plan", exact: true }).click();
    const briefHttp = await briefResponse;
    if (!briefHttp.ok()) throw new Error(`Production brief HTTP ${briefHttp.status()}`);
    const brief = await briefHttp.json();
    if (brief.version !== "operations-brief-v2" || brief.resultFingerprint !== fingerprint ||
      brief.receipt?.jobId !== answer.receipt.jobId || !brief.receipt?.providerResponseId || !brief.findings?.length ||
      !brief.findings.every(finding => finding.factIds.every(id => brief.evidence.some(fact => fact.id === id))))
      throw new Error("Production brief contains invalid assessment/evidence references");
    await expect(copilot.getByRole("checkbox")).toBeVisible();
    await expect(copilot.getByRole("button", { name: "Download brief", exact: true })).toBeDisabled();
    await copilot.screenshot({ path: "test-results/production-copilot-brief.png" });
    await copilot.getByRole("button", { name: "Close copilot", exact: true }).click();
    console.log(JSON.stringify({ production_copilot_verified: true, provider_backed_endpoints_verified: 2, conversational_turns_verified: 3, provider: answer.receipt.generation?.provider,
      same_milp_result: true, evidence_references_checked: true, review_gate_preserved: true }));
  }
  const limit = page.getByRole("spinbutton", { name: "Facility Limit MW", exact: true });
  await limit.fill(String(Number(await limit.inputValue()) + 1));
  await page.getByRole("heading", { name: "Plan inputs changed", exact: true }).waitFor({ state: "visible" });
  await page.screenshot({ path: "test-results/production-milp.png", fullPage: true });
  console.log(JSON.stringify({ real_public_milp_completed: true, result_fingerprint: fingerprint,
    all_three_tabs_same_result: true, input_changes_mark_stale: true, physical_dispatch: false,
    soc_bounds_verified: true, three_battery_panels_visible: true, linked_rows_verified: true,
    quarter_hour_intervals_verified: true, workload_workspace_verified: true }));
} catch (error) {
  await page.screenshot({ path: "test-results/production-milp-failure.png", fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); }
