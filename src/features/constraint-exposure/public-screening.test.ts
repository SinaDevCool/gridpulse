import { describe, expect, it } from "vitest";
import { constraintExposureItemSchema } from "./contracts";
import { publicConstraintScreening } from "./public-screening";

describe("public constraint screening", () => {
  it("uses the canonical contract and never promotes demonstration evidence", () => {
    for (const finding of publicConstraintScreening) {
      expect(constraintExposureItemSchema.safeParse(finding).success).toBe(true);
      expect(finding.provenance.evidenceClass).not.toBe("operator_confirmed");
      expect(finding.provenance.operatorValidationRequired).toBe(true);
      expect(finding.remainingMarginMw).toBeNull();
    }
  });
});
