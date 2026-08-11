import { Download, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { propertyFromImport } from "@/features/anonymous-workspace/factory";
import { importAnonymousProperties } from "@/features/anonymous-workspace/repository";
import {
  parsePropertyImport,
  propertyImportTemplateCsv,
  type PropertyImportRow,
} from "./property-import";

function downloadTemplate() {
  const url = URL.createObjectURL(
    new Blob([propertyImportTemplateCsv()], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "gridpulse-property-import-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PropertyImportPanel({
  onImported,
  variant = "full",
}: {
  onImported: () => void;
  variant?: "full" | "compact";
}) {
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<PropertyImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<"skip" | "replace" | "merge">("skip");
  const invalid = rows.filter((row) => row.errors.length > 0).length;

  async function selectFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      setRows(await parsePropertyImport(file));
      setFileName(file.name);
    } catch (reason) {
      setRows([]);
      setError(
        reason instanceof Error
          ? reason.message
          : "The file could not be read. Check its format and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!rows.length || invalid) return;
    setBusy(true);
    setError("");
    try {
      const extension = fileName.split(".").pop()?.toLowerCase() ?? "csv";
      const result = await importAnonymousProperties(
        rows.map(({ value }) => propertyFromImport(value, extension)),
        conflict,
      );
      toast.success(
        `${result.imported} ${result.imported === 1 ? "property" : "properties"} imported${result.skipped ? `; ${result.skipped} existing IDs skipped` : ""}`,
      );
    } catch (reason) {
      setError(
        `${reason instanceof Error ? reason.message : "Import failed."} No rows were committed.`,
      );
      setBusy(false);
      return;
    }
    setBusy(false);
    setRows([]);
    setFileName("");
    if (input.current) input.current.value = "";
    onImported();
  }

  return (
    <section
      className={`workspace-card property-import-panel property-import-panel--${variant}`}
      aria-labelledby="property-import-title"
    >
      <header className="workspace-card-heading">
        <div>
          <p className="context-label">Property Portfolio Intake</p>
          <h2 id="property-import-title">Import 1–100 properties</h2>
          <p>Preview CSV, XLSX, or GeoJSON rows before an atomic portfolio commit.</p>
        </div>
        <button type="button" className="secondary-button" onClick={downloadTemplate}>
          <Download aria-hidden="true" /> Download Template
        </button>
      </header>
      <label className="property-import-dropzone">
        <FileSpreadsheet aria-hidden="true" />
        <span>{fileName || "Choose a property portfolio file"}</span>
        <small>CSV, XLSX, or GeoJSON · maximum 100 properties</small>
        <input
          ref={input}
          name="property-portfolio-file"
          type="file"
          accept=".csv,.xlsx,.geojson,.json"
          onChange={(event) => void selectFile(event.target.files?.[0])}
        />
      </label>
      {busy && !rows.length ? (
        <p role="status" aria-live="polite">
          Reading portfolio…
        </p>
      ) : null}
      {error ? (
        <p className="form-message error-message" role="alert">
          {error}
        </p>
      ) : null}
      {rows.length ? (
        <>
          <div className="property-import-summary" role="status" aria-live="polite">
            <strong>{rows.length} rows</strong>
            <span>{invalid ? `${invalid} require correction` : "Ready to import"}</span>
          </div>
          <div className="portfolio-table-wrap">
            <table className="decision-table property-import-preview">
              <caption className="sr-only">Property import preview and validation</caption>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Property</th>
                  <th>External ID</th>
                  <th>Location</th>
                  <th>Required MW</th>
                  <th>Validation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.value.sourceRow}-${row.value.externalPropertyId ?? row.value.propertyName}`}
                  >
                    <td>{row.value.sourceRow}</td>
                    <td>{row.value.propertyName || "Missing"}</td>
                    <td>{row.value.externalPropertyId ?? "—"}</td>
                    <td>
                      {row.value.latitude ?? "Unknown"}, {row.value.longitude ?? "Unknown"}
                    </td>
                    <td>{row.value.requiredTotalSiteLoadMw ?? "Unknown"}</td>
                    <td>
                      {row.errors.length ? (
                        <ul>
                          {row.errors.map((message) => (
                            <li key={message}>{message}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="status-badge is-ready">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="property-import-actions">
            <label>
              Existing matches
              <select
                value={conflict}
                onChange={(event) => setConflict(event.target.value as typeof conflict)}
              >
                <option value="skip">Skip existing</option>
                <option value="merge">Keep existing and fill gaps</option>
                <option value="replace">Replace existing</option>
              </select>
            </label>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setRows([]);
                setFileName("");
              }}
              disabled={busy}
            >
              Clear Preview
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => void commit()}
              disabled={busy || invalid > 0}
            >
              {busy ? (
                <LoaderCircle className="spin" aria-hidden="true" />
              ) : (
                <Upload aria-hidden="true" />
              )}
              {busy
                ? "Importing…"
                : `Import ${rows.length} ${rows.length === 1 ? "Property" : "Properties"}`}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
