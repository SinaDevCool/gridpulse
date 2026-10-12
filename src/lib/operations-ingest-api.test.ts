import { afterEach, describe, expect, it, vi } from "vitest";
import { handleOperationsIngest } from "./operations-ingest-api";
afterEach(() => vi.restoreAllMocks());
const env = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service" };
const batch = {
  facilityId: "11111111-1111-4111-8111-111111111111",
  sourceId: "22222222-2222-4222-8222-222222222222",
  batchId: "33333333-3333-4333-8333-333333333333",
  connectorVersion: "test-v1",
  measurements: [
    {
      metricKey: "facility_grid_import_mw",
      value: 92,
      unit: "MW",
      eventAt: "2026-10-10T08:00:00.000Z",
      sourceRecordId: "one",
    },
  ],
};
const request = (body: unknown) =>
  new Request("https://test/api/operations/ingest", {
    method: "POST",
    headers: { "x-operations-token": "a".repeat(64), "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("operations ingestion API", () => {
  it("uses one transactional scoped RPC and reports actual insert and duplicate counts", async () => {
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json({ inserted: 0, duplicates: 1, latestEventAt: "2026-10-10T08:00:00.000Z" }),
      );
    const result = await handleOperationsIngest(request(batch), env);
    expect(result.status).toBe(202);
    expect(await result.json()).toMatchObject({
      accepted: 0,
      duplicates: 1,
      controlMode: "read_only",
    });
    expect(mock).toHaveBeenCalledTimes(1);
    expect(String(mock.mock.calls[0][0])).toContain("rpc/operations_ingest_connector_batch");
    const sent = JSON.parse(String(mock.mock.calls[0][1]?.body));
    expect(sent.p_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(sent).not.toHaveProperty("token");
  });
  it("fails closed on a credential scope mismatch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ code: "42501" }, { status: 400 }),
    );
    expect((await handleOperationsIngest(request(batch), env)).status).toBe(403);
  });
  it("does not report success for a store or network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    expect((await handleOperationsIngest(request(batch), env)).status).toBe(502);
  });
  it("rejects wrong count and temperature units before persistence", async () => {
    const mock = vi.spyOn(globalThis, "fetch");
    for (const metricKey of ["active_gpu_count", "waste_heat_temperature_c"])
      expect(
        (
          await handleOperationsIngest(
            request({
              ...batch,
              measurements: [{ ...batch.measurements[0], metricKey, unit: "MW" }],
            }),
            env,
          )
        ).status,
      ).toBe(400);
    expect(mock).not.toHaveBeenCalled();
  });
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
