import { useEffect, useMemo, useState } from "react";
import type { FinderControllerContract } from "./controller-contract";
import { FinderResultsDock } from "./FinderResultsDock";
import { kindLabels } from "./page-formatting";
import { pointCoordinates, type PowerFinderKind, type PowerFinderFeature } from "./fixture-data";
import { infrastructureRecords, infrastructureExport } from "./infrastructure-records";
import { downloadFinderResult } from "./finder-result-export";

export function FinderInfrastructureExplorer({ model }: { model: FinderControllerContract }) {
  const [page, setPage] = useState(0);
  const { rows, records, kinds, known } = useMemo(
    () => infrastructureRecords(model.visibleCollection, model.search),
    [model.visibleCollection, model.search],
  );
  useEffect(() => setPage(0), [rows]);
  const close = () => {
    void model.updateSearch({ resultsView: undefined });
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>('[data-finder-view="cards"]')?.focus(),
    );
  };
  const select = async (f: PowerFinderFeature) => {
    model.setSelectedOpportunitySnapshot(null);
    await model.updateSearch({ candidate: undefined });
    model.setSelected(f);
    const point = pointCoordinates(f);
    if (point) model.navigateMapToPoint(point);
    model.setInteractionNotice(
      `${f.properties.name}: retrieved mapped record selected. Import capacity remains unverified.`,
    );
  };
  const tools = (
    <div className="finder-view-options">
      <p>
        These filters affect this list only. Use Map view &amp; optional layers to include
        generation or storage.
      </p>
      <label>
        Record type
        <select
          value={model.search.assetKind ?? ""}
          onChange={(e) =>
            void model.updateSearch({
              assetKind: (e.target.value || undefined) as typeof model.search.assetKind,
            })
          }
        >
          <option value="">All active types</option>
          {Object.entries(kindLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Missing information
        <select
          value={model.search.assetMissing ?? ""}
          onChange={(e) =>
            void model.updateSearch({
              assetMissing: (e.target.value || undefined) as typeof model.search.assetMissing,
            })
          }
        >
          <option value="">Include all records</option>
          <option value="voltage">Missing mapped voltage (nodes/lines)</option>
          <option value="operator">Missing mapped operator</option>
          <option value="rating">Missing registered power (generation/storage)</option>
        </select>
      </label>
      <label>
        Source evidence
        <select
          value={model.search.assetEvidence ?? ""}
          onChange={(e) =>
            void model.updateSearch({
              assetEvidence: (e.target.value || undefined) as typeof model.search.assetEvidence,
            })
          }
        >
          <option value="">All source classes</option>
          {["open_mapping", "official_public", "official_regulatory", "official_operator"].map(
            (key) => (
              <option key={key} value={key}>
                {key.replaceAll("_", " ")}
              </option>
            ),
          )}
        </select>
      </label>
      <p>
        Retrieved active-layer sample before table filters: {records.length}.{" "}
        {Object.entries(kindLabels)
          .map(([key, label]) => `${label}: ${kinds.get(key) ?? 0}`)
          .join(" · ")}
      </p>
      <p>
        Known mapped voltage: {known.voltage}/{known.voltageEligible} nodes/lines · mapped operator:{" "}
        {known.operator}/{records.length} records · registered power: {known.rating}/
        {known.ratingEligible} generation/storage records. These are sample completeness counts, not
        national coverage.
      </p>
      <button
        type="button"
        disabled={!rows.length}
        onClick={() =>
          downloadFinderResult(
            infrastructureExport(rows, model.collection),
            "gridpulse-infrastructure",
            "csv",
          )
        }
      >
        Export records CSV
      </button>
      <button
        type="button"
        disabled={!rows.length}
        onClick={() =>
          downloadFinderResult(
            infrastructureExport(rows, model.collection),
            "gridpulse-infrastructure",
            "json",
          )
        }
      >
        Export records JSON
      </button>
    </div>
  );
  const pageRows = rows.slice(page * 50, (page + 1) * 50);
  return (
    <FinderResultsDock
      title="Infrastructure records"
      summary={`${rows.length} matched of ${records.length} retrieved active-layer records`}
      onClose={close}
      tools={tools}
    >
      <p>
        Current map response only; this is not a complete catalogue. List filters do not hide map
        layers. Registered power is not available import MW.
      </p>
      {model.collection?.metadata.retrieval_capped && (
        <p role="status">Retrieval limit reached: this sample is incomplete.</p>
      )}
      {!model.collection && (
        <p role="status">Waiting for a bounded map response. Zoom in to retrieve records.</p>
      )}
      {model.error && <p role="status">{model.error}</p>}
      <table>
        <caption>
          Mapped infrastructure, sorted by name. Up to 50 retrieved records per page.
        </caption>
        <thead>
          <tr>
            {[
              "Record",
              "Type",
              "Mapped voltage",
              "Registered power",
              "Technology",
              "Mapped operator",
              "Evidence",
            ].map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((f) => (
            <tr key={f.id} data-selected={model.selected?.id === f.id ? "true" : undefined}>
              <th scope="row">
                <button
                  type="button"
                  onClick={() => void select(f)}
                  aria-label={`Inspect infrastructure ${f.properties.name}`}
                >
                  {f.properties.name}
                  <small>{f.id}</small>
                </button>
              </th>
              <td>{kindLabels[f.properties.kind as PowerFinderKind]}</td>
              <td>
                {f.properties.voltage_kv?.length
                  ? f.properties.voltage_kv.join("/") + " kV"
                  : ["node", "line"].includes(f.properties.kind)
                    ? "Unknown"
                    : "Not applicable"}
              </td>
              <td>
                {["generation_asset", "storage_asset"].includes(f.properties.kind)
                  ? f.properties.net_capacity_mw == null
                    ? "Unknown"
                    : `${f.properties.net_capacity_mw} MW`
                  : "Not applicable"}
              </td>
              <td>{f.properties.generation_group ?? f.properties.technology ?? "Not published"}</td>
              <td>{f.properties.operator ?? "Unconfirmed"}</td>
              <td>{f.properties.evidence_class.replaceAll("_", " ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {model.collection && !rows.length && (
        <p role="status">
          No retrieved active-layer records match. Adjust list filters, map layers or zoom. This
          does not establish absence of infrastructure.
        </p>
      )}
      <div className="finder-results-dock__actions">
        <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          Previous records
        </button>
        <span>
          Page {page + 1} of {Math.max(1, Math.ceil(rows.length / 50))}
        </span>
        <button
          type="button"
          disabled={(page + 1) * 50 >= rows.length}
          onClick={() => setPage((p) => p + 1)}
        >
          Next records
        </button>
      </div>
    </FinderResultsDock>
  );
}
