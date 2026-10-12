import { describe, expect, it } from "vitest";
import {
  withRequestContext,
  recordCapturedError,
  consumeLastCapturedError,
  currentRequestId,
} from "./request-context.server";

describe("request isolation", () => {
  it("keeps errors associated with concurrent requests and consumes only once", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = withRequestContext("first", async () => {
      recordCapturedError("first error");
      await gate;
      expect(currentRequestId()).toBe("first");
      expect(consumeLastCapturedError()).toBe("first error");
      expect(consumeLastCapturedError()).toBeUndefined();
    });
    await withRequestContext("second", async () => {
      recordCapturedError("second error");
      expect(consumeLastCapturedError()).toBe("second error");
      release();
    });
    await first;
    expect(consumeLastCapturedError()).toBeUndefined();
  });
  it("never captures an unassociated global error", () => {
    recordCapturedError("unassociated");
    expect(consumeLastCapturedError()).toBeUndefined();
  });
});
