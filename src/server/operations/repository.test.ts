import { describe, expect, it, vi } from "vitest";
import { SupabaseOperationsRepository, operationsPersistenceConfig } from "./repository";

describe("Operations repository access boundaries", () => {
  it("uses the user's JWT for snapshot RPCs and rejects incomplete evidence packages", async () => {
    const transport = vi.fn().mockResolvedValue(Response.json({ operations_facilities: [] }));
    const repository = new SupabaseOperationsRepository(
      { url: "https://example.test", publicKey: "public", serviceKey: "private" },
      "Bearer user",
      transport,
    );
    await expect(repository.readWorkspaceSnapshot("facility", "start", "end")).rejects.toThrow();
    const [url, request] = transport.mock.calls[0];
    expect(url).toContain("/rpc/operations_workspace_snapshot");
    expect(request.headers.authorization).toBe("Bearer user");
    expect(request.headers.apikey).toBe("public");
    expect(JSON.parse(request.body)).toEqual({
      p_facility_id: "facility",
      p_start: "start",
      p_end: "end",
    });
  });
  it("preserves denied snapshot access instead of falling back to privileged reads", async () => {
    const transport = vi.fn().mockResolvedValue(Response.json(null));
    const repository = new SupabaseOperationsRepository(
      { url: "https://example.test", publicKey: "public", serviceKey: "private" },
      "Bearer user",
      transport,
    );
    expect(await repository.readWorkspaceSnapshot("facility", "start", "end")).toBeNull();
    expect(transport).toHaveBeenCalledTimes(1);
  });
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
    await expect(
      repository.readRows("users" as "operations_facilities", "select=*"),
    ).rejects.toThrow();
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
