import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("each solution introduces its own customer and standalone workflow", async ({ page }) => {
  for (const [path, heading, entry, destination] of [
    ["/solutions/site-selection", "Where should we develop?", "Open Power Finder", "/power-finder"],
    [
      "/solutions/facility-operations",
      "How should this facility operate within its power constraints?",
      "Explore Operations demo",
      "/operations",
    ],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(3);
    const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(report.violations).toEqual([]);
    await page.getByRole("link", { name: entry, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(destination));
  }
});

test("Operations loads without Finder records or eager map dependencies", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));
  await page.addInitScript(() => {
    localStorage.setItem("gridpulse-finder-active-project", "finder-project-sentinel");
  });
  await page.goto("/operations?view=compute&window=next-4h&mode=scenario");
  // This suite also qualifies the production optimiser build; compatibility builds
  // retain the scenario service label. Both must finish the availability check.
  const serviceStatus = page.locator(".ops-service-status");
  await expect(serviceStatus).toHaveText(
    /^(Calculation service available|Optimiser · on-demand service)$/,
  );
  await expect(serviceStatus).toHaveClass(/\bverified\b/);
  for (const view of ["Power & Battery", "Overview", "Compute & Workloads"]) {
    await page.getByRole("banner").getByRole("link", { name: view, exact: true }).click();
    await expect(page).toHaveURL(/window=next-4h/);
  }
  expect(await page.evaluate(() => localStorage.getItem("gridpulse-finder-active-project"))).toBe(
    "finder-project-sentinel",
  );
  expect(requested.filter((url) => /maplibre|\/api\/power-finder\//i.test(url))).toEqual([]);
});

test("public Operations availability never authorises private facility records", async ({
  request,
}) => {
  const response = await request.post("/api/operations/runs", { data: {} });
  expect(response.status()).toBe(401);
  // Invalid assessment POST status is tested against the compiled Worker, not Vite's proxy.
});
