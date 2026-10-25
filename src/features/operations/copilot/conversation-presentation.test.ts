import { describe, expect, it } from "vitest";
import { answerBlocks, answerFacts, contextLabel } from "./conversation-presentation";
import { factSchema } from "./contracts";
import { formatBriefFact } from "./brief";

const base = { id: "power.plan_peak", label: "Plan peak", unit: "MW", scope: "full_horizon",
  source: { selector: "canonicalImpact", field: "planPeakMw", view: "overview" } };

describe("copilot presentation over accepted facts", () => {
  it("never turns unavailable evidence into zero, preserving a genuine zero", () => {
    const absent = factSchema.parse({ ...base, availability: "unavailable", value: null });
    const zero = factSchema.parse({ ...base, id: "power.breach", availability: "available", value: 0 });
    expect(answerFacts([absent, zero])).toEqual([zero]);
    expect(formatBriefFact(absent)).toBe("Unavailable");
    expect(answerBlocks(["Plan peak: Unavailable.", `Plan peak: ${formatBriefFact(zero)}.`, "Important qualification."], [absent, zero]))
      .toEqual(["Plan peak: Unavailable.", "Important qualification."]);
  });
  it("uses UTC context across date boundaries and handles missing context", () => {
    expect(contextLabel({ view: "compute", timestamp: "2026-09-26T23:15:00-02:00", workloadId: null })).toContain("27 Sept, 01:15 UTC selected");
    expect(contextLabel({ view: "power", timestamp: null, workloadId: null })).toBe("Power & Battery · Whole plan");
  });
  it("formats timestamp facts without changing arbitrary strings or numeric precision", () => {
    const fact = factSchema.parse({ ...base, unit: "status", availability: "available", value: "2026-09-26T08:00:00.000Z" });
    expect(formatBriefFact(fact)).toContain("08:00 UTC");
    expect(fact.value).toBe("2026-09-26T08:00:00.000Z");
    expect(formatBriefFact({ ...fact, value: "No deadline supplied" })).toBe("No deadline supplied");
  });
});
