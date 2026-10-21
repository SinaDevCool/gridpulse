import { expect, type Page } from "@playwright/test";
export async function openComputeQueue(page: Page) {
  await expect(page.getByRole("button", { name: /^(Show|Hide) panel/ })).toBeEnabled();
  const queue = page.locator(".compute-queue-disclosure");
  if ((await queue.getAttribute("open")) === null) await queue.locator("summary").click();
}
export async function openEvidenceInputs(page: Page) {
  const trigger = page.getByRole("button", { name: /^(Show|Hide) panel/ });
  await expect(trigger).toBeEnabled();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  const section = page.locator(".ops-evidence-section");
  if ((await section.getAttribute("open")) === null) await section.locator("summary").click();
}

export async function openScenarioInputs(page: Page) {
  const trigger = page.getByRole("button", { name: /^(Show|Hide) panel/ });
  await expect(trigger).toBeEnabled();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  const panel = page.locator("#operations-inputs");
  await expect(panel).toBeVisible();
  for (const details of await panel.locator("form details").all()) {
    if ((await details.getAttribute("open")) === null)
      await details.locator(":scope > summary").click();
  }
  return panel;
}
