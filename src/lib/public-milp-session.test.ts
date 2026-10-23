import { describe, expect, it, vi } from "vitest";
import { ensureVisitorSession } from "./public-milp-session";

function session(role = "gridpulse_public_visitor", anonymous = true) {
  return { access_token: `header.${btoa(JSON.stringify({ role }))}.signature`, user: { is_anonymous: anonymous } };
}

describe("no-sign-in public visitor sessions", () => {
  it("reuses a restricted session without creating another user", async () => {
    const value = session();
    const auth = { getSession: vi.fn().mockResolvedValue({ data: { session: value } }), signInAnonymously: vi.fn() };
    expect(await ensureVisitorSession(auth, "")).toBe(value);
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
  it("does not replace a named session or accept an authenticated anonymous role", async () => {
    for (const value of [session("authenticated", false), session("authenticated")]) {
      const auth = { getSession: vi.fn().mockResolvedValue({ data: { session: value } }), signInAnonymously: vi.fn() };
      await expect(ensureVisitorSession(auth, "challenge")).rejects.toThrow(/restricted/);
      expect(auth.signInAnonymously).not.toHaveBeenCalled();
    }
  });
  it("fails closed while bot setup is paused and never creates an unchallenged identity", async () => {
    const auth = { getSession: vi.fn().mockResolvedValue({ data: { session: null } }), signInAnonymously: vi.fn() };
    await expect(ensureVisitorSession(auth, "")).rejects.toThrow(/bot protection/);
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });
  it("passes a challenge only to Auth and accepts only the restricted result", async () => {
    const value = session();
    const auth = { getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInAnonymously: vi.fn().mockResolvedValue({ data: { session: value }, error: null }) };
    expect(await ensureVisitorSession(auth, "signup-challenge")).toBe(value);
    expect(auth.signInAnonymously).toHaveBeenCalledWith({ options: { captchaToken: "signup-challenge" } });
  });
});
