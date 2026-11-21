import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  finderCachePartition,
  finderProviderAllowed,
  neonFinderConfigured,
  neonPublicRpc,
  finderReleaseMatches,
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
  it("accepts production only with its own host, explicit environment and manifest", () => {
    const productionHost = "ep-restless-math-bgmiyiln-pooler.c-9.eu-central-1.aws.neon.tech";
    const production = {
      ...env,
      PUBLIC_FINDER_ENVIRONMENT: "production",
      NEON_FINDER_HOST: productionHost,
      NEON_DATABASE_URL: env.NEON_DATABASE_URL.replace(host, productionHost),
      FINDER_DATA_SHA256: "b11fd6fa698f3743b47c3e2bd516670e279368cf38c7be507c5b03da856098ed",
    };
    expect(neonFinderConfigured(production)).toBe(true);
    expect(neonFinderConfigured({ ...production, FINDER_DATA_SHA256: undefined })).toBe(false);
    expect(neonFinderConfigured({ ...production, NEON_FINDER_HOST: host })).toBe(false);
    expect(finderCachePartition(production)).not.toBe(finderCachePartition(env));
  });
  it("rejects stale release requests before database access", async () => {
    const url = new URL(
      "https://example.com/api/power-finder/viewport?coverage=true&release=obsolete",
    );
    expect(finderReleaseMatches(url, env)).toBe(false);
    const result = await handlePublicPowerFinderRequest(new Request(url), env);
    expect(result?.status).toBe(409);
    expect(query).not.toHaveBeenCalled();
  });
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
    expect(parameters).toEqual([
      node,
      env.FINDER_DATA_RELEASE,
      "b11fd6fa698f3743b47c3e2bd516670e279368cf38c7be507c5b03da856098ed",
    ]);
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
