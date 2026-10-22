import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("single-interval peak inspection renders without invalid SVG geometry", async ({ page }) => {
  const invalid: string[] = [];
  page.on("console", (message) => {
    if (/NaN|not defined/.test(message.text())) invalid.push(message.text());
  });
  await page.goto("/operations?view=overview&window=now&mode=scenario");
  await expect(page.getByRole("button", { name: /^(Show|Hide) panel/ })).toBeEnabled({
    timeout: 20000,
  });
  await expect(page.getByRole("combobox", { name: "Inspect time", exact: true })).toBeVisible();
  await expect(page.locator(".recharts-brush")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next interval", exact: true })).toBeDisabled();
  expect(invalid).toEqual([]);
});

test("overview links chart, time navigation, envelope, range and table without recalculation", async ({
  page,
}) => {
  await page.goto("/operations?view=overview&window=today&mode=scenario");
  await expect(page.getByRole("button", { name: /^(Show|Hide) panel/ })).toBeEnabled({
    timeout: 20000,
  });
  const chart = page
    .locator(".operations-v2-chart-card")
    .filter({ hasText: "Compare power responses" });
  await expect(page.locator(".ops-service-status").first()).toContainText("available");
  let assessmentRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/operations/assess")) assessmentRequests++;
  });
  const before = await chart.locator(".operations-chart-summary").textContent();
  await chart
    .getByRole("combobox", { name: "Inspect time", exact: true })
    .selectOption({ index: 8 });
  await expect(chart.locator(".ops-response-breakdown")).toContainText("02:00 UTC");
  await chart.getByText("Inspect headroom", { exact: true }).click();
  await expect(chart.locator(".ops-headroom-detail")).toContainText("02:00 UTC");
  await chart.getByText("View Chart Data", { exact: true }).click();
  await chart.getByRole("button", { name: "03:00", exact: true }).click();
  await expect(chart.locator(".ops-response-breakdown")).toContainText("03:00 UTC");
  await expect(chart.locator('tr[aria-selected="true"]')).toContainText("03:00");
  const baseline = chart.getByRole("button", { name: /Baseline demand/ });
  await baseline.click();
  await expect(baseline).toHaveAttribute("aria-pressed", "false");
  expect(await chart.locator(".operations-chart-summary").textContent()).toBe(before);
  await chart.getByRole("button", { name: "Reset chart" }).click();
  await expect(baseline).toHaveAttribute("aria-pressed", "true");
  await chart.getByText("Set inspection range", { exact: true }).click();
  await chart.getByRole("combobox", { name: "Range start" }).selectOption("24");
  await chart.getByRole("combobox", { name: "Range end" }).selectOption("28");
  await expect(chart.locator(".operations-v2-chart-data tbody tr")).toHaveCount(5);
  await expect(chart.locator(".ops-response-breakdown")).toContainText("06:00 UTC");
  await chart.getByRole("button", { name: "Return to peak & reset range" }).click();
  await expect(chart.locator(".operations-v2-chart-data tbody tr")).toHaveCount(96);
  await expect(chart.locator(".ops-response-breakdown")).toContainText("08:00 UTC");
  const plot = chart.locator(".recharts-wrapper");
  const bounds = await plot.boundingBox();
  await plot.click({ position: { x: bounds!.width * 0.3, y: bounds!.height * 0.4 } });
  await expect(chart.locator(".ops-response-breakdown")).not.toContainText("08:00 UTC");
  expect(assessmentRequests).toBe(0);
});

test("overview inspection controls fit mobile and remain accessible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/operations?view=overview&window=today&mode=scenario");
  await expect(page.getByRole("button", { name: /^(Show|Hide) panel/ })).toBeEnabled({
    timeout: 20000,
  });
  await page.getByText("Set inspection range", { exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Range start" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const results = await new AxeBuilder({ page })
    .include(".operations-v2-chart-card")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("compute and battery legends toggle with keyboard and preserve interval facts", async ({
  page,
}) => {
  await page.goto("/operations?view=compute&window=today&mode=scenario");
  await expect(page.getByRole("button", { name: /^(Show|Hide) panel/ })).toBeEnabled({
    timeout: 20000,
  });
  const compute = page.locator(".compute-integrated-workspace");
  await compute.getByRole("button", { name: "Facility context", exact: true }).click();
  await compute.getByRole("button", { name: /Facility demand/ }).click();
  await expect(compute.getByRole("button", { name: /Facility demand/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await compute.locator('input[type="range"]').fill("40");
  await expect(compute.locator(".compute-time-inspector")).toContainText("10:00 UTC");
  await page.getByRole("link", { name: "Power & Battery" }).click();
  const inspector = page.getByRole("complementary", { name: "Selected battery interval" });
  await expect(inspector).toContainText("10:00 UTC");
  const facts = await inspector.textContent();
  const legend = page.getByRole("button", { name: /Battery dispatch.*discharge/ });
  await legend.focus();
  await page.keyboard.press("Enter");
  await expect(legend).toHaveAttribute("aria-pressed", "false");
  expect(await inspector.textContent()).toBe(facts);
});
