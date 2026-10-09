import { afterEach, describe, expect, it, vi } from "vitest";
import { handleOperationsRun } from "./operations-runs-api";
import { defaultOperationsScenario } from "../features/operations/scenario-engine";
const owner = "11111111-1111-4111-8111-111111111111";
const facilityId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const env = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "public",
  SUPABASE_SERVICE_ROLE_KEY: "private",
};
const request = () =>
  new Request("https://test/api/operations/runs", {
    method: "POST",
    headers: { authorization: "Bearer owner-jwt" },
    body: JSON.stringify({
      facilityId,
      assessment: { kind: "overview", scenario: defaultOperationsScenario },
      result: { fake: true },
    }),
  });
afterEach(() => vi.restoreAllMocks());
describe("versioned Operations calculation persistence", () => {
  it("requires authentication before persistence access", async () => {
    const mock = vi.spyOn(globalThis, "fetch");
    expect(
      (await handleOperationsRun(new Request("https://test", { method: "POST" }), env)).status,
    ).toBe(401);
    expect(mock).not.toHaveBeenCalled();
  });
  it("records recalculated results and the exact inputs, not a caller-provided result", async () => {
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ id: owner }))
      .mockResolvedValueOnce(Response.json([{ id: facilityId }]))
      .mockResolvedValueOnce(Response.json(runId));
    const result = await handleOperationsRun(request(), env);
    expect(result.status).toBe(201);
    const sent = JSON.parse(String(mock.mock.calls[2][1]?.body));
    expect(sent.p_owner_id).toBe(owner);
    expect(sent.p_mode).toBe("scenario");
    expect(sent.p_result.automaticDispatchAuthorized).toBe(false);
    expect(sent.p_result).not.toHaveProperty("fake");
    expect(sent.p_input_snapshot.scenario.battery).toEqual(defaultOperationsScenario.battery);
  });
  it("does not save an assessment into another owner's facility", async () => {
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ id: owner }))
      .mockResolvedValueOnce(Response.json([]));
    expect((await handleOperationsRun(request(), env)).status).toBe(404);
    expect(mock).toHaveBeenCalledTimes(2);
  });
});
