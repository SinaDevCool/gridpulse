import { afterEach, describe, expect, it, vi } from "vitest";
import { pollDelay } from "./poll-delay";
afterEach(() => vi.useRealTimers());
describe("cancellable polling delay", () => {
  it("clears timers when a caller stops waiting", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const result = pollDelay(1500, controller.signal);
    const rejected = expect(result).rejects.toThrow();
    controller.abort();
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not create a timer for an already cancelled request", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    controller.abort();
    await expect(pollDelay(1500, controller.signal)).rejects.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});
