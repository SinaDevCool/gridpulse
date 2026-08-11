import { describe, expect, it } from "vitest";
import { capacityValue, parseCapacityDossier } from "./capacity-dossier";

describe("capacity dossier", () => {
  it("keeps absent capacity unknown", () => expect(capacityValue(null)).toBe("Unknown"));
  it("rejects an incomplete projection", () => expect(() => parseCapacityDossier({ property: {} })).toThrow(/incomplete/));
});
