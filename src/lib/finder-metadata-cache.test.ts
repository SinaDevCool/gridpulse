import { afterEach, expect, it, vi } from "vitest";
import { cachedFinderMetadata } from "./finder-metadata-cache";
const host = "ep-patient-breeze-bhm3qx7z-pooler.c-10.eu-central-1.aws.neon.tech";
const env = {
  PUBLIC_FINDER_PROVIDER: "neon",
  NEON_FINDER_HOST: host,
  FINDER_DATA_RELEASE: "finder-public-20261121-v1",
  NEON_DATABASE_URL: `postgresql://gridpulse_finder_reader:fixture@${host}/gridpulse?sslmode=require`,
};
afterEach(() => vi.unstubAllGlobals());
it("reuses only successful public snapshot metadata and preserves its payload", async () => {
  const entries = new Map<string, Response>();
  vi.stubGlobal("caches", {
    default: {
      match: async (r: Request) => entries.get(r.url)?.clone(),
      put: async (r: Request, v: Response) => {
        entries.set(r.url, v);
      },
    },
  });
  const read = vi.fn(async () => Response.json([{ name: "public operator" }]));
  const url = new URL("https://example.com/api/power-finder/viewport?operators=true");
  const first = await cachedFinderMetadata(url, env, "operators", read);
  const second = await cachedFinderMetadata(url, env, "operators", read);
  expect(await first.json()).toEqual(await second.json());
  expect(second.headers.get("x-gridpulse-cache")).toBe("HIT");
  expect(read).toHaveBeenCalledTimes(1);
  const unavailable = vi.fn(async () => Response.json({ error: "unavailable" }, { status: 503 }));
  await cachedFinderMetadata(url, env, "coverage", unavailable);
  await cachedFinderMetadata(url, env, "coverage", unavailable);
  expect(unavailable).toHaveBeenCalledTimes(2);
});
it("does not use cached data to hide invalid configuration", async () => {
  const match = vi.fn();
  vi.stubGlobal("caches", { default: { match } });
  const read = vi.fn(async () => Response.json({ error: "unavailable" }, { status: 503 }));
  expect(
    (
      await cachedFinderMetadata(
        new URL("https://example.com"),
        { ...env, NEON_DATABASE_URL: undefined },
        "operators",
        read,
      )
    ).status,
  ).toBe(503);
  expect(match).not.toHaveBeenCalled();
});
