import release from "./release.json" with { type: "json" };
export const projectionId = release.id;
export const expectedCounts = release.expectedCounts;
const gridRelease = "40daf143-2b0b-4f7b-933d-0efc48ca4649";
const registryRelease = "94ce31d6-3b18-4d81-a301-8503f77b586c";
const definitions = {
  nodes: {
    table: "canonical_grid_nodes",
    release: gridRelease,
    kind: "'node'",
    name: "coalesce(n.canonical_name,n.source_record_id)",
    operator: "coalesce(o.canonical_name,n.operator_name)",
    extra:
      ",'voltage_kv',to_jsonb(n.voltage_kv),'max_voltage_kv',(select max(v) from unnest(n.voltage_kv) v),'capacity_state',coalesce(c.observation_type,'not_established'),'exact_mw',c.exact_mw,'band_min_mw',c.band_min_mw,'band_max_mw',c.band_max_mw,'confidence_grade',c.confidence_grade,'capacity_published_at',c.published_at",
    joins:
      "left join public.grid_operators o on o.id=n.operator_id left join lateral (select observation_type,exact_mw,band_min_mw,band_max_mw,confidence_grade,published_at from public.public_capacity_observations where node_id=n.id and direction='demand' order by published_at desc nulls last,created_at desc limit 1) c on true",
  },
  lines: {
    table: "canonical_grid_lines",
    release: gridRelease,
    kind: "'line'",
    name: "coalesce(n.name,'Mapped grid corridor')",
    operator: "n.operator_name",
    extra:
      ",'voltage_kv',to_jsonb(n.voltage_kv),'max_voltage_kv',(select max(v) from unnest(n.voltage_kv) v),'capacity_state','not_established'",
  },
  sites: {
    table: "canonical_industrial_sites",
    release: gridRelease,
    kind: "'industrial_site'",
    name: "coalesce(n.name,'Mapped industrial land')",
    operator: "null::text",
    extra:
      ",'voltage_kv','[]'::jsonb,'area_ha',n.area_ha,'site_kind',n.site_kind,'planning_status',n.planning_status,'capacity_state','not_established'",
  },
  assets: {
    table: "canonical_energy_assets",
    release: registryRelease,
    kind: "case when n.asset_type='storage' then 'storage_asset' else 'generation_asset' end",
    name: "coalesce(n.canonical_name,n.source_record_id)",
    operator: "n.grid_operator_name",
    extra:
      ",'technology',n.technology,'generation_group',public.power_finder_generation_group(n.asset_type,n.technology),'net_capacity_mw',n.net_capacity_mw,'storage_energy_mwh',n.storage_energy_mwh,'capacity_state','not_established'",
    filter:
      "and n.location_precision in ('surveyed','mapped') and n.asset_type in ('generation','storage')",
  },
};

export function exportQuery(group, cursor = "00000000-0000-0000-0000-000000000000", limit = 2500) {
  const d = definitions[group];
  if (
    !d ||
    !/^[0-9a-f-]{36}$/.test(cursor) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 5000
  )
    throw new Error("Invalid export bounds");
  return `with selected as (
 select n.id::text cursor,n.source_record_id::text id,${d.kind} kind,n.dataset_release_id::text source_release_id,
 encode(extensions.st_asewkb(n.geometry),'hex') geometry_hex,
 jsonb_strip_nulls(jsonb_build_object('kind',${d.kind},'name',${d.name},'operator',${d.operator},
 'status',${group === "sites" ? "'unknown'" : "n.operational_status"},'evidence_class',s.evidence_class,'source_url',s.source_url,
 'source_published_at',a.published_at${d.extra}))::text properties_text
 from public.${d.table} n join public.grid_dataset_releases r on r.id=n.dataset_release_id and r.status='active'
 join public.grid_source_artifacts a on a.id=r.source_artifact_id and a.status='active'
 join public.grid_sources s on s.id=n.source_id ${d.joins ?? ""}
 where n.dataset_release_id='${d.release}'::uuid and n.id>'${cursor}'::uuid and n.geometry is not null ${d.filter ?? ""}
 order by n.id limit ${limit}
 ) select *,encode(sha256(convert_to(jsonb_build_array(id,kind,source_release_id,properties_text,geometry_hex)::text,'UTF8')),'hex') row_sha256 from selected order by cursor`;
}

export const sourceFingerprintQuery = Object.entries(definitions)
  .map(
    ([group, d]) =>
      `select '${group}' as layer,count(*) as records,max(n.last_seen_at) as last_seen from public.${d.table} n join public.grid_dataset_releases r on r.id=n.dataset_release_id and r.status='active' join public.grid_source_artifacts a on a.id=r.source_artifact_id and a.status='active' where n.dataset_release_id='${d.release}'::uuid and n.geometry is not null ${d.filter ?? ""}`,
  )
  .join(" union all ");
