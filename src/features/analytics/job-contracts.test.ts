import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyticsJobSchema, analyticsJobSummarySchema, jobAcceptedSchema } from "./job-contracts";

const fixture = JSON.parse(
  readFileSync(new URL("../../../tests/contracts/analytics-job.json", import.meta.url), "utf8"),
);
describe("shared Python and browser job contract", () => {
  it("accepts the full shared fixture and its deliberate summary projection", () => {
    expect(analyticsJobSchema.parse(fixture).status).toBe("queued");
    expect(analyticsJobSummarySchema.parse(fixture)).not.toHaveProperty("owner_id");
  });
  it("rejects malformed full records and unknown statuses", () => {
    expect(analyticsJobSchema.safeParse({ ...fixture, attempt_count: -1 }).success).toBe(false);
    expect(jobAcceptedSchema.safeParse({ job_id: fixture.id, status: "done" }).success).toBe(false);
  });
});
