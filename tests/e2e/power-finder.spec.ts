import { expect, test } from "@playwright/test";

test("Power Finder and its accepted OSM release are publicly readable without creating capacity claims", async ({
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
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const fullProductNotice = page.getByText("Evidence status controls every conclusion");
  if (await fullProductNotice.count()) {
    await expect(fullProductNotice).toBeVisible();
    await expect(page.getByText(/not a network study, connection offer/i)).toBeVisible();
  } else {
    await expect(
      page
        .getByText("Capacity and connection terms require operator confirmation.", { exact: true })
        .first(),
    ).toBeVisible();
  }
});
