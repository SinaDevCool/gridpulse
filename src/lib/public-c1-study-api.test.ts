import { afterEach, describe, expect, it, vi } from "vitest";
import { handlePublicC1StudyRequest } from "./public-c1-study-api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("public C1 study API", () => {
  it("rejects malformed node identifiers before origin access", async () => {
    const origin = vi.fn();
    vi.stubGlobal("fetch", origin);
    const result = await handlePublicC1StudyRequest(
      new Request("https://gridpulseinsights.com/api/power-finder/study?node=%3Cscript%3E"),
      {},
    );
    expect(result?.status).toBe(400);
    expect(origin).not.toHaveBeenCalled();
  });

  it("uses only the field-limited public RPC", async () => {
    const origin = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            node_study: { available: false },
            benchmark_validation: { available: true },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ node_envelope: { available: false } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ available: false }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ available: true, representation: "benchmark_only" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", origin);
    const result = await handlePublicC1StudyRequest(
      new Request("https://gridpulseinsights.com/api/power-finder/study?node=osm-node-1"),
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      },
    );
    expect(result?.status).toBe(200);
    const [url, options] = origin.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/power_finder_public_c1_study");
    expect(JSON.parse(String(options.body))).toEqual({ node_record_id: "osm-node-1" });
    expect(options.headers).not.toHaveProperty("service_role");
    expect(origin.mock.calls[1][0]).toBe(
      "https://example.supabase.co/rest/v1/rpc/power_finder_public_c2_envelope",
    );
    expect(origin.mock.calls[2][0]).toBe(
      "https://example.supabase.co/rest/v1/rpc/power_finder_public_c3_assessment",
    );
    expect(JSON.parse(String(origin.mock.calls[3][1].body))).toEqual({ p_node_record_id: null });
  });
});
