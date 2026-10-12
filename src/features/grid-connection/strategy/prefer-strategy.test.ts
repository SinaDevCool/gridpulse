import { describe, expect, it, vi } from "vitest";
import { preferStrategy } from "./prefer-strategy";
describe("preferred strategy application command", () => {
  it("requires rationale before calling persistence", async () => {
    const repository = { selectPreferred: vi.fn() };
    expect(
      (await preferStrategy(repository, { siteId: "site", scenarioId: "scenario", rationale: " " }))
        .ok,
    ).toBe(false);
    expect(repository.selectPreferred).not.toHaveBeenCalled();
  });
  it("returns a typed failure rather than leaking a rejected promise to UI state", async () => {
    const repository = {
      selectPreferred: vi.fn().mockRejectedValue(new Error("permission denied")),
    };
    expect(
      await preferStrategy(repository, {
        siteId: "site",
        scenarioId: "scenario",
        rationale: "reviewed",
      }),
    ).toEqual({ ok: false, message: "permission denied" });
  });
  it("records the trimmed rationale through one atomic operation", async () => {
    const repository = { selectPreferred: vi.fn().mockResolvedValue(undefined) };
    expect(
      (
        await preferStrategy(repository, {
          siteId: "site",
          scenarioId: "scenario",
          rationale: " reviewed ",
        })
      ).ok,
    ).toBe(true);
    expect(repository.selectPreferred).toHaveBeenCalledOnce();
    expect(repository.selectPreferred).toHaveBeenCalledWith("site", "scenario", "reviewed");
  });
});
