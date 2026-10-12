import { describe, expect, it, vi } from "vitest";
import { SupabaseOperationsRepository, operationsPersistenceConfig } from "./repository";

describe("Operations repository access boundaries", () => {
  it("never uses the privileged credential for owner-scoped reads", async () => {
    const transport = vi.fn().mockResolvedValue(Response.json([]));
    const repository = new SupabaseOperationsRepository(
      { url: "https://example.test", publicKey: "public", serviceKey: "private" },
      "Bearer user",
      transport,
    );
    await repository.readRows("operations_facilities", "select=id");
    expect(transport.mock.calls[0][1].headers.authorization).toBe("Bearer user");
  });
  it("rejects malformed row collections and arbitrary table names", async () => {
    const repository = new SupabaseOperationsRepository(
      { url: "https://example.test", publicKey: "public" },
      "Bearer user",
      vi.fn().mockResolvedValue(Response.json([1])),
    );
    await expect(repository.readRows("operations_facilities", "select=id")).rejects.toThrow();
    await expect(repository.readRows("users", "select=*")).rejects.toThrow();
  });
  it("resolves configuration without weakening privilege requirements", () => {
    expect(operationsPersistenceConfig({})).toBeNull();
    expect(
      operationsPersistenceConfig({
        VITE_SUPABASE_URL: "url",
        VITE_SUPABASE_PUBLISHABLE_KEY: "key",
      })?.serviceKey,
    ).toBeUndefined();
  });
});
