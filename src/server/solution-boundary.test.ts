import { describe, expect, it } from "vitest";
import { unavailableSolutionResponse } from "./solution-boundary";

describe("server deployment boundary", () => {
  it("returns non-cacheable 404 for disabled solution pages and APIs before handlers run", async () => {
    for (const path of [
      "/operations?view=power",
      "/api/operations/assess",
      "/api/operations/workspace?facilityId=123",
      "/api/%6fperations/assess",
    ]) {
      const response = unavailableSolutionResponse(new Request(`https://example.com${path}`), [
        "planning",
      ])!;
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect((await response.json()).solution).toBe("operations");
    }
  });
  it("does not grant authentication or interfere with existing domain authorisation", () => {
    expect(
      unavailableSolutionResponse(new Request("https://example.com/api/operations/runs"), [
        "operations",
      ]),
    ).toBeNull();
    expect(
      unavailableSolutionResponse(new Request("https://example.com/power-finder"), ["operations"])
        ?.status,
    ).toBe(404);
    expect(
      unavailableSolutionResponse(new Request("https://example.com/assets/app.js"), ["operations"]),
    ).toBeNull();
  });
});
