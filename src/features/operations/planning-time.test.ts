import { describe, expect, it } from "vitest";
import { intervalDurationsHours, planningTimeSchema, scenarioPlanningTime } from "./planning-time";
import { buildOperationsScenario } from "./scenario-engine";

describe("planning time boundaries", () => {
  const points = [{ timestamp: "2026-10-01T00:00:00Z" }, { timestamp: "2026-10-01T00:15:00Z" }];
  const time = () => scenarioPlanningTime(points, "2026-10-01T00:00:00Z");
  it("publishes one server calculation horizon without a display range", () => {
    const model = buildOperationsScenario();
    expect(model.planningTime?.intervals).toHaveLength(96);
    expect(model.planningTime?.calculation.end).toBe("2026-09-27T00:00:00.000Z");
    expect(model.planningTime).not.toHaveProperty("displayWindow");
  });
  it("requires forecast provenance for forward planning", () => {
    expect(planningTimeSchema.safeParse({ ...time(), purpose: "rolling" }).success).toBe(false);
    expect(
      planningTimeSchema.safeParse({
        ...time(),
        purpose: "rolling",
        forecastIssuedAt: "2026-09-30T23:59:00Z",
        sourceFingerprint: "a".repeat(64),
      }).success,
    ).toBe(true);
  });
  it("rejects future forecast issues and decisions before cutoff", () => {
    expect(
      planningTimeSchema.safeParse({ ...time(), forecastIssuedAt: "2026-10-01T00:01:00Z" }).success,
    ).toBe(false);
    expect(
      planningTimeSchema.safeParse({
        ...time(),
        purpose: "event",
        assessedAt: "2026-10-01T00:01:00Z",
        forecastIssuedAt: "2026-10-01T00:00:00Z",
        sourceFingerprint: "b".repeat(64),
      }).success,
    ).toBe(false);
  });
  it("rejects reversed, gapped or incomplete coverage and invalid timezone", () => {
    for (const changed of [
      { timezone: "not/a-zone" },
      { decision: { start: points[1].timestamp, end: points[0].timestamp } },
      { intervals: [time().intervals[0]] },
      {
        intervals: [
          time().intervals[0],
          { start: "2026-10-01T00:20:00Z", end: "2026-10-01T00:30:00Z" },
        ],
      },
    ])
      expect(planningTimeSchema.safeParse({ ...time(), ...changed }).success).toBe(false);
  });
  it("uses elapsed UTC across the German repeated hour", () => {
    expect(
      intervalDurationsHours([
        { timestamp: "2026-10-25T02:45:00+02:00" },
        { timestamp: "2026-10-25T02:00:00+01:00" },
      ]),
    ).toEqual([0.25, 0.25]);
  });
  it.each([92, 96, 100])(
    "retains all %i quarter-hours rather than forcing a 96-slot day",
    (count) => {
      const samples = Array.from({ length: count }, (_, i) => ({
        timestamp: new Date(Date.parse(points[0].timestamp) + i * 900_000).toISOString(),
      }));
      expect(scenarioPlanningTime(samples, points[0].timestamp).intervals).toHaveLength(count);
    },
  );
  it("rejects ambiguous or duplicate instants and invalid durations", () => {
    expect(() => intervalDurationsHours([points[0], points[0]])).toThrow();
    expect(() => intervalDurationsHours([{ timestamp: "bad" }])).toThrow();
    expect(() => intervalDurationsHours(points, 0)).toThrow();
  });
});
