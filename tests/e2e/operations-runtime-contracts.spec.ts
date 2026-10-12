import { expect, test } from "@playwright/test";
import { buildOperationsScenario } from "../../src/features/operations/scenario-engine";

test("Workers runtime calculates and identifies an overview assessment", async ({ request }) => {
  const response = await request.post("/api/operations/assess", {
    data: { kind: "overview", scenario: buildOperationsScenario().scenario },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.automaticDispatchAuthorized).toBe(false);
  expect(body.inputFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(body.result.intervals).toHaveLength(96);
  expect(body.result.recommendation.peakReductionMw).toBe(8.6);
});
test("Workers runtime rejects invalid calculations without dispatch", async ({ request }) => {
  const response = await request.post("/api/operations/assess", {
    data: { kind: "overview", scenario: { importLimitMw: -1 } },
  });
  expect(response.status()).toBe(400);
});
test("Workers runtime persistence requires authentication", async ({ request }) => {
  const response = await request.post("/api/operations/runs", { data: {} });
  expect(response.status()).toBe(401);
});
