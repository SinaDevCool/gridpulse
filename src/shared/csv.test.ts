import { describe, expect, it } from "vitest";
import { readCsv } from "./csv";

describe("CSV syntax boundary", () => {
  it("handles BOM, quotes, commas, escaped quotes and embedded newlines", () => {
    expect(readCsv('\uFEFFID,Name\r\n1,"batch, ""important""\nnext"\r\n')).toEqual({
      headers: ["id", "name"],
      rows: [["1", 'batch, "important"\nnext']],
    });
  });
  it("preserves empty values and skips empty records", () => {
    expect(readCsv("a,b\n\n1,\n").rows).toEqual([["1", ""]]);
  });
  it.each(['a,b\n1,"broken', "a,a\n1,2", "a,b\n1", 'a,b\n1,"x"oops'])(
    "rejects malformed CSV %s",
    (text) => expect(() => readCsv(text)).toThrow(),
  );
});
