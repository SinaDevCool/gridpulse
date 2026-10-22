import { test, expect } from "@playwright/test";

test("compiled Worker enforces independent solution availability for pages and APIs", async ({
  request,
}) => {
  const enabled = process.env.GRIDPULSE_SOLUTIONS ?? "all";
  const planning = enabled === "all" || enabled.split(",").includes("planning");
  const operations = enabled === "all" || enabled.split(",").includes("operations");
  expect((await request.get("/")).status()).toBe(200);
  for (const [path, available] of [
    ["/power-finder", planning],
    ["/portfolio", planning],
    ["/solutions/site-selection", planning],
    ["/operations?view=compute", operations],
    ["/solutions/facility-operations", operations],
  ] as const)
    expect((await request.get(path)).status(), path).toBe(available ? 200 : 404);
  const assessment = await request.post("/api/operations/assess", { data: {} });
  expect(assessment.status()).toBe(operations ? 400 : 404);
  const privateRecords = await request.post("/api/operations/runs", { data: {} });
  expect(privateRecords.status()).toBe(operations ? 401 : 404);
  const finder = await request.get("/api/power-finder/viewport");
  if (!planning) expect(finder.status()).toBe(404);
  const entry = await request.get(operations ? "/operations" : "/power-finder");
  expect(entry.headers()["x-gridpulse-solution"]).toBe(operations ? "operations" : "planning");
  const html = await entry.text();
  if (!planning) expect(html).not.toContain('href="/power-finder"');
  if (!operations) expect(html).not.toContain('href="/operations"');
});
