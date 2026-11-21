import { afterEach, describe, expect, it, vi } from "vitest";
import {
  handlePublicPowerFinderRequest,
  handlePublicPowerFinderTileRequest,
  parsePublicViewportRequest,
} from "./public-power-finder-api";

const viewportUrl =
  "https://gridpulseinsights.com/api/power-finder/viewport?west=12.9&south=52.1&east=13.8&north=52.7";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("public Power Finder API", () => {
  it("reads governed coverage without substituting viewport or static fallback evidence", async () => {
    const payload = { coverage_status: "partial", releases: [{ release_id: "release-1", scope: "DE-BB" }] };
    const origin = vi.fn().mockResolvedValueOnce(Response.json(payload))
      .mockResolvedValueOnce(Response.json({ releases: [] }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", origin);
    const request = () => new Request("https://gridpulseinsights.com/api/power-finder/viewport?coverage=true");
    const env = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" };
    const accepted = await handlePublicPowerFinderRequest(request(), env);
    expect(accepted?.status).toBe(200);
    expect(accepted?.headers.get("cache-control")).toContain("s-maxage=300");
    await expect(accepted?.json()).resolves.toEqual(payload);
    for (let index = 0; index < 2; index++) {
      const unavailable = await handlePublicPowerFinderRequest(request(), env);
      expect(unavailable?.status).toBe(503);
      await expect(unavailable?.json()).resolves.toEqual({ coverage_status: "unavailable", releases: [] });
    }
    expect(origin.mock.calls.every(([url]) => String(url).endsWith("/power_finder_public_coverage"))).toBe(true);
  });

  it("isolates limiter clients without retaining raw addresses in their keys", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    for (const address of ["192.0.2.1", "192.0.2.2"]) {
      await handlePublicPowerFinderRequest(new Request(viewportUrl, { headers: { "cf-connecting-ip": address } }), {
        PUBLIC_FINDER_RATE_LIMITER: { limit },
      });
    }
    const keys = limit.mock.calls.map(([input]) => input.key);
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys.every((key) => !key.includes("192.0.2."))).toBe(true);
  });

  it("accepts bounded viewports across Germany", () => {
    expect(parsePublicViewportRequest(new URL(viewportUrl))).toMatchObject({
      west: 12.9,
      includeGeneration: true,
      includeStorage: true,
    });
    expect(
      parsePublicViewportRequest(
        new URL(
          "https://gridpulseinsights.com/api/power-finder/viewport?west=11.3&south=48.0&east=12.0&north=48.5",
        ),
      ),
    ).toMatchObject({ west: 11.3, south: 48 });
    expect(() =>
      parsePublicViewportRequest(
        new URL(
          "https://gridpulseinsights.com/api/power-finder/viewport?west=-20&south=0&east=20&north=60",
        ),
      ),
    ).toThrow(/outside Germany or exceeds the safe query area/);
  });

  it("rejects unsupported methods and invalid parameters without contacting the database", async () => {
    const origin = vi.fn();
    vi.stubGlobal("fetch", origin);
    const methodResponse = await handlePublicPowerFinderRequest(
      new Request(viewportUrl, { method: "POST" }),
      {},
    );
    const invalidResponse = await handlePublicPowerFinderRequest(
      new Request(
        "https://gridpulseinsights.com/api/power-finder/viewport?west=x&south=52&east=13&north=53",
      ),
      {},
    );
    expect(methodResponse?.status).toBe(405);
    expect(invalidResponse?.status).toBe(400);
    expect(origin).not.toHaveBeenCalled();
  });

  it("calls only the allowlisted RPC with clamped feature limits", async () => {
    const origin = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "FeatureCollection",
          metadata: { record_count: 0 },
          features: [],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", origin);
    const response = await handlePublicPowerFinderRequest(new Request(viewportUrl), {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    expect(response?.status).toBe(200);
    expect(origin).toHaveBeenCalledOnce();
    const [url, options] = origin.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/power_finder_public_viewport");
    expect(JSON.parse(String(options.body))).toMatchObject({
      max_features: 2500,
      include_generation: true,
      include_storage: true,
    });
    expect(options.headers).not.toHaveProperty("service_role");
    expect(response?.headers.get("cache-control")).toContain("s-maxage=300");
    await expect(response?.json()).resolves.toMatchObject({
      metadata: { coverage_status: "unavailable" },
    });
  });

  it("uses the bounded node-only RPC for candidate ranking", async () => {
    const origin = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "FeatureCollection",
          metadata: { record_count: 1 },
          features: [],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", origin);
    const response = await handlePublicPowerFinderRequest(
      new Request(`${viewportUrl}&generation=false&storage=false&ranking=true`),
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      },
    );
    expect(response?.status).toBe(200);
    const [url, options] = origin.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/power_finder_public_candidate_nodes");
    expect(JSON.parse(String(options.body))).toEqual({
      west: 12.9,
      south: 52.1,
      east: 13.8,
      north: 52.7,
      max_features: 1000,
    });
  });

  it("serves the accepted static artifact when the public origin is unavailable", async () => {
    const origin = vi.fn().mockResolvedValue(new Response("denied", { status: 403 }));
    const assets = {
      fetch: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "FeatureCollection",
            metadata: { evidence_boundary: "Open mapping for early screening only." },
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [13.2, 52.3] },
                properties: { kind: "node" },
              },
              {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [13.2, 52.3],
                    [13.4, 52.4],
                  ],
                },
                properties: { kind: "line" },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    };
    vi.stubGlobal("fetch", origin);
    const response = await handlePublicPowerFinderRequest(new Request(viewportUrl), {
      ASSETS: assets,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    expect(response?.status).toBe(200);
    expect(assets.fetch).toHaveBeenCalledOnce();
    expect(response?.headers.get("x-gridpulse-data-mode")).toBe("accepted-static-fallback");
    await expect(response?.json()).resolves.toMatchObject({
      metadata: {
        available_kinds: ["node", "line"],
        coverage_status: "accepted_static_fallback",
      },
    });
  });

  it("retries one transient public-origin failure", async () => {
    const origin = vi
      .fn()
      .mockResolvedValueOnce(new Response("temporary", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            type: "FeatureCollection",
            metadata: { record_count: 1 },
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [13.2, 52.3] },
                properties: { kind: "node" },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", origin);

    const response = await handlePublicPowerFinderRequest(new Request(viewportUrl), {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });

    expect(response?.status).toBe(200);
    expect(origin).toHaveBeenCalledTimes(2);
  });

  it("enforces the optional edge rate limiter before the database call", async () => {
    const origin = vi.fn();
    vi.stubGlobal("fetch", origin);
    const response = await handlePublicPowerFinderRequest(new Request(viewportUrl), {
      PUBLIC_FINDER_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: false }) },
    });
    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBe("60");
    expect(origin).not.toHaveBeenCalled();
  });

  it("serves a warmed vector tile without contacting the database", async () => {
    const origin = vi.fn();
    const cachedTile = new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "application/vnd.mapbox-vector-tile" },
    });
    vi.stubGlobal("fetch", origin);
    vi.stubGlobal("caches", {
      default: { match: vi.fn().mockResolvedValue(cachedTile), put: vi.fn() },
    });
    const response = await handlePublicPowerFinderTileRequest(
      new Request("https://gridpulseinsights.com/api/power-finder/tile/8/137/84"),
      { SUPABASE_URL: "https://example.supabase.co", SUPABASE_PUBLISHABLE_KEY: "test" },
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get("x-gridpulse-cache")).toBe("HIT");
    expect(origin).not.toHaveBeenCalled();
  });
});
