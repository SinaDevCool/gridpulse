import { describe, expect, it } from "vitest";
import { isThemePreference, resolveTheme } from "./theme-contract";
describe("theme contract", () => {
  it("resolves system preference deterministically", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
  it("rejects invalid persisted values", () => expect(isThemePreference("sepia")).toBe(false));
});
