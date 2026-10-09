import { describe, expect, it, vi } from "vitest";
import { handlePublicGridStressRequest } from "./public-grid-stress-api";

describe("public grid-stress API", () => {
  it("rejects malformed regions", async () => {
    const result = await handlePublicGridStressRequest(new Request("https://gridpulseinsights.com/api/forecasts/grid-stress/current?region=<script>"), {});
    expect(result?.status).toBe(400);
  });

  it("fails closed when no forecast store exists", async () => {
    const result = await handlePublicGridStressRequest(new Request("https://gridpulseinsights.com/api/forecasts/grid-stress/current?region=DE"), {});
    expect(result?.status).toBe(200);
    expect(await result?.json()).toMatchObject({ status: "unavailable", confidence: "unavailable" });
  });

  it("returns an accepted published RPC payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify([{ payload: { schemaVersion: "gridpulse-grid-stress-public-v1", status: "available", regionCode: "DE" } }]), { status: 200 }));
    const result = await handlePublicGridStressRequest(new Request("https://gridpulseinsights.com/api/forecasts/grid-stress/current"), { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-key" });
    expect(await result?.json()).toMatchObject({ status: "available", regionCode: "DE" });
    expect(fetchMock).toHaveBeenCalledOnce();
    fetchMock.mockRestore();
  });
});
