import { expect, test } from "@playwright/test";

test("Power Finder remains private while its accepted OSM release is publicly readable", async ({
  page,
  request,
}) => {
  const response = await request.get("/power-finder/brandenburg-osm.json");
  expect(response.ok()).toBeTruthy();

  const fixture = await response.json();
  expect(fixture.metadata.evidence_boundary).toContain("Open mapping");
  expect(fixture.metadata.record_count).toBe(668);
  expect(
    fixture.features.every(
      (feature: { properties: { evidence_class?: string } }) =>
        feature.properties.evidence_class === "open_mapping",
    ),
  ).toBeTruthy();

  await page.goto("/power-finder");
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign In to Continue" })).toHaveAttribute(
    "href",
    /auth\?redirect=.*power-finder/,
  );
});
