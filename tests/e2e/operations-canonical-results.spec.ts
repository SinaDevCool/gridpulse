import { guidanceSchema } from "../../src/features/operations/copilot/guidance-contracts";
import { checkedFindings } from "../../src/features/operations/copilot/checked-findings";
import { retrieveOperationalKnowledge } from "../../src/server/operations/operational-knowledge";
import { openEvidenceInputs } from "./operations-inputs";
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { canonicalMilpJob } from "../fixtures/canonical-milp-job";
import type { FacilityPlanRequest } from "../../src/features/analytics/contracts";
import { buildBriefEvidence, renderPlanBrief, formatBriefFact } from "../../src/features/operations/copilot/brief";
import { selectCanonicalPresentation } from "../../src/features/operations/canonical-presentation";
import { readFile } from "node:fs/promises";
import { answerConversation } from "../../src/features/operations/copilot/conversation-query";
import { conversationRequestSchema, conversationResponseSchema, type ConversationQuery } from "../../src/features/operations/copilot/conversation-contracts";

test.use({ storageState: { cookies: [], origins: [] } });
test("MILP charts retain physical SOC, geometry and shared keyboard/pointer inspection", async ({ page }) => {
  // Three linked workspaces, theme audits and focused desktop/mobile captures exceed
  // the former 30-second whole-test budget. Product waits and solver budgets are unchanged.
  // Includes three tabs, both themes, mobile geometry, accessibility and the copilot lifecycle.
  test.setTimeout(120_000);
  // A returning visitor's legacy calculator preference must not reopen the
  // retired public selector or bypass the enabled optimiser.
  await page.addInitScript(() => localStorage.setItem("gridpulse-calculator", "scenario"));
  const token = `e30.${Buffer.from(JSON.stringify({ role: "gridpulse_public_visitor", exp: 4102444800 })).toString("base64url")}.fixture`;
  await page.route("**/auth/v1/signup", route => route.fulfill({ json: { access_token: token,
    token_type: "bearer", refresh_token: "fixture", expires_in: 3600,
    user: { id: "00000000-0000-4000-8000-000000000002", is_anonymous: true, aud: "authenticated" } } }));
  let request: FacilityPlanRequest;
  let submissions = 0;
  let exerciseFlows = false;
  let explanations = 0;
  let conversations = 0;
  let holdConversation = false;
  await page.route("**/api/operations/conversation", async route => {
    expect(route.request().headers()["x-gridpulse-capabilities"]).toBe("verified-findings-v2");
    conversations++;
    if (holdConversation) { await new Promise(resolve => setTimeout(resolve, 800)); }
    const input = conversationRequestSchema.parse(route.request().postDataJSON());
    const job = canonicalMilpJob(request);
    const query: ConversationQuery = { intent: input.question.includes("training") ? "workload" : input.question.includes("alternative") ? "what_if" :
      input.question.includes("Which") ? "interval" : "summary", start: null, end: null, workloadId: null, focus: "selected", definition: "none" };
    if (query.intent === "workload") query.workloadId = String(request.workloads[0].workload_id);
    const answer = answerConversation(selectCanonicalPresentation(job, request), input, query,
      { model: "browser-test-fixture", responseId: null, usage: null });
    if (input.question === "What did this plan achieve?") {
      expect(input.transcript).toEqual([]);
      const peak = answer.evidence.find(fact => fact.id === "power.plan_peak")!;
      const additionalCheckedText = answer.blocks.slice(1, 3);
      answer.blocks = [`Modelled peak import is ${formatBriefFact(peak)}. Review the workload and battery checks before using this modelled plan.`, ...additionalCheckedText];
      answer.presentation = "grounded_conversation";
      answer.paragraphSources = answer.blocks.map(() => ({ factIds: answer.evidence.slice(0, 16).map(fact => fact.id), guidanceIds: [] }));
      const guidance = guidanceSchema.parse(retrieveOperationalKnowledge("liquid cooling topology").find(item => "sourceId" in item && item.sourceId === "B04"));
      answer.guidance = [guidance];
      answer.blocks.push(`General guidance — ${guidance.title}: ${guidance.text}`);
      answer.paragraphSources.push({ factIds: [], guidanceIds: [guidance.id] });
      answer.findings = checkedFindings(answer);
    }
    if (input.question === "Which workloads run then?") {
      expect(input.transcript?.[0].answer).toContain("Review the workload and battery checks");
      answer.presentation = "checked_fallback";
    }
    await route.fulfill({ json: conversationResponseSchema.parse(answer) }).catch(() => {});
  });
  await page.route("**/api/operations/brief", route => {
    explanations++;
    const job = canonicalMilpJob(request);
    const evidence = buildBriefEvidence(selectCanonicalPresentation(job, request), job.id);
    return route.fulfill({ json: renderPlanBrief({ findings: ["peak", "limit"], actions: ["review_inputs"] }, evidence, "browser-test-fixture") });
  });
  await page.route("**/v1/jobs/**", route => {
    if (route.request().method() === "POST") {
      submissions++;
      request = route.request().postDataJSON() as FacilityPlanRequest;
      return route.fulfill({ json: { job_id: "00000000-0000-4000-8000-000000000001", status: "queued" } });
    }
    const job = canonicalMilpJob(request);
    if (exerciseFlows && request.batteries?.length) {
      const result = job.result_payload.result;
      const discharge = request.intervals.findIndex(interval => String(interval.start).includes("T08:00:"));
      const charge = request.intervals.findIndex(interval => String(interval.start).includes("T09:00:"));
      Object.assign(result.facility.points[discharge], { battery_discharge_mw: 4.8, grid_import_mw: 46.2 });
      Object.assign(result.facility.points[charge], { battery_charge_mw: 5 / .95, grid_import_mw: 51 + 5 / .95 });
      const used = 5 * Number(request.intervals[discharge].duration_minutes) / 60;
      for (let index = discharge; index < charge; index++) {
        result.battery_trajectories[0].points[index].soc_mwh = Number(request.batteries[0].initial_soc_mwh) - used;
      }
    }
    return route.fulfill({ json: job });
  });
  await page.goto("/operations?view=power&mode=scenario&window=today");
  await expect(page.getByRole("button", { name: /^(Show|Hide) panel/ })).toBeEnabled();
  const run = page.getByRole("button", { name: "Optimise plan", exact: true });
  if (process.env.GRIDPULSE_TEST_MILP_REQUIRED === "1") await expect(run).toBeVisible();
  else test.skip(!await run.isVisible(), "MILP flag disabled in this candidate; focused qualification requires it");
  const assertSinglePlanningExperience = async () => {
    await expect(page.getByRole("group", { name: "Calculation method", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Scenario calculator|Joint MILP/ })).toHaveCount(0);
    await expect(page.getByLabel("MILP calculation status").getByText("Optimised planning", { exact: true })).toBeVisible();
    await expect(run).toBeVisible();
  };
  await assertSinglePlanningExperience();
  await expect(page.getByRole("heading", { name: "No optimised plan yet", exact: true })).toBeVisible();
  expect(submissions).toBe(0);
  await run.click();
  const result = page.locator("[data-assessment-id]");
  await expect(result).toBeVisible();
  const launcher = page.getByRole("button", { name: "Plan copilot", exact: true });
  await launcher.click();
  const copilot = page.getByRole("dialog", { name: "Plan copilot", exact: true });
  const chat = copilot.getByRole("region", { name: "Ask about this plan", exact: true });
  const questionInput = chat.getByRole("textbox", { name: "Your question", exact: true });
  await expect(copilot).toBeVisible();
  await expect(copilot.getByRole("button", { name: "Conversation", exact: true })).toHaveAttribute("aria-pressed", "true");
  await copilot.getByRole("button", { name: "Close copilot", exact: true }).click();
  await expect(launcher).toBeFocused();
  await launcher.click();
  await chat.getByRole("button", { name: "When is battery reserve lowest?", exact: true }).click();
  await expect(questionInput).toHaveValue("When is battery reserve lowest?");
  await questionInput.press("Shift+Enter");
  await expect(questionInput).toHaveValue("When is battery reserve lowest?\n");
  expect(conversations).toBe(0);
  await questionInput.fill("What did this plan achieve?");
  await questionInput.press("Enter");
  await expect(chat.getByRole("article").first()).toContainText("Modelled peak import");
  await expect(chat.getByRole("article").first()).toContainText("AI explanation · linked evidence");
  await expect(chat.getByRole("article").first().locator(".ops-chat-facts")).toHaveCount(0);
  const firstAnswer = chat.getByRole("article").first();
  await expect(firstAnswer.locator('.ops-checked-finding[data-kind="guidance"]')).toContainText("General guidance");
  await firstAnswer.getByText("Report guidance & sources · 1", { exact: true }).click();
  await expect(firstAnswer.getByRole("link", { name: /Read source:/ })).toHaveAttribute("href", /\.pdf#page=\d+$/);
  await expect(firstAnswer.getByText("Excluded uses", { exact: true })).toBeVisible();
  await expect(firstAnswer.getByText("Source version & integrity", { exact: true })).toBeVisible();
  await expect(firstAnswer.getByText(/Supporting assessment evidence:/)).toHaveCount(0);
  const originalViewport = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    // A source-link scan can clip the earlier guidance card out of the scrollport.
    // Exercise each highlighted surface while visible, with the Ask button enabled.
    await questionInput.fill("Which evidence should I review?");
    await expect(chat.getByRole("button", { name: "Ask", exact: true })).toBeEnabled();
    for (const surface of [firstAnswer.locator(".ops-chat-question"), firstAnswer.locator('.ops-checked-finding[data-kind="guidance"]')]) {
      await surface.scrollIntoViewIfNeeded();
      expect((await new AxeBuilder({ page }).include(".ops-copilot-panel").analyze()).violations).toEqual([]);
    }
    await questionInput.fill("");
    await firstAnswer.getByRole("link", { name: /Read source:/ }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect((await new AxeBuilder({ page }).include(".ops-copilot-panel").analyze()).violations).toEqual([]);
    await copilot.screenshot({ path: `test-results/copilot-guidance-mobile-${theme}.png` });
  }
  await page.setViewportSize(originalViewport);
  await questionInput.fill("Which workloads run then?");
  await chat.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(chat.getByRole("article").nth(1)).toContainText("Grid import");
  await expect(chat.getByRole("article").nth(1)).toContainText("conversational answer unavailable");
  await chat.getByRole("article").nth(1).getByText(/^Sources/).click();
  await chat.getByRole("article").nth(1).getByText("Technical sources", { exact: true }).click();
  await expect(chat.getByRole("article").nth(1)).toContainText("CanonicalPresentation.points[0].gridImportMw");
  await chat.screenshot({ path: "test-results/copilot-conversation-desktop.png" });
  holdConversation = true;
  await questionInput.fill("Test an alternative");
  await chat.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(chat.getByRole("button", { name: "Ask", exact: true })).toBeDisabled();
  await chat.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(questionInput).toHaveValue("Test an alternative");
  await page.waitForTimeout(850);
  expect(await chat.getByRole("article").count()).toBe(2);
  holdConversation = false;
  await chat.getByRole("button", { name: "Retry question", exact: true }).click();
  await expect(chat.getByRole("article").nth(2)).toContainText("requires a new MILP calculation");
  expect(conversations).toBe(4);
  const alternative = chat.getByRole("region", { name: "Alternative plan review" });
  await expect(alternative).toBeVisible();
  const alternativeSubmit = alternative.getByRole("button", { name: "Calculate alternative", exact: true });
  await expect(alternativeSubmit).toBeDisabled();
  await alternative.getByRole("spinbutton").fill("40");
  await expect(alternativeSubmit).toBeDisabled();
  await alternative.getByRole("checkbox", { name: "Confirm this separate calculation" }).check();
  await expect(alternativeSubmit).toBeEnabled();
  // Do not submit here: this shared fixture keeps the original job for the remaining cross-tab checks.
  expect(submissions).toBe(1);

  await questionInput.fill("Show Foundation model training");
  await chat.getByRole("button", { name: "Ask", exact: true }).click();
  await chat.getByRole("article").nth(3).getByRole("button", { name: "Inspect workload", exact: true }).click();
  await expect(result.locator(".canonical-workload-inspector")).toBeVisible();
  await result.getByRole("button", { name: "Close workload details", exact: true }).click();
  await launcher.click();
  await expect(chat.getByRole("article")).toHaveCount(4);
  await chat.getByRole("article").nth(1).getByRole("button", { name: "Inspect interval workloads", exact: true }).click();
  await expect(result).toHaveAttribute("data-inspected-time", "2026-09-26T00:00:00.000Z");
  await page.getByRole("link", { name: "Power & Battery", exact: true }).click();
  await launcher.click();
  await expect(chat.getByRole("article")).toHaveCount(4);
  await chat.getByRole("button", { name: "Clear conversation", exact: true }).click();
  await expect(chat.getByRole("article")).toHaveCount(4);
  await chat.getByRole("button", { name: "Keep conversation", exact: true }).click();
  expect(explanations).toBe(0);
  await copilot.getByRole("button", { name: "Plan brief", exact: true }).click();
  await copilot.getByRole("button", { name: "Explain this plan", exact: true }).click();
  await expect(page.locator(".ops-plan-copilot")).toContainText("The solver reported optimal within the submitted model");
  await copilot.getByText("Power", { exact: true }).click();
  const peakEvidence = copilot.locator(".ops-plan-copilot .ops-copilot-sources").filter({ hasText: "Baseline peak import" }).first();
  await peakEvidence.locator("summary").first().click();
  await peakEvidence.getByText("Technical sources", { exact: true }).click();
  await expect(peakEvidence.getByText("power.plan_peak", { exact: true })).toBeVisible();
  await expect(peakEvidence).toContainText("Raw value: 51 MW");
  await copilot.screenshot({ path: "test-results/copilot-desktop-evidence.png" });
  for (const theme of ["dark", "light"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    expect((await new AxeBuilder({ page }).include(".ops-copilot-panel").analyze()).violations).toEqual([]);
    await copilot.screenshot({ path: `test-results/copilot-evidence-${theme}.png` });
  }
  await page.setViewportSize({ width: 1920, height: 1000 });
  await expect.poll(() => copilot.evaluate(node => node.matches(":modal"))).toBe(false);
  const evidenceBounds = (await result.boundingBox())!;
  const assistantBounds = (await copilot.boundingBox())!;
  expect(evidenceBounds.width).toBeGreaterThan(600);
  expect(evidenceBounds.x + evidenceBounds.width).toBeLessThanOrEqual(assistantBounds.x);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect.poll(() => copilot.evaluate(node => node.matches(":modal"))).toBe(true);
  await expect(copilot.getByRole("button", { name: "Download brief", exact: true })).toBeDisabled();
  await expect(copilot.getByRole("button", { name: "Download evidence JSON", exact: true })).toBeDisabled();
  await copilot.getByRole("checkbox").check();
  await expect(copilot.getByRole("button", { name: "Download brief", exact: true })).toBeEnabled();
  const download = page.waitForEvent("download");
  await copilot.getByRole("button", { name: "Download brief", exact: true }).click();
  const downloaded = await download;
  expect(downloaded.suggestedFilename()).toBe("gridpulse-plan-brief.txt");
  await downloaded.saveAs("test-results/copilot-reviewed-export.txt");
  const exported = await readFile((await downloaded.path())!, "utf8");
  expect(exported).toContain('"jobId": "00000000-0000-4000-8000-000000000001"');
  expect(exported).toContain("Human review: 20");
  const jsonDownload = page.waitForEvent("download");
  await copilot.getByRole("button", { name: "Download evidence JSON", exact: true }).click();
  const jsonArtifact = await jsonDownload;
  await jsonArtifact.saveAs("test-results/copilot-reviewed-export.json");
  const exportedJson = JSON.parse(await readFile("test-results/copilot-reviewed-export.json", "utf8"));
  expect(exportedJson.contentDigest).toBe(createHash("sha256").update(JSON.stringify(exportedJson.brief)).digest("hex"));
  expect(exportedJson.operationalApproval).toBe(false);
  expect(exportedJson.reviewAcknowledgedAt).toMatch(/^20/);
  expect(exportedJson.brief.resultFingerprint).toBe(canonicalMilpJob(request).result_payload.result_fingerprint);
  expect(exported).toContain("Review acknowledgement is not operational approval.");
  await copilot.getByText("Receipt and limitations", { exact: true }).click();
  await copilot.screenshot({ path: "test-results/copilot-reviewed-receipt.png" });
  await copilot.getByText("Receipt and limitations", { exact: true }).click();
  expect(explanations).toBe(1);
  expect(request!.intervals).toHaveLength(96);
  expect(request!.intervals.at(-1)!.start).toBe("2026-09-26T23:45:00.000Z");
  if (await copilot.isVisible()) await copilot.getByRole("button", { name: "Close copilot", exact: true }).click();
  const batteryInspector = result.getByLabel("Selected battery interval", { exact: true });
  await expect(batteryInspector.getByRole("img", { name: "Battery state of charge 78 percent", exact: true })).toBeVisible();
  await expect(batteryInspector.getByRole("region", { name: "Battery state and reserve" })).toContainText("Protected reserve");
  await expect(batteryInspector.getByRole("region", { name: "Full-horizon terminal target" })).toContainText("Met within model");
  await expect(batteryInspector.getByRole("region", { name: "Selected interval operating margins" })).toContainText("Below threshold");
  // Compare the same DOM text representation before/after inspection; innerText
  // introduces layout line breaks that Playwright's textContent assertion does not.
  const terminalText = await batteryInspector.getByRole("region", { name: "Full-horizon terminal target" }).textContent() ?? "";
  expect(terminalText).not.toBe("");
  await batteryInspector.getByText("Energy accounting", { exact: true }).click();
  await expect(batteryInspector.getByRole("heading", { name: "Stored energy · DC", exact: true })).toBeVisible();
  await expect(batteryInspector.getByRole("heading", { name: "This interval · AC", exact: true })).toBeVisible();
  await expect(batteryInspector.getByText(/not a backup-duration guarantee/)).toBeVisible();
  await batteryInspector.getByText("Energy accounting", { exact: true }).click();
  const panels = result.locator(".power-timeline-panel");
  await expect(panels).toHaveCount(3);
  for (const panel of await panels.all()) {
    expect((await panel.boundingBox())!.height).toBeGreaterThan(140);
    await expect(panel.locator("svg.recharts-surface")).toBeVisible();
  }
  await expect(result.getByLabel("Selected interval power facts")).toContainText("Battery · idle");
  await expect(result.getByLabel("Selected battery interval")).toContainText("78");
  await expect(result.getByLabel("Full-horizon battery assessment")).toContainText("Reserve protected");
  await expect(result.getByText("Battery idle throughout this plan", { exact: true })).toBeVisible();
  await expect(result.getByRole("list", { name: "Grid demand legend", exact: true })).toBeVisible();
  await expect(result.getByRole("list", { name: "Battery power legend", exact: true })).toBeVisible();
  await expect(result.getByRole("list", { name: "Stored energy legend", exact: true })).toBeVisible();
  await expect(result.getByText("00:00 +1 day", { exact: true })).toBeVisible();
  const beforeBattery = result.getByRole("button", { name: /^Before battery/ });
  await beforeBattery.click();
  await expect(beforeBattery).toHaveAttribute("aria-pressed", "false");
  await result.getByRole("button", { name: "Reset charts", exact: true }).click();
  await expect(beforeBattery).toHaveAttribute("aria-pressed", "true");
  await expect(result.locator(".battery-inspection-band")).toHaveCount(3);
  await result.getByText("Power path", { exact: true }).click();
  await expect(result.getByRole("img", { name: /Proportional power flows/ })).toBeVisible();
  await result.getByText("Power path", { exact: true }).click();
  expect(submissions).toBe(1);
  const legend = result.getByRole("button", { name: /State of charge/ });
  await legend.click();
  await expect(legend).toHaveAttribute("aria-pressed", "false");
  await legend.click();
  await expect(legend).toHaveAttribute("aria-pressed", "true");
  await result.getByText("View Full Interval Data", { exact: true }).click();
  await result.getByLabel("Show intervals").selectOption("constraint");
  await expect(result.getByText("No records match this filter.", { exact: true })).toBeVisible();
  await result.getByLabel("Show intervals").selectOption("all");
  const row = result.locator("tbody tr").nth(2);
  const time = "2026-09-26T00:30:00.000Z";
  await row.locator("td").first().hover();
  await expect(result).toHaveAttribute("data-inspected-time", time);
  await expect(batteryInspector.getByRole("region", { name: "Full-horizon terminal target" })).toHaveText(terminalText);
  await row.locator("td").first().click();
  await result.getByRole("heading", { name: "Facility Power & Battery Response", exact: true }).hover();
  await expect(result).toHaveAttribute("data-inspected-time", time);
  await row.getByRole("button").focus();
  await page.keyboard.press("Enter");
  await expect(row).toHaveAttribute("aria-selected", "true");
  await page.getByRole("link", { name: "Compute & Workloads", exact: true }).click();
  await expect(page.locator(".ops-plan-copilot")).toContainText("The solver reported optimal within the submitted model");
  expect(explanations).toBe(1);
  await assertSinglePlanningExperience();
  await expect(page.getByRole("heading", { name: "Solved workload schedule" })).toBeVisible();
  await expect(result.locator(".power-timeline-panel")).toHaveCount(1);
  const lane = result.getByRole("button", { name: /Foundation model training.*06:00/ });
  await lane.click();
  await expect(result).toHaveAttribute("data-inspected-time", "2026-09-26T06:00:00.000Z");
  await expect(result.getByLabel("Execution time axis UTC")).toBeVisible();
  await expect(result.getByRole("region", { name: "Scheduled workload demand" })).toBeVisible();
  await expect(result.getByLabel("Workload outcomes")).toContainText("Remaining work");
  const outcomes = result.getByLabel("Workload outcomes");
  await outcomes.getByRole("button", { name: /^Inspect Vision fine-tuning:/ }).click();
  await expect(result.getByLabel("Workload details: Vision fine-tuning", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  const intervalSummary = result.getByRole("region", { name: "Inspected compute interval" });
  await expect(intervalSummary).toContainText("06:15 UTC");
  await expect(intervalSummary.getByRole("img")).toHaveAttribute("aria-label", /Protected.*MW.*Flexible.*MW/);
  await expect(result.locator(".canonical-workload-chart .recharts-reference-area")).toHaveCount(1);
  const reviewFilters = result.getByLabel("Workload review filters");
  await reviewFilters.getByRole("button", { name: /^Protected workloads/ }).click();
  await expect(result.locator(".canonical-execution .compute-window-lane")).toHaveCount(1);
  await expect(result.locator(".canonical-compute-review tbody tr")).toHaveCount(1);
  await expect(result.getByLabel(/Workload details:/)).toHaveCount(0);
  await reviewFilters.getByRole("button", { name: /^All workloads/ }).click();
  await expect(result.locator(".canonical-execution .compute-window-lane")).toHaveCount(5);
  await result.getByText("Show facility context", { exact: true }).click();
  await expect(result.getByText("Facility Power", { exact: true })).toBeVisible();
  await result.getByText("Show facility context", { exact: true }).click();
  await intervalSummary.getByRole("button", { name: /^Flexible compute/ }).click();
  await expect(result.locator(".canonical-execution .compute-window-lane")).toHaveCount(4);
  await reviewFilters.getByRole("button", { name: /^All workloads/ }).click();
  await result.getByRole("checkbox", { name: "Show earliest-start/deadline envelopes" }).check();
  await expect(result.locator(".canonical-permitted")).toHaveCount(5);
  await lane.click();
  const inspector = result.getByLabel("Workload details: Foundation model training", { exact: true });
  await expect(inspector).toContainText("Submitted constraints");
  await expect(inspector).toContainText("GPU allocation");
  await expect(result.getByRole("button", { name: /Selected workload.*Included in total/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(inspector).toHaveCount(0);
  await lane.focus();
  await page.keyboard.press("ArrowRight");
  await expect(result).toHaveAttribute("data-inspected-time", "2026-09-26T06:15:00.000Z");
  await page.keyboard.press("ArrowRight");
  await expect(result).toHaveAttribute("data-inspected-time", "2026-09-26T06:30:00.000Z");
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    expect((await new AxeBuilder({ page }).include(".canonical-compute").analyze()).violations).toEqual([]);
    const colors = await result.evaluate(element => {
      const style = getComputedStyle(element);
      return [style.getPropertyValue("--ops-flexible"), style.getPropertyValue("--ops-protected"), style.getPropertyValue("--ops-selected")];
    });
    expect(new Set(colors).size).toBe(3);
    await result.locator(".canonical-workload-chart").scrollIntoViewIfNeeded();
    await result.locator(".canonical-workload-chart").screenshot({ path: `test-results/canonical-compute-chart-${theme}.png` });
    await outcomes.screenshot({ path: `test-results/canonical-compute-outcomes-${theme}.png` });
    await intervalSummary.screenshot({ path: `test-results/canonical-compute-interval-${theme}.png` });
    await result.locator(".canonical-execution .compute-window-lane").first().screenshot({ path: `test-results/canonical-compute-lane-${theme}.png` });
    await page.screenshot({ path: `test-results/canonical-compute-${theme}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.setViewportSize({ width: 390, height: 1100 });
  await outcomes.screenshot({ path: "test-results/canonical-compute-outcomes-mobile.png" });
  await intervalSummary.screenshot({ path: "test-results/canonical-compute-interval-mobile.png" });
  await result.locator(".canonical-workload-chart").screenshot({ path: "test-results/canonical-compute-chart-mobile.png" });
  await result.locator(".canonical-execution .compute-window-lane").first().screenshot({ path: "test-results/canonical-compute-lane-mobile.png" });
  await page.screenshot({ path: "test-results/canonical-compute-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1600, height: 1000 });
  expect(submissions).toBe(1);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await assertSinglePlanningExperience();
  await expect(result.getByText("Peak reduced by", { exact: true })).toBeVisible();
  await expect(result.getByText("Plan peak import", { exact: true })).toHaveCount(0);
  await expect(result.locator(".power-timeline-panel")).toHaveCount(1);
  await expect(result.getByRole("meter", { name: "Peak import after response" })).toHaveAttribute("aria-valuenow", "51");
  const explorer = result.getByRole("region", { name: "MILP response explorer" });
  await expect(explorer.locator(".ops-compact-comparison tbody tr")).toHaveCount(2);
  await expect(explorer.locator(".ops-peak-comparison")).toHaveCount(2);
  const checks = result.getByRole("region", { name: "Full-horizon model checks" });
  await expect(checks).toHaveCount(1);
  await expect(checks).toContainText("Some checks unavailable");
  await expect(checks).toContainText("5 deadline checks unavailable");
  await expect(checks.locator(".ops-model-check-list li")).toHaveCount(4);
  const checkHeight = (await checks.locator(".ops-model-check-list").boundingBox())!.height;
  await checks.getByText("Review supporting details", { exact: true }).click();
  await expect(checks.getByRole("table")).toBeVisible();
  expect((await checks.locator(".ops-model-check-list").boundingBox())!.height).toBeCloseTo(checkHeight, 0);
  expect((await checks.locator("details").boundingBox())!.width).toBeGreaterThan((await checks.boundingBox())!.width * .9);
  for (const item of await checks.locator(".ops-model-check-list li").all()) expect((await item.boundingBox())!.height).toBeLessThan(100);
  await checks.getByText("Review supporting details", { exact: true }).click();
  await explorer.getByRole("button", { name: "Operating margins", exact: true }).click();
  await expect(explorer.getByRole("region", { name: "Operating margins", exact: true })).toContainText("Whole-plan peak");
  await expect(explorer).toContainText("Inspected interval");
  await expect(explorer.locator(".ops-margin-table tbody tr")).toHaveCount(2);
  await explorer.getByRole("button", { name: "Interval breakdown", exact: true }).click();
  await expect(explorer.getByRole("img", { name: /Selected interval power balance/ })).toBeVisible();
  await expect(explorer.getByText(/Balance discrepancy/)).toHaveCount(0);
  await result.getByText("Set inspection range", { exact: true }).click();
  await result.getByLabel("Range start", { exact: true }).selectOption("2");
  await expect(result).toHaveAttribute("data-inspected-time", "2026-09-26T00:30:00.000Z");
  await expect(result.getByRole("meter")).toHaveAttribute("aria-valuenow", "51");
  await result.getByRole("button", { name: "Reset inspection range", exact: true }).click();
  await result.getByRole("button", { name: "Inspect plan peak", exact: true }).click();
  expect(submissions).toBe(1);
  await expect(result).toHaveAttribute("data-assessment-id", "a".repeat(64));
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    expect((await new AxeBuilder({ page }).include(".ops-canonical").analyze()).violations).toEqual([]);
    await result.getByLabel("Operating summary", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/canonical-summary-${theme}.png` });
    await explorer.locator(".ops-waterfall").scrollIntoViewIfNeeded();
    await explorer.screenshot({ path: `test-results/canonical-explorer-breakdown-${theme}.png` });
    await page.screenshot({ path: `test-results/canonical-balance-${theme}.png` });
    await explorer.getByRole("button", { name: "Operating margins", exact: true }).click();
    await explorer.screenshot({ path: `test-results/canonical-explorer-margins-${theme}.png` });
    await explorer.getByRole("button", { name: "Plan comparison", exact: true }).click();
    await explorer.screenshot({ path: `test-results/canonical-explorer-comparison-${theme}.png` });
    await checks.screenshot({ path: `test-results/canonical-checks-closed-${theme}.png` });
    await checks.getByText("Review supporting details", { exact: true }).click();
    await checks.screenshot({ path: `test-results/canonical-checks-open-${theme}.png` });
    await checks.getByText("Review supporting details", { exact: true }).click();
    await explorer.getByRole("button", { name: "Interval breakdown", exact: true }).click();
    await result.locator(".power-timeline-panel").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/canonical-${theme}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await explorer.locator(".ops-waterfall").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/canonical-overview-mobile.png" });
  await explorer.getByRole("button", { name: "Plan comparison", exact: true }).click();
  await expect(explorer.locator(".ops-compact-comparison tbody tr")).toHaveCount(2);
  await checks.getByText("Review supporting details", { exact: true }).click();
  await expect(checks.getByRole("table", { name: "Workload completion · full submitted horizon", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 1300 });
  const evidence = checks.getByRole("region", { name: "Workload completion evidence", exact: true });
  await evidence.focus();
  await expect(evidence).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => evidence.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await checks.screenshot({ path: "test-results/canonical-checks-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await explorer.getByRole("button", { name: "Operating margins", exact: true }).click();
  await explorer.screenshot({ path: "test-results/canonical-margins-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect((await new AxeBuilder({ page }).include(".ops-canonical").analyze()).violations).toEqual([]);
  await expect(result.locator(".ops-canonical-selected")).toBeVisible();
  expect(submissions).toBe(1);
  await page.getByRole("link", { name: "Power & Battery", exact: true }).click();
  for (const panel of await panels.all()) expect((await panel.boundingBox())!.height).toBeGreaterThan(140);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  // Capture the complete sidebar at desktop width without the app's inner scroll
  // viewport clipping its lower accounting disclosure.
  await page.setViewportSize({ width: 1600, height: 1800 });
  for (const theme of ["dark", "light"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    expect((await new AxeBuilder({ page }).include(".ops-canonical").analyze()).violations).toEqual([]);
    await result.getByLabel("Selected battery interval").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/canonical-battery-inspector-${theme}.png` });
    await batteryInspector.screenshot({ path: `test-results/canonical-battery-sidebar-closed-${theme}.png` });
    await batteryInspector.getByText("Energy accounting", { exact: true }).click();
    expect((await new AxeBuilder({ page }).include(".ops-canonical").analyze()).violations).toEqual([]);
    await batteryInspector.screenshot({ path: `test-results/canonical-battery-sidebar-open-${theme}.png` });
    await batteryInspector.getByText("Energy accounting", { exact: true }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await launcher.click();
  await copilot.getByRole("button", { name: "Conversation", exact: true }).click();
  const composerBounds = (await chat.locator("form").boundingBox())!;
  expect(composerBounds.height).toBeLessThanOrEqual(844 * .48 + 1);
  expect((await chat.locator(".ops-chat-transcript").boundingBox())!.height).toBeGreaterThan(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await copilot.screenshot({ path: "test-results/copilot-mobile.png" });
  await chat.getByText("Keyboard, privacy & session details", { exact: true }).click();
  expect((await chat.locator("form").boundingBox())!.height).toBeLessThanOrEqual(844 * .48 + 1);
  await chat.getByText("Keyboard, privacy & session details", { exact: true }).click();
  expect((await new AxeBuilder({ page }).include(".ops-copilot-panel").analyze()).violations).toEqual([]);
  await copilot.getByRole("button", { name: "Close copilot", exact: true }).click();
  await batteryInspector.getByText("Energy accounting", { exact: true }).click();
  await page.setViewportSize({ width: 390, height: 1500 });
  await batteryInspector.screenshot({ path: "test-results/canonical-battery-sidebar-mobile.png" });
  expect((await new AxeBuilder({ page }).include(".ops-canonical").analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await batteryInspector.getByText("Energy accounting", { exact: true }).click();
  await panels.last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/canonical-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1600, height: 1000 });
  const batterySection = page.locator("#operations-inputs").getByText("Battery", { exact: true });
  await batterySection.click();
  await page.getByText("Advanced battery settings", { exact: true }).click();
  await page.getByRole("checkbox", { name: "Battery available", exact: true }).uncheck();
  await launcher.click();
  await expect(copilot).toContainText("Inputs changed");
  await expect(questionInput).toBeDisabled();
  await expect(chat.getByRole("article")).toHaveCount(0);
  await expect(copilot.getByRole("button", { name: "Download brief", exact: true })).toHaveCount(0);
  await copilot.getByRole("button", { name: "Close copilot", exact: true }).click();
  await run.click();
  await expect(result.getByLabel("Selected battery interval")).toContainText("No battery in this plan");
  await launcher.click();
  await copilot.getByRole("button", { name: "Plan brief", exact: true }).click();
  await expect(copilot.getByRole("button", { name: "Explain this plan", exact: true })).toBeEnabled();
  await expect(copilot.getByRole("checkbox")).toHaveCount(0);
  await expect(batteryInspector.getByText("Energy accounting", { exact: true })).toHaveCount(0);
  await expect(result.locator(".power-timeline-panel")).toHaveCount(1);
  await copilot.getByRole("button", { name: "Close copilot", exact: true }).click();
  exerciseFlows = true;
  await page.getByRole("checkbox", { name: "Battery available", exact: true }).check();
  await run.click();
  await expect(result.locator(".power-timeline-panel")).toHaveCount(3);
  await result.getByRole("button", { name: /First charge/ }).click();
  await expect(result).toHaveAttribute("data-inspected-time", "2026-09-26T09:00:00.000Z");
  await expect(result.getByLabel("Selected interval power facts")).toContainText("Battery · charging");
  await expect(batteryInspector.locator(".canonical-dispatch-state")).toContainText("Charging");
  await expect(batteryInspector.getByLabel("Interval SOC transition")).toContainText("End");
  await expect(result.getByLabel("Selected interval power facts")).toContainText("-5.3 MW");
  await batteryInspector.getByRole("region", { name: "Battery state and reserve" }).screenshot({ path: "test-results/canonical-battery-state-charging.png" });
  await result.getByRole("button", { name: /First discharge/ }).click();
  await expect(result.getByLabel("Selected interval power facts")).toContainText("Battery · discharging");
  await expect(batteryInspector.locator(".canonical-dispatch-state")).toContainText("Discharging");
  await batteryInspector.getByRole("region", { name: "Battery state and reserve" }).screenshot({ path: "test-results/canonical-battery-state-discharging.png" });
  await expect(result.locator(".battery-dispatch-interval")).toHaveCount(2);
  await expect(result.getByText("Battery idle throughout this plan", { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 1600, height: 1500 });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    for (const panel of await panels.all()) {
      const box = (await panel.boundingBox())!, svg = (await panel.locator("svg.recharts-surface").boundingBox())!;
      expect(svg.y + svg.height).toBeLessThanOrEqual(box.y + box.height + 1);
      for (const tick of await panel.locator(".recharts-cartesian-axis-tick-value").all()) {
        const label = (await tick.boundingBox())!;
        expect(label.y + label.height).toBeLessThanOrEqual(box.y + box.height);
      }
    }
    const contrast = await result.locator(".power-timeline--modelled").evaluate(root => {
      const panel = root.querySelector(".power-timeline-panel")!;
      const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d")!;
      canvas.width = canvas.height = 1;
      const ancestors: Element[] = [];
      for (let node: Element | null = panel; node; node = node.parentElement) ancestors.unshift(node);
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1, 1);
      for (const node of ancestors) { ctx.fillStyle = getComputedStyle(node).backgroundColor; ctx.fillRect(0, 0, 1, 1); }
      const luminance = (rgb: Uint8ClampedArray) => [0.2126, 0.7152, 0.0722].reduce((sum, weight, i) => {
        const c = rgb[i] / 255; return sum + weight * (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
      }, 0);
      const background = luminance(ctx.getImageData(0, 0, 1, 1).data);
      return Object.fromEntries(["demand", "response", "battery", "soc", "target", "limit", "muted"].map(tone => {
        ctx.fillStyle = getComputedStyle(root).getPropertyValue(`--ops-${tone}`).trim(); ctx.fillRect(0, 0, 1, 1);
        const foreground = luminance(ctx.getImageData(0, 0, 1, 1).data);
        return [tone, (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05)];
      }));
    });
    for (const [tone, ratio] of Object.entries(contrast)) expect(ratio, `${theme} ${tone} contrast`).toBeGreaterThanOrEqual(tone === "muted" ? 4.5 : 3);
    await test.info().attach(`battery-chart-contrast-${theme}`, { body: JSON.stringify(contrast), contentType: "application/json" });
    await result.locator(".power-timeline--modelled").screenshot({ path: `test-results/canonical-battery-charts-${theme}.png` });
  }
  await page.setViewportSize({ width: 390, height: 1500 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await result.locator(".power-timeline--modelled").screenshot({ path: "test-results/canonical-battery-charts-mobile.png" });
  await launcher.click();
  await copilot.getByRole("button", { name: "Conversation", exact: true }).click();
  await questionInput.fill("Test an alternative");
  await chat.getByRole("button", { name: "Ask", exact: true }).click();
  const finalAlternative = chat.getByRole("region", { name: "Alternative plan review" });
  await expect(finalAlternative).toBeVisible();
  await finalAlternative.getByRole("spinbutton").fill("40");
  await finalAlternative.getByRole("checkbox", { name: "Confirm this separate calculation" }).check();
  const baselineIdentity = await result.getAttribute("data-assessment-id");
  const beforeAlternative = submissions;
  await finalAlternative.getByRole("button", { name: "Calculate alternative", exact: true }).click();
  await expect(finalAlternative.getByRole("heading", { name: "Accepted model comparison" })).toBeVisible();
  expect(submissions).toBe(beforeAlternative + 1);
  await expect(finalAlternative.getByRole("button", { name: "Calculate alternative", exact: true })).toHaveCount(0);
  await expect(result).toHaveAttribute("data-assessment-id", baselineIdentity!);
  await finalAlternative.screenshot({ path: "test-results/copilot-confirmed-alternative.png" });

});


test("offline evidence review explains invalid files and supports clearing and same-file reload on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/operations?view=power");
  await openEvidenceInputs(page);
  const review = page.getByRole("region", { name: "Offline evidence review", exact: true });
  const input = review.getByLabel("Offline quality report JSON");
  await input.setInputFiles({ name: "wrong.json", mimeType: "application/json", buffer: Buffer.from('{"schema_version":"unknown"}') });
  await expect(review.getByRole("alert")).toContainText("Choose a GridPulse quality review JSON");
  const report = { schema_version: "gridpulse-component-intake-review-v1", dataset_id: "synthetic-" + "a".repeat(160), capture_sha256: "a".repeat(64), quality_accepted: false, blockers: ["missing_interval"], calibrated: false, activated: false, automatic_live_dispatch_authorized: false };
  const file = { name: "review.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(report)) };
  await input.setInputFiles(file);
  await expect(review.getByRole("status")).toContainText("Review the failed checks");
  await expect(review).toContainText("missing interval");
  await review.getByRole("button", { name: "Clear report", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await input.setInputFiles(file);
  await expect(review.getByRole("status")).toContainText("Local report loaded.");
  await expect(review.getByRole("alert")).toHaveCount(0);
  await review.getByText("Capture identity", { exact: true }).click();
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect((await new AxeBuilder({ page }).include(".ops-offline-review").analyze()).violations).toEqual([]);
    await review.screenshot({ path: `test-results/offline-review-mobile-${theme}.png` });
  }
});
