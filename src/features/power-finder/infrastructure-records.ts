import type { PowerFinderFeature, PowerFinderCollection } from "./fixture-data";
import type { FinderSearch } from "./search-contract";
import { finderExportMetadata } from "./finder-result-export";

export function missingInfrastructureField(
  feature: PowerFinderFeature,
  field: FinderSearch["assetMissing"],
) {
  const p = feature.properties;
  if (field === "operator") return !p.operator?.trim();
  if (field === "voltage")
    return ["node", "line"].includes(p.kind) && !p.voltage_kv?.some((v) => v > 0);
  if (field === "rating")
    return ["generation_asset", "storage_asset"].includes(p.kind) && p.net_capacity_mw == null;
  return true;
}

export function infrastructureRecords(
  collection: PowerFinderCollection | null,
  search: FinderSearch,
) {
  const records = [...new Map((collection?.features ?? []).map((f) => [f.id, f])).values()];
  const rows = records
    .filter(
      (f) =>
        (!search.assetKind || f.properties.kind === search.assetKind) &&
        (!search.assetEvidence || f.properties.evidence_class === search.assetEvidence) &&
        missingInfrastructureField(f, search.assetMissing),
    )
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name) || a.id.localeCompare(b.id));
  const kinds = new Map<string, number>();
  const known = { voltage: 0, voltageEligible: 0, operator: 0, rating: 0, ratingEligible: 0 };
  for (const f of records) {
    if (f.properties.operator?.trim()) known.operator++;
    if (["node", "line"].includes(f.properties.kind)) {
      known.voltageEligible++;
      if (!missingInfrastructureField(f, "voltage")) known.voltage++;
    }
    if (["generation_asset", "storage_asset"].includes(f.properties.kind)) {
      known.ratingEligible++;
      if (!missingInfrastructureField(f, "rating")) known.rating++;
    }
  }
  for (const f of records) kinds.set(f.properties.kind, (kinds.get(f.properties.kind) ?? 0) + 1);
  return { rows, records, kinds, known };
}

export function infrastructureExport(
  rows: PowerFinderFeature[],
  collection: PowerFinderCollection | null,
) {
  return {
    version: "finder-infrastructure-v1",
    population: "filtered retrieved active-layer records",
    metadata: finderExportMetadata(collection),
    rows: rows.map((f) => ({
      featureId: f.id,
      name: f.properties.name,
      kind: f.properties.kind,
      mappedVoltageKv: f.properties.voltage_kv ?? null,
      registeredPowerMw: f.properties.net_capacity_mw ?? null,
      storageEnergyMwh: f.properties.storage_energy_mwh ?? null,
      technology: f.properties.generation_group ?? f.properties.technology ?? null,
      mappedOperator: f.properties.operator ?? null,
      evidenceClass: f.properties.evidence_class,
      sourceUrl: f.properties.source_url ?? null,
      sourcePublishedAt: f.properties.source_published_at ?? null,
      availableImportMw: null,
    })),
  };
}
