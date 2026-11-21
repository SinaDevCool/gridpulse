import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  finderCachePartition,
  finderProviderAllowed,
  neonFinderConfigured,
  neonPublicRpc,
} from "./neon-finder-public";
import { handlePublicPowerFinderRequest } from "./public-power-finder-api";

const query = vi.hoisted(() => vi.fn());
vi.mock("@neondatabase/serverless", () => ({ neon: () => ({ query }) }));
const host = "ep-patient-breeze-bhm3qx7z-pooler.c-10.eu-central-1.aws.neon.tech";
const env = {
  PUBLIC_FINDER_PROVIDER: "neon",
  NEON_FINDER_HOST: host,
  FINDER_DATA_RELEASE: "finder-public-20261121-v1",
  NEON_DATABASE_URL: `postgresql://gridpulse_finder_reader:fixture@${host}/gridpulse?sslmode=require`,
};
beforeEach(() => query.mockReset());
describe("qualified staging public projection", () => {
  it("rejects owner credentials, mixed targets, unknown providers and missing TLS", () => {
    expect(neonFinderConfigured(env)).toBe(true);
    for (const change of [
      {
        NEON_DATABASE_URL: env.NEON_DATABASE_URL.replace(
          "gridpulse_finder_reader",
          "gridpulse_owner",
        ),
      },
      { NEON_FINDER_HOST: "other.neon.tech" },
      { FINDER_DATA_RELEASE: "other" },
      { NEON_DATABASE_URL: env.NEON_DATABASE_URL.replace("?sslmode=require", "") },
      { NEON_DATABASE_URL: "" },
      { PUBLIC_FINDER_PROVIDER: "unknown" },
    ])
      expect(neonFinderConfigured({ ...env, ...change })).toBe(false);
    expect(finderProviderAllowed({ PUBLIC_FINDER_PROVIDER: "unknown" })).toBe(false);
    expect(finderProviderAllowed({})).toBe(true);
    expect(finderCachePartition(env)).not.toBe(finderCachePartition({}));
  });
  it("binds untrusted node values as parameters and guards the active release", async () => {
    query.mockResolvedValue([{ payload: { node_study: { available: false } } }]);
    const node = "value'); select secrets; --";
    await neonPublicRpc(env, "study", [node]);
    const [sql, parameters] = query.mock.calls[0];
    expect(sql).not.toContain(node);
    expect(sql).toContain("active_snapshot");
    expect(parameters).toEqual([node, env.FINDER_DATA_RELEASE]);
  });
  it("does not serve an absent or mismatched active projection", async () => {
    query.mockResolvedValue([]);
    await expect(neonPublicRpc(env, "coverage")).rejects.toThrow("unavailable");
  });
  it("preserves the existing bytea transport for vector tiles", async () => {
    query.mockResolvedValue([{ payload: "1a02" }]);
    expect(await (await neonPublicRpc(env, "tile", [9, 275, 168, false, true, true])).json()).toBe(
      "\\x1a02",
    );
  });
  it("fails closed before any database call when the staging credential is absent", async () => {
    const result = await handlePublicPowerFinderRequest(
      new Request(
        "https://example.com/api/power-finder/viewport?west=13&south=52&east=14&north=53",
      ),
      { ...env, NEON_DATABASE_URL: undefined },
    );
    expect(result?.status).toBe(503);
    expect(query).not.toHaveBeenCalled();
  });
});
