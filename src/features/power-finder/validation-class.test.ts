import { describe, expect, it } from "vitest";
import { validationClassLabel } from "./validation-class";

describe("validation class labels", () => {
  it("never promotes an unknown class", () => {
    expect(validationClassLabel("operator_confirmed")).toBe("Operator confirmed");
    expect(validationClassLabel("unknown")).toBe("Validation class unavailable");
  });
});
