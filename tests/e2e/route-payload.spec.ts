import { expect, test } from "@playwright/test";

const routes = ["/pilot-ready", "/validation-case"] as const;

for (const route of routes) {
  test(`${route} keeps its initial HTML payload bounded`, async ({ request }) => {
    const response = await request.get(route);
    expect(response.ok()).toBe(true);

    const html = await response.text();
    expect(Buffer.byteLength(html, "utf8")).toBeLessThan(500_000);
    expect(html).not.toContain("data:application/json");
  });
}
