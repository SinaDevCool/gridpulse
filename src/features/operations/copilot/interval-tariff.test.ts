import { expect, it } from "vitest";
import { intervalTariff } from "./interval-tariff";

it("accepts finite negative prices without calculating costs in the browser", () => {
  expect(intervalTariff("-25, 0; 12.5\n1e2", 4)).toEqual([-25, 0, 12.5, 100]);
});
it("rejects incomplete, nonfinite and ambiguous price lists", () => {
  for (const text of ["", "1,2", "NaN,1,2", "1,,2", "1,,2,3", "1,2,3,", "0x10 2 3", "1e999 2 3"]) {
    expect(() => intervalTariff(text, 3)).toThrow();
  }
});
