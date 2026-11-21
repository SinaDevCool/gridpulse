/** Shared CSV encoding for user-triggered exports. Text must not become a formula. */
export function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  const lead = [...text].find((char) => char.charCodeAt(0) > 32 && char.trim() !== "") ?? "";
  const safe =
    typeof value === "string" && lead && "=+@-".includes(lead)
      ? String.fromCharCode(39) + text
      : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function csvDocument(rows: readonly (readonly unknown[])[]) {
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
