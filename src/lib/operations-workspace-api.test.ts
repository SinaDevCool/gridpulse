import { afterEach, describe, expect, it, vi } from "vitest";
import { handleOperationsWorkspace } from "./operations-workspace-api";

const facilityId = "11111111-1111-4111-8111-111111111111";

afterEach(() => vi.restoreAllMocks());

describe("operations workspace API", () => {
  it("requires an authenticated facility owner", async () => {
    const result = await handleOperationsWorkspace(
      new Request(`https://gridpulse.test/api/operations/workspace?facilityId=${facilityId}`),
      { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public" },
    );
    expect(result.status).toBe(401);
  });

  it("rejects an invalid facility identifier before accessing persistence", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const result = await handleOperationsWorkspace(
      new Request("https://gridpulse.test/api/operations/workspace?facilityId=invalid", {
        headers: { authorization: "Bearer user-token" },
      }),
      { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public" },
    );
    expect(result.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a read-only RLS-backed workspace", async () => {
    const tables: Record<string, unknown[]> = {
      operations_facilities: [{
        id: facilityId, name: "Berlin AI Campus", timezone: "Europe/Berlin",
        contracted_import_limit_mw: 100, limit_evidence: "operator_confirmed",
        limit_valid_to: "2027-01-01T00:00:00.000Z",
      }],
      operations_sources: [{
        id: "22222222-2222-4222-8222-222222222222", source_type: "facility_meter",
        display_name: "Main meter", health: "healthy", read_only: true,
        last_received_at: "2026-10-06T08:00:00.000Z",
      }],
      operations_source_watermarks: [],
      operations_measurements: [{
        source_id: "22222222-2222-4222-8222-222222222222", metric_key: "facility_grid_import_mw",
        asset_id: "facility", event_at: "2026-10-06T08:00:00.000Z", value: 92, unit: "MW",
        value_kind: "observed", quality: "accepted",
      }],
      operations_battery_assets: [], operations_workloads: [], operations_forecasts: [],
      operations_recommendations: [], operations_verifications: [], operations_data_quality: [],
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      const table = url.pathname.split("/").at(-1)!;
      return Response.json(tables[table] ?? []);
    });
    const result = await handleOperationsWorkspace(
      new Request(`https://gridpulse.test/api/operations/workspace?facilityId=${facilityId}`, {
        headers: { authorization: "Bearer user-token" },
      }),
      { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public" },
    );
    expect(result.status).toBe(200);
    const body = await result.json() as Record<string, unknown>;
    expect(body.automaticDispatchAuthorized).toBe(false);
    expect(body.readiness).toMatchObject({ mode: "historical" });
    expect((body.sources as Array<Record<string, unknown>>)[0]).toMatchObject({
      type: "facility_meter", health: "healthy", readOnly: true,
    });
  });
});
