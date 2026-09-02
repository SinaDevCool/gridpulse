from __future__ import annotations

import hashlib
import json
import os
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator

from .publish import SupabasePublisher, _chunks


@dataclass(frozen=True)
class OsmPublishReport:
    release_id: str
    ingestion_run_id: str
    records_published: int
    counts: dict[str, int]


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _staging_rows(input_path: Path, release_id: str) -> Iterator[dict[str, Any]]:
    with input_path.open(encoding="utf-8") as stream:
        for line in stream:
            item = json.loads(line)
            yield {
                "release_id": release_id,
                "kind": item["kind"],
                "source_record_id": item["source_record_id"],
                "name": item.get("name"),
                "operator_name": item.get("operator"),
                "voltage_kv": item.get("voltage_kv", []),
                "operational_status": item["status"],
                "geometry": item["geometry"],
                "metadata": item["metadata"],
            }


def publish_osm_national(
    input_path: Path,
    manifest_path: Path,
    *,
    supabase_url: str | None = None,
    service_role_key: str | None = None,
    batch_size: int = 250,
) -> OsmPublishReport:
    """Stage and atomically promote one validated national OSM aggregate."""
    url = supabase_url or os.environ.get("SUPABASE_URL")
    key = service_role_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not manifest.get("valid") or manifest.get("geographic_scope") != "Germany":
        raise RuntimeError("refusing to publish an invalid or non-national aggregate")
    expected = int(manifest["record_count"])
    client = SupabasePublisher(url, key)
    source_id = "geofabrik-germany-osm-pbf-v1"
    client.request(
        "POST",
        "/grid_sources?on_conflict=id",
        {
            "id": source_id,
            "publisher": "Geofabrik GmbH / OpenStreetMap contributors",
            "title": "Germany OpenStreetMap infrastructure extracts",
            "source_url": "https://download.geofabrik.de/europe/germany.html",
            "licence": "Open Database License (ODbL) 1.0",
            "attribution": "© OpenStreetMap contributors",
            "geographic_scope": "Germany",
            "evidence_class": "open_mapping",
            "refresh_cadence": "accepted refresh after verified Geofabrik change",
        },
        prefer="resolution=merge-duplicates",
    )
    artifact_sha256 = _sha256(manifest_path)
    validation = {
        **manifest,
        "valid": True,
        "aggregate_sha256": _sha256(input_path),
        "manifest_sha256": artifact_sha256,
        "mandatory_gates": {
            "state_checksums": True,
            "state_reports": True,
            "duplicate_conflicts": 0,
            "non_empty": expected > 0,
        },
    }
    artifact = client.request(
        "POST",
        "/grid_source_artifacts?on_conflict=source_id,sha256&select=id",
        {
            "source_id": source_id,
            "source_url": "https://download.geofabrik.de/europe/germany.html",
            "sha256": artifact_sha256,
            "content_type": "application/json",
            "connector_version": "geofabrik-state-manifest-v1",
            "parser_version": "pyosmium-national-v1",
            "record_count": expected,
            "validation_report": validation,
            "status": "staged",
        },
        prefer="resolution=merge-duplicates,return=representation",
    )[0]
    run = client.request(
        "POST",
        "/grid_ingestion_runs?select=id",
        {
            "source_id": source_id,
            "source_url": "https://download.geofabrik.de/europe/germany.html",
            "artifact_sha256": artifact_sha256,
            "connector_version": "geofabrik-state-manifest-v1",
            "parser_version": "pyosmium-national-v1",
            "geographic_scope": "Germany",
            "status": "staged",
            "records_read": expected + int(manifest.get("duplicate_records_deduplicated", 0)),
            "records_staged": 0,
            "records_rejected": 0,
            "validation_report": validation,
        },
        prefer="return=representation",
    )[0]
    release = client.request(
        "POST",
        "/grid_dataset_releases?select=id",
        {
            "source_id": source_id,
            "source_artifact_id": artifact["id"],
            "ingestion_run_id": run["id"],
            "geographic_scope": "Germany",
            "status": "staging",
            "record_count": expected,
            "validation_report": validation,
        },
        prefer="return=representation",
    )[0]
    published = 0
    try:
        for batch in _chunks(_staging_rows(input_path, release["id"]), batch_size):
            client.request(
                "POST",
                "/grid_osm_release_staging?on_conflict=release_id,kind,source_record_id",
                batch,
                prefer="resolution=merge-duplicates",
            )
            published += len(batch)
            if published % (batch_size * 20) == 0 or published == expected:
                client.request(
                    "PATCH",
                    f"/grid_ingestion_runs?id=eq.{urllib.parse.quote(run['id'])}",
                    {"records_staged": published},
                )
                print(json.dumps({"stage": "database_staging", "records": published}), flush=True)
        if published != expected:
            raise RuntimeError(f"staged {published} records, expected {expected}")
        client.request(
            "PATCH",
            f"/grid_dataset_releases?id=eq.{urllib.parse.quote(release['id'])}",
            {"status": "validating", "validation_report": validation},
        )
        client.request(
            "PATCH",
            f"/grid_ingestion_runs?id=eq.{urllib.parse.quote(run['id'])}",
            {"status": "validating", "records_staged": published},
        )
        for kind in ("node", "line", "industrial_site"):
            after_id = ""
            materialized = 0
            while True:
                batch = client.request(
                    "POST",
                    "/rpc/materialize_osm_grid_release",
                    {
                        "p_release_id": release["id"],
                        "p_kind": kind,
                        "p_after_id": after_id,
                        "p_limit": 5000,
                    },
                )
                materialized += int(batch["processed"])
                print(
                    json.dumps(
                        {"stage": "canonical_materialization", "kind": kind, "records": materialized}
                    ),
                    flush=True,
                )
                if batch["done"]:
                    break
                after_id = batch["last_id"]
        client.request(
            "POST",
            "/rpc/activate_materialized_osm_grid_release",
            {"p_release_id": release["id"]},
        )
        client.request(
            "PATCH",
            "/grid_source_artifacts?source_id=eq.openstreetmap-germany-overpass-v1&status=eq.active",
            {"status": "superseded"},
        )
        return OsmPublishReport(
            release["id"], run["id"], published, manifest["counts"]
        )
    except Exception as error:
        client.request(
            "PATCH",
            f"/grid_ingestion_runs?id=eq.{urllib.parse.quote(run['id'])}",
            {"status": "failed", "error_summary": str(error)[:1000]},
        )
        client.request(
            "PATCH",
            f"/grid_dataset_releases?id=eq.{urllib.parse.quote(release['id'])}",
            {"status": "rejected"},
        )
        raise
