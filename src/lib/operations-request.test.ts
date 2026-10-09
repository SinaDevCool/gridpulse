import { describe, expect, it } from "vitest";
import { operationsFingerprint, readOperationsJson } from "./operations-request";

describe("bounded Operations requests", () => {
  it("limits actual bytes when Content-Length is absent", async () => {
    await expect(
      readOperationsJson(new Request("https://test", { method: "POST", body: "x".repeat(20) }), 10),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("rejects malformed JSON", async () => {
    await expect(
      readOperationsJson(new Request("https://test", { method: "POST", body: "{" }), 10),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("hashes key order consistently but preserves sequence and input changes", async () => {
    expect(await operationsFingerprint({ b: 2, a: { d: 4, c: 3 } })).toBe(
      await operationsFingerprint({ a: { c: 3, d: 4 }, b: 2 }),
    );
    expect(await operationsFingerprint([1, 2])).not.toBe(await operationsFingerprint([2, 1]));
  });
});
