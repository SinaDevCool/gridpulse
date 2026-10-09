import { Download, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { propertyFromImport } from "@/features/anonymous-workspace/factory";
import { importAnonymousProperties } from "@/features/anonymous-workspace/repository";
import { listAnonymousProperties } from "@/features/anonymous-workspace/repository";
import {
  parsePropertyImport,
  propertyImportTemplateCsv,
  type PropertyImportRow,
} from "./property-import";
import {
  screenPropertyPortfolio,
  type PropertyScreeningProgress,
} from "./property-screening-workflow";

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
  const [enrichAfterImport, setEnrichAfterImport] = useState(true);
  const [screeningProgress, setScreeningProgress] = useState<PropertyScreeningProgress | null>(
    null,
  );
  const [screeningSummary, setScreeningSummary] = useState<{
    imported: number;
    completed: number;
    failed: number;
    findings: number;
  } | null>(null);
  const [failedPropertyIds, setFailedPropertyIds] = useState<string[]>([]);
  const [firstReviewId, setFirstReviewId] = useState<string | null>(null);
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
      const properties = rows.map(({ value }) => propertyFromImport(value, extension));
      const result = await importAnonymousProperties(properties, conflict);
      let completed = 0;
      let failed = 0;
      let findings = 0;
      if (enrichAfterImport && result.imported) {
        const stored = await listAnonymousProperties();
        const importedKeys = new Set(
          properties.flatMap((property) => [
            property.id,
            property.externalPropertyId?.toLocaleLowerCase() ?? "",
          ]),
        );
        const targets = stored.filter(
          (property) =>
            importedKeys.has(property.id) ||
            (property.externalPropertyId &&
              importedKeys.has(property.externalPropertyId.toLocaleLowerCase())),
        );
        const screened = await screenPropertyPortfolio(targets, setScreeningProgress);
        completed = screened.results.length;
        failed = screened.failures.length;
        setFailedPropertyIds(screened.failures.map((item) => item.property.id));
        setFirstReviewId(
          screened.results.find((property) =>
            property.enrichmentFindings?.some((finding) => finding.status === "proposed"),
          )?.id ??
            screened.failures[0]?.property.id ??
            null,
        );
        findings = screened.results.reduce(
          (sum, property) =>
            sum +
            (property.enrichmentFindings ?? []).filter((finding) => finding.status === "proposed")
              .length,
          0,
        );
        if (failed) toast.warning(`${failed} sites require a screening retry.`);
      }
      setScreeningSummary({ imported: result.imported, completed, failed, findings });
      toast.success(
        `${result.imported} ${result.imported === 1 ? "property" : "properties"} imported${completed ? `; ${completed} screened` : ""}${result.skipped ? `; ${result.skipped} existing IDs skipped` : ""}`,
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

  async function retryFailed() {
    if (!failedPropertyIds.length) return;
    setBusy(true);
    const stored = await listAnonymousProperties();
    const targets = stored.filter((property) => failedPropertyIds.includes(property.id));
    const screened = await screenPropertyPortfolio(targets, setScreeningProgress);
    setFailedPropertyIds(screened.failures.map((item) => item.property.id));
    setScreeningSummary(
      (current) =>
        current && {
          ...current,
          completed: current.completed + screened.results.length,
          failed: screened.failures.length,
        },
    );
    setBusy(false);
    onImported();
    if (screened.failures.length)
      toast.warning(`${screened.failures.length} sites still require review.`);
    else toast.success("All failed site screenings completed.");
  }

  function exportSummary() {
    if (!screeningSummary) return;
    const rows = [
      "metric,value",
      `imported,${screeningSummary.imported}`,
      `screened,${screeningSummary.completed}`,
      `failed,${screeningSummary.failed}`,
      `findings_awaiting_review,${screeningSummary.findings}`,
    ];
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "gridpulse-import-screening-summary.csv";
    anchor.click();
    URL.revokeObjectURL(url);
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
        <div className="property-import-downloads">
          <a
            className="secondary-button"
            href="/samples/gridpulse-client-portfolio-sample.xlsx"
            download
          >
            <Download aria-hidden="true" /> Client-Style XLSX Sample
          </a>
          <button type="button" className="secondary-button" onClick={downloadTemplate}>
            <Download aria-hidden="true" /> Blank template
          </button>
        </div>
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
      {screeningProgress && busy ? (
        <div className="enrichment-run-summary" role="status" aria-live="polite">
          <LoaderCircle className="spin" aria-hidden="true" />
          <strong>{screeningProgress.propertyName}</strong>
          <span>{screeningProgress.message}</span>
          <span>
            {screeningProgress.completed} of {screeningProgress.total}
          </span>
        </div>
      ) : null}
      {screeningSummary && !busy ? (
        <div className="enrichment-run-summary" role="status">
          <strong>{screeningSummary.imported} sites imported</strong>
          <span>{screeningSummary.completed} enriched and grid-screened</span>
          <span>{screeningSummary.failed} require retry</span>
          <span>{screeningSummary.findings} findings awaiting review</span>
          <div className="property-import-summary-actions">
            {failedPropertyIds.length ? (
              <button type="button" onClick={() => void retryFailed()}>
                Retry failed sites
              </button>
            ) : null}
            {firstReviewId ? (
              <a href={`/portfolio/${firstReviewId}?tab=evidence`}>
                Open first site needing review
              </a>
            ) : null}
            <button type="button" onClick={exportSummary}>
              Export screening summary
            </button>
          </div>
        </div>
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
            <label className="property-import-enrich-option">
              <input
                type="checkbox"
                checked={enrichAfterImport}
                onChange={(event) => setEnrichAfterImport(event.target.checked)}
              />
              Enrich imported sites from accepted public sources
            </label>
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
