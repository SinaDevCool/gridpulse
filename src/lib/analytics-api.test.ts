import { describe, expect, it } from "vitest";
import { safeAnalyticsError, type AnalyticsJob } from "./analytics-api";

const failed = {
  status: "failed", error: "Traceback: private topology payload", id: "1", owner_id: "2",
  job_type: "graph_guided_study", input_payload: {}, result_payload: null,
  created_at: "", started_at: null, completed_at: null, attempt_count: 1,
  lease_owner: null, lease_expires_at: null, heartbeat_at: null,
  checkpoint_payload: {}, cancellation_requested: false,
} satisfies AnalyticsJob;

describe("analytics job presentation", () => {
  it("never exposes a raw worker failure", () => {
    expect(safeAnalyticsError(failed)).not.toContain("Traceback");
  });
});
