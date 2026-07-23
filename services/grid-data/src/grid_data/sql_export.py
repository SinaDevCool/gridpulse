from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _literal(value: Any) -> str:
    if value is None:
        return "null"
    return "'" + str(value).replace("'", "''") + "'"


def _array(values: list[float] | None) -> str:
    return "array[" + ",".join(str(value) for value in values or []) + "]::numeric[]"


def _geojson(geometry: dict[str, Any]) -> str:
    return _literal(json.dumps(geometry, ensure_ascii=False, separators=(",", ":")))


def write_ingestion_sql(collection_path: Path, output_path: Path) -> int:
    collection = json.loads(collection_path.read_text(encoding="utf-8"))
    metadata = collection["metadata"]
    source_id = metadata["source_id"]
    artifact_sha = metadata["artifact_sha256"]
    statements = [
        "begin;",
        f"""insert into public.grid_sources
  (id, publisher, title, source_url, licence, attribution, geographic_scope,
   evidence_class, refresh_cadence, last_verified_at)
values
  ({_literal(source_id)}, {_literal(metadata['publisher'])}, {_literal(metadata['title'])},
   {_literal(metadata['source_url'])}, {_literal(metadata['licence'])},
   {_literal(metadata['attribution'])}, {_literal(metadata['geographic_scope'])},
   'open_mapping', 'monthly', now())
on conflict (id) do update set
  publisher = excluded.publisher, title = excluded.title, source_url = excluded.source_url,
  licence = excluded.licence, attribution = excluded.attribution,
  geographic_scope = excluded.geographic_scope, last_verified_at = excluded.last_verified_at,
  updated_at = now();""",
        f"""insert into public.grid_source_artifacts
  (source_id, source_url, sha256, content_type, published_at, connector_version,
   parser_version, record_count, validation_report, status)
values
  ({_literal(source_id)}, {_literal(metadata['source_url'])}, {_literal(artifact_sha)},
   'application/geo+json', {_literal(metadata['published_at'])}::timestamptz,
   {_literal(metadata['connector_version'])}, {_literal(metadata['parser_version'])},
   {int(metadata['record_count'])}, '{{"valid":true}}'::jsonb, 'active')
on conflict (source_id, sha256) do update set status = 'active',
  validation_report = excluded.validation_report;""",
        f"""update public.grid_source_artifacts
set status = 'superseded'
where source_id = {_literal(source_id)} and sha256 <> {_literal(artifact_sha)}
  and status = 'active';""",
    ]

    for feature in collection["features"]:
        props = feature["properties"]
        source_record_id = props["source_record_id"]
        geometry = feature["geometry"]
        common_metadata = json.dumps(
            {
                "evidence_class": props["evidence_class"],
                "capacity_state": props["capacity_state"],
                "source_url": props["source_url"],
                "raw_tags": props["raw_tags"],
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )
        artifact_lookup = (
            f"(select id from public.grid_source_artifacts where source_id = "
            f"{_literal(source_id)} and sha256 = {_literal(artifact_sha)})"
        )

        if props["kind"] == "node":
            statements.append(
                f"""insert into public.canonical_grid_nodes
  (source_id, source_artifact_id, source_record_id, canonical_name, node_type,
   operator_name, voltage_kv, geometry, operational_status, confidence, metadata)
values
  ({_literal(source_id)}, {artifact_lookup}, {_literal(source_record_id)},
   {_literal(props['name'])}, 'substation', {_literal(props.get('operator'))},
   {_array(props.get('voltage_kv'))},
   extensions.st_setsrid(extensions.st_geomfromgeojson({_geojson(geometry)}), 4326),
   {_literal(props.get('status', 'unknown'))}, 'medium', {_literal(common_metadata)}::jsonb)
on conflict (source_id, source_record_id) do update set
  source_artifact_id = excluded.source_artifact_id, canonical_name = excluded.canonical_name,
  operator_name = excluded.operator_name, voltage_kv = excluded.voltage_kv,
  geometry = excluded.geometry, operational_status = excluded.operational_status,
  metadata = excluded.metadata, last_seen_at = now();"""
            )
        elif props["kind"] == "line":
            statements.append(
                f"""insert into public.canonical_grid_lines
  (source_id, source_artifact_id, source_record_id, name, operator_name, voltage_kv,
   underground, geometry, operational_status, confidence, metadata)
values
  ({_literal(source_id)}, {artifact_lookup}, {_literal(source_record_id)},
   {_literal(props['name'])}, {_literal(props.get('operator'))},
   {_array(props.get('voltage_kv'))}, {str(props['raw_tags'].get('power') == 'cable').lower()},
   extensions.st_multi(extensions.st_setsrid(
     extensions.st_geomfromgeojson({_geojson(geometry)}), 4326)),
   {_literal(props.get('status', 'unknown'))}, 'medium', {_literal(common_metadata)}::jsonb)
on conflict (source_id, source_record_id) do update set
  source_artifact_id = excluded.source_artifact_id, name = excluded.name,
  operator_name = excluded.operator_name, voltage_kv = excluded.voltage_kv,
  underground = excluded.underground, geometry = excluded.geometry,
  operational_status = excluded.operational_status, metadata = excluded.metadata,
  last_seen_at = now();"""
            )
        elif props["kind"] == "industrial_site":
            statements.append(
                f"""insert into public.canonical_industrial_sites
  (source_id, source_artifact_id, source_record_id, name, site_kind, geometry,
   planning_status, metadata)
values
  ({_literal(source_id)}, {artifact_lookup}, {_literal(source_record_id)},
   {_literal(props['name'])}, 'industrial_land',
   extensions.st_multi(extensions.st_setsrid(
     extensions.st_geomfromgeojson({_geojson(geometry)}), 4326)),
   'screening_only', {_literal(common_metadata)}::jsonb)
on conflict (source_id, source_record_id) do update set
  source_artifact_id = excluded.source_artifact_id, name = excluded.name,
  geometry = excluded.geometry, metadata = excluded.metadata, last_seen_at = now();"""
            )

    statements.append("commit;")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n\n".join(statements) + "\n", encoding="utf-8")
    return len(collection["features"])
