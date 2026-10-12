/** CSV syntax only. Unit, timestamp and domain validation belongs to callers. */
export function readCsv(text: string): { headers: string[]; rows: string[][] } {
  const input = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  function finishField() {
    row.push(field.trim());
    field = "";
    closed = false;
  }
  function finishRow() {
    finishField();
    if (row.some((value) => value !== "")) records.push(row);
    row = [];
  }
  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += character;
    } else if (character === ",") finishField();
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index++;
      finishRow();
    } else if (character === '"') {
      if (field.trim() || closed)
        throw new Error(`Unexpected CSV quote near character ${index + 1}.`);
      field = "";
      quoted = true;
    } else {
      if (closed && character.trim())
        throw new Error(`Unexpected CSV value after closing quote near character ${index + 1}.`);
      field += character;
    }
  }
  if (quoted) throw new Error("The CSV contains an unterminated quoted field.");
  if (field || row.length || closed) finishRow();
  if (records.length < 2)
    throw new Error("The file must contain a header and at least one data row.");
  const headers = records[0].map((value) => value.toLowerCase());
  if (headers.some((value) => !value) || new Set(headers).size !== headers.length)
    throw new Error("CSV column names must be non-empty and unique.");
  const rows = records.slice(1);
  rows.forEach((values, index) => {
    if (values.length !== headers.length)
      throw new Error(
        `CSV row ${index + 2} has ${values.length} fields; expected ${headers.length}.`,
      );
  });
  return { headers, rows };
}
