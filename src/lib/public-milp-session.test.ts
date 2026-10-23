import { describe, expect, it, vi } from "vitest";
import { ensureVisitorSession } from "./public-milp-session";

function session(role = "gridpulse_public_visitor", anonymous = true) {
  return { access_token: `header.${btoa(JSON.stringify({ role }))}.signature`, user: { is_anonymous: anonymous } };
}

describe("no-sign-in public visitor sessions", () => {
  it("reuses a restricted session without creating another user", async () => {
    const value = session();
    const auth = { getSession: vi.fn().mockResolvedValue({ data: { session: value } }), signInAnonymously: vi.fn() };
    expect(await ensureVisitorSession(auth)).toBe(value);
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
  it("does not replace a named session or accept an authenticated anonymous role", async () => {
    for (const value of [session("authenticated", false), session("authenticated")]) {
      const auth = { getSession: vi.fn().mockResolvedValue({ data: { session: value } }), signInAnonymously: vi.fn() };
      await expect(ensureVisitorSession(auth)).rejects.toThrow(/restricted/);
      expect(auth.signInAnonymously).not.toHaveBeenCalled();
    }
  });
  it("rejects a newly issued session with broad authenticated privileges", async () => {
    const auth = { getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInAnonymously: vi.fn().mockResolvedValue({ data: { session: session("authenticated") }, error: null }) };
    await expect(ensureVisitorSession(auth)).rejects.toThrow(/restricted public session/);
  });
  it("creates a restricted session without requiring a CAPTCHA", async () => {
    const value = session();
    const auth = { getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInAnonymously: vi.fn().mockResolvedValue({ data: { session: value }, error: null }) };
    expect(await ensureVisitorSession(auth)).toBe(value);
    expect(auth.signInAnonymously).toHaveBeenCalledWith();
  });
  it("does not create an identity when loading the existing session fails", async () => {
    const auth = { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: new Error("offline") }),
      signInAnonymously: vi.fn() };
    await expect(ensureVisitorSession(auth)).rejects.toThrow(/Unable to load/);
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
  it("rejects failed anonymous signup without exposing provider details", async () => {
    const auth = { getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInAnonymously: vi.fn().mockResolvedValue({ data: { session: null }, error: { message: "internal detail" } }) };
    await expect(ensureVisitorSession(auth)).rejects.toThrow("A restricted public session could not be created. Please retry later.");
  });
});
