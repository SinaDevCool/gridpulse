import { describe, expect, it } from "vitest";
import { classifyGridVoltage } from "./voltage-style";

describe("grid voltage styling", () => {
  it.each([[380, "ehv"], [220, "220kv"], [110, "110kv"], [20, "distribution"], [null, "unknown"]])(
    "classifies %s kV as %s",
    (voltage, expected) => expect(classifyGridVoltage(voltage)?.id).toBe(expected),
  );
});
