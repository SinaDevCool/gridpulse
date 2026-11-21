import type { FinderProject } from "./finder-project";
import { csvDocument, downloadBlob } from "../../lib/tabular-export";
import { downloadJson } from "../site-portfolio/workspace-export";
import { collectionPublicationDate } from "./source-provenance";
import type { PowerFinderCollection } from "./fixture-data";
import type { CandidateOpportunity } from "./candidate-intelligence";

export function finderExportMetadata(collection: PowerFinderCollection | null) {
  return {
    release: collection?.metadata.dataset_release ?? null,
    artifactSha256: collection?.metadata.artifact_sha256 ?? null,
    sourcePublication: collection ? collectionPublicationDate(collection) : null,
    queriedAt: collection?.metadata.queried_at ?? null,
    retrievalCapped: collection?.metadata.retrieval_capped ?? null,
    publisher: collection?.metadata.publisher ?? null,
    attribution: collection?.metadata.attribution ?? null,
    licence: collection?.metadata.licence ?? null,
    boundary: "Filtered retrieved records only. No available import MW is established.",
  };
}

export function candidateExport(
  candidates: CandidateOpportunity[],
  collection: PowerFinderCollection | null,
  project?: FinderProject,
) {
  return {
    version: "finder-candidates-v1",
    population: "filtered site-to-node matches",
    metadata: {
      ...finderExportMetadata(collection),
      declaredImportMw: project?.importMw ?? null,
      siteLatitude: project?.latitude ?? null,
      siteLongitude: project?.longitude ?? null,
      maximumNodeDistanceKm: project?.maxDistanceKm ?? null,
      preferredMappedVoltageKv: project?.preferredVoltageKv ?? null,
    },
    rows: candidates.map((c) => ({
      candidateId: c.id,
      nodeId: c.nodeId,
      nodeName: c.nodeName,
      mappedVoltageKv: c.voltageKv,
      straightLineDistanceKm: c.distanceKm,
      mappedOperator: c.operator ?? null,
      investigationFit: c.screeningRank,
      availableImportMw: null,
      capacityStatus: "unverified",
      calculationVersion: c.calculationVersion,
      sourcePublishedAt: c.sourcePublishedAt ?? null,
      sourceSnapshotSha256: c.sourceSnapshotSha256 ?? null,
      missingEvidence: c.missingEvidence,
      constraints: c.constraints,
      distanceMethod: "straight-line",
    })),
  };
}

export function downloadFinderResult(
  value: { metadata: ReturnType<typeof finderExportMetadata>; rows: object[] },
  name: string,
  format: "csv" | "json",
) {
  if (format === "json") {
    downloadJson(value, `${name}.json`);
    return;
  }
  const rows = value.rows.map((row) => ({ ...row, ...value.metadata }));
  const columns = rows.length ? Object.keys(rows[0]) : ["boundary"];
  downloadBlob(
    new Blob(
      [
        csvDocument([
          columns,
          ...rows.map((row) =>
            columns.map((key) => {
              const v = (row as Record<string, unknown>)[key];
              return typeof v === "object" && v !== null ? JSON.stringify(v) : v;
            }),
          ),
        ]),
      ],
      { type: "text/csv;charset=utf-8" },
    ),
    `${name}.csv`,
  );
}
