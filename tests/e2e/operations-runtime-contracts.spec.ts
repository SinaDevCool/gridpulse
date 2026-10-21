import { expect, test } from "@playwright/test";
import { buildOperationsScenario } from "../../src/features/operations/scenario-engine";
import { OPERATIONS_CALCULATION_VERSION } from "../../src/features/operations/calculation-version";

test("Workers runtime calculates and identifies an overview assessment", async ({ request }) => {
  const response = await request.post("/api/operations/assess", {
    data: { kind: "overview", scenario: buildOperationsScenario().scenario },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.automaticDispatchAuthorized).toBe(false);
  expect(body.inputFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(body.result.intervals).toHaveLength(96);
  expect(body.result.planningTime.schemaVersion).toBe("gridpulse-planning-time-v1");
  expect(body.result.planningTime.calculation.end).toBe("2026-09-27T00:00:00.000Z");
  expect(body.result.planningTime.terminalPolicy).toBe("report_unfinished");
  expect(body.result.planningTime.forecastIssuedAt).toBeNull();
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

test("stateless assessments repeat numerically and react to battery availability without database access", async ({
  request,
}) => {
  const scenario = buildOperationsScenario().scenario;
  const bodies = [];
  for (const inverterAvailable of [true, true, false]) {
    const response = await request.post("/api/operations/assess", {
      data: {
        kind: "overview",
        scenario: { ...scenario, battery: { ...scenario.battery, inverterAvailable } },
      },
    });
    expect(response.status()).toBe(200);
    bodies.push(await response.json());
  }
  expect(bodies[0].calculationVersion).toBe(OPERATIONS_CALCULATION_VERSION);
  expect(bodies[0].inputFingerprint).toBe(bodies[1].inputFingerprint);
  expect(bodies[0].result.intervals).toEqual(bodies[1].result.intervals);
  expect(bodies[0].result.summaries).toEqual(bodies[1].result.summaries);
  expect(bodies[2].inputFingerprint).not.toBe(bodies[0].inputFingerprint);
  expect(
    bodies[2].result.intervals.every((p: { batteryPowerMw: number }) => p.batteryPowerMw === 0),
  ).toBe(true);
  expect(bodies.every((body) => body.automaticDispatchAuthorized === false)).toBe(true);
});

test("assessment API rejects invalid battery SOC and efficiency before calculation", async ({
  request,
}) => {
  const scenario = buildOperationsScenario().scenario;
  for (const change of [{ dischargeEfficiency: 0 }, { minimumSocPercent: 99 }]) {
    const response = await request.post("/api/operations/assess", {
      data: {
        kind: "overview",
        scenario: { ...scenario, battery: { ...scenario.battery, ...change } },
      },
    });
    expect(response.status()).toBe(400);
    expect(
      (await response.json()).fields.some((field: string) => field.startsWith("scenario.battery.")),
    ).toBe(true);
  }
});
