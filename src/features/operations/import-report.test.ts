import { describe, expect, it } from "vitest";
import { buildImportReport } from "./import-report";
describe("accepted import metadata", () => {
  it("records the time range without assuming row order or verified dispatch", () => {
    const report = buildImportReport(
      "battery",
      "battery.csv",
      ["2026-09-26T01:00:00Z", "2026-09-26T00:00:00Z"],
      true,
      "2026-09-27T00:00:00Z",
    );
    expect(report).toMatchObject({
      rowCount: 2,
      firstTimestamp: "2026-09-26T00:00:00Z",
      lastTimestamp: "2026-09-26T01:00:00Z",
      dispatchVerified: false,
      validation: "backend_input_validated",
    });
  });
  it("does not invent a range for missing timestamps", () => {
    expect(buildImportReport("gpu", "empty.csv", [], false).firstTimestamp).toBeNull();
  });
});
