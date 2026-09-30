import { describe, expect, it } from "vitest";
import { handleOperationsIngest } from "./operations-ingest-api";

describe("operations ingestion API", () => {
  it("fails closed when connector secrets are not configured", async () => {
    const result = await handleOperationsIngest(
      new Request("https://gridpulse.test/api/operations/ingest", { method: "POST" }),
      {},
    );
    expect(result.status).toBe(503);
  });

  it("rejects an invalid connector credential before parsing evidence", async () => {
    const result = await handleOperationsIngest(
      new Request("https://gridpulse.test/api/operations/ingest", {
        method: "POST",
        headers: { "x-operations-token": "wrong", "content-type": "application/json" },
        body: "{}",
      }),
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service",
        OPERATIONS_INGEST_TOKEN: "correct",
      },
    );
    expect(result.status).toBe(401);
  });
});
