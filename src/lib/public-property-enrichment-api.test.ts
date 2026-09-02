import { afterEach, describe, expect, it, vi } from "vitest";
import {
  handlePublicPropertyEnrichment,
  parseEnrichmentRequest,
} from "./public-property-enrichment-api";

const property = { propertyId: "p1", latitude: 52.5, longitude: 13.4, boundary: null };
const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

function request(sources: string[]) {
  return new Request("https://gridpulse.test/api/properties/enrich", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ properties: [property], sources }),
  });
}

function upstream(source: string, status = "complete") {
  return new Response(
    JSON.stringify({
      releaseFingerprint: `release-${source}`,
      findings: [{ id: source, propertyId: "p1", source }],
      sourceStatus: { [source]: status },
      sourceResults: [],
    }),
  );
}

afterEach(() => vi.restoreAllMocks());

describe("public property enrichment request", () => {
  it("accepts a bounded anonymous batch", () => {
    expect(
      parseEnrichmentRequest({
        properties: [{ propertyId: "p1", latitude: 52.5, longitude: 13.4, boundary: null }],
        sources: ["bkg_admin"],
      }).properties,
    ).toHaveLength(1);
  });
  it("rejects unsupported sources and non-German coordinates", () => {
    expect(() =>
      parseEnrichmentRequest({ properties: [{ propertyId: "p1", latitude: 1, longitude: 1 }] }),
    ).toThrow(/coordinates/);
    expect(() =>
      parseEnrichmentRequest({
        properties: [{ propertyId: "p1", latitude: 52.5, longitude: 13.4 }],
        sources: ["unknown"],
      }),
    ).toThrow(/unsupported/);
  });
});

describe("public property enrichment isolation", () => {
  it("returns successful sources and uses publishable-key bearer auth", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(upstream("bkg_admin"));
    const response = await handlePublicPropertyEnrichment(request(["bkg_admin"]), env);
    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({ sourceStatus: { bkg_admin: "succeeded" } });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("authorization")).toBe(
      "Bearer sb_publishable_test",
    );
  });

  it("preserves a successful source when another source fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const source = JSON.parse(String(init?.body)).p_sources[0];
      return source === "bkg_admin" ? upstream(source) : new Response("bad", { status: 500 });
    });
    const response = await handlePublicPropertyEnrichment(
      request(["bkg_admin", "osm_context"]),
      env,
    );
    const body = await response?.json();
    expect(response?.status).toBe(200);
    expect(body.findings).toHaveLength(1);
    expect(body.sourceStatus).toEqual({ bkg_admin: "succeeded", osm_context: "failed" });
  });

  it("prefers per-property coverage over a stale aggregate source status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          findings: [],
          sourceStatus: { osm_context: "unavailable" },
          sourceResults: [
            {
              propertyId: "property-1",
              source: "osm_context",
              status: "complete",
              findingCount: 0,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const response = await handlePublicPropertyEnrichment(request(["osm_context"]), env);
    expect(await response?.json()).toMatchObject({
      sourceStatus: { osm_context: "succeeded" },
      sourceResults: [{ source: "osm_context", status: "succeeded" }],
    });
  });

  it("preserves property-specific coverage statuses from a successful source", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          releaseFingerprint: "release-bkg_admin",
          findings: [],
          sourceStatus: { bkg_admin: "complete" },
          sourceResults: [
            {
              propertyId: "p1",
              source: "bkg_admin",
              status: "not_covered",
              findingCount: 0,
              releaseId: null,
              checkedAt: "2026-08-12T00:00:00.000Z",
              limitation: "Outside the accepted release coverage.",
            },
          ],
        }),
      ),
    );
    const response = await handlePublicPropertyEnrichment(request(["bkg_admin"]), env);
    expect(await response?.json()).toMatchObject({
      sourceStatus: { bkg_admin: "succeeded" },
      sourceResults: [{ propertyId: "p1", status: "not_covered" }],
    });
  });

  it("returns a recoverable per-source result when every source fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 503 }));
    const response = await handlePublicPropertyEnrichment(request(["bkg_admin"]), env);
    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({
      findings: [],
      sourceStatus: { bkg_admin: "failed" },
    });
  });

  it("retries one transient source failure safely", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(upstream("bkg_admin"));
    const response = await handlePublicPropertyEnrichment(request(["bkg_admin"]), env);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await response?.json()).toMatchObject({ sourceStatus: { bkg_admin: "succeeded" } });
  });
});
