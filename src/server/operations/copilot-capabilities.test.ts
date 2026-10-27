import { describe, expect, it } from "vitest";
import { copilotCapabilities } from "./copilot-capabilities";
describe("service capability inventory", () => {
  it("does not advertise private experiments or accounting by default", () => {
    const result = copilotCapabilities(false);
    for (const intent of ["what_if", "accounting", "experiment", "why"])
      expect(result.find(item => item.intent === intent)).toMatchObject({ available: false, unavailableReason: expect.any(String) });
  });
  it("advertises only explicitly enabled tools and attached experiment evidence", () => {
    const result = copilotCapabilities(true, { experiments: true, accounting: true });
    for (const intent of ["what_if", "accounting", "experiment"])
      expect(result.find(item => item.intent === intent)).toMatchObject({ available: true, unavailableReason: null });
  });
});
