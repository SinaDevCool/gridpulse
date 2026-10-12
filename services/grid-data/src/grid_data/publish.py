from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class PublishReport:
    release_id: str
    ingestion_run_id: str
    records_published: int


class SupabasePublisher:
    def __init__(self, url: str, service_role_key: str) -> None:
        self.base_url = url.rstrip("/") + "/rest/v1"
        self.headers = {
            "apikey": service_role_key,
            "authorization": f"Bearer {service_role_key}",
            "content-type": "application/json",
        }

    def request(
        self,
        method: str,
        path: str,
        payload: Any | None = None,
        *,
        prefer: str | None = None,
    ) -> Any:
        headers = dict(self.headers)
        if prefer:
            headers["prefer"] = prefer
        body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(
            self.base_url + path,
            data=body,
            headers=headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                content = response.read()
                return json.loads(content) if content else None
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Supabase publication failed ({error.code}): {detail}") from error


def _chunks(records: Iterator[dict[str, Any]], size: int) -> Iterator[list[dict[str, Any]]]:
    batch: list[dict[str, Any]] = []
    for record in records:
        batch.append(record)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch


def _valid_date(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value[:10]).isoformat()
    except ValueError:
        return None


def _asset_rows(path: Path, release_id: str, artifact_id: str) -> Iterator[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as stream:
        next(stream)
        for line in stream:
            record = json.loads(line)
            if record.get("record_type") != "asset":
                continue
            longitude = record.get("longitude")
            latitude = record.get("latitude")
            geometry = (
                f"SRID=4326;POINT({longitude} {latitude})"
                if longitude is not None and latitude is not None
                else None
            )
            yield {
                "source_id": "bnetza-mastr-full-export-v1",
                "source_artifact_id": artifact_id,
                "dataset_release_id": release_id,
                "source_record_id": record["source_record_id"],
                "asset_type": record.get("asset_type", "unknown"),
                "technology": record.get("technology"),
                "canonical_name": record.get("canonical_name"),
                "operator_name": record.get("operator_name"),
                "grid_operator_name": record.get("grid_operator_name"),
                "net_capacity_mw": record.get("net_capacity_mw"),
                "storage_energy_mwh": record.get("storage_energy_mwh"),
                "operational_status": record.get("operational_status", "unknown"),
                "commissioning_date": _valid_date(record.get("commissioning_date")),
                "municipality": record.get("municipality"),
                "postcode": record.get("postcode"),
                "federal_state": record.get("federal_state"),
                "geometry": geometry,
                "location_precision": record.get("location_precision", "regional"),
                "metadata": {
                    "evidence_class": "official_regulatory",
                    "capacity_state": "registered_asset_context",
                    "source_url": ("https://www.marktstammdatenregister.de/MaStR/Datendownload"),
                },
            }


def publish_mastr_ndjson(
    input_path: Path,
    *,
    supabase_url: str | None = None,
    service_role_key: str | None = None,
    batch_size: int = 500,
) -> PublishReport:
    url = supabase_url or os.environ.get("SUPABASE_URL")
    key = service_role_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    report = json.loads(
        input_path.with_suffix(input_path.suffix + ".report.json").read_text(encoding="utf-8")
    )
    if not report.get("valid"):
        raise RuntimeError("refusing to publish a release that did not pass validation")
    client = SupabasePublisher(url, key)
    source_id = report["source_id"]
    client.request(
        "POST",
        "/grid_sources?on_conflict=id",
        {
            "id": source_id,
            "publisher": report["publisher"],
            "title": "MaStR public full export",
            "source_url": report["source_url"],
            "licence": report["licence"],
            "attribution": "Datenquelle: Marktstammdatenregister (MaStR), Bundesnetzagentur",
            "geographic_scope": report["geographic_scope"],
            "evidence_class": "official_regulatory",
            "refresh_cadence": "daily export; accepted release on verified change",
        },
        prefer="resolution=merge-duplicates",
    )
    artifact = client.request(
        "POST",
        "/grid_source_artifacts?on_conflict=source_id,sha256&select=id",
        {
            "source_id": source_id,
            "source_url": report["source_url"],
            "sha256": report["source_sha256"],
            "content_type": "application/zip",
            "connector_version": report["connector_version"],
            "parser_version": report["parser_version"],
            "record_count": report["asset_count"],
            "validation_report": report,
            "status": "staged",
        },
        prefer="resolution=merge-duplicates,return=representation",
    )[0]
    run = client.request(
        "POST",
        "/grid_ingestion_runs?select=id",
        {
            "source_id": source_id,
            "source_url": report["source_url"],
            "artifact_sha256": report["source_sha256"],
            "connector_version": report["connector_version"],
            "parser_version": report["parser_version"],
            "geographic_scope": report["geographic_scope"],
            "status": "staged",
            "records_read": report["asset_count"],
            "records_staged": 0,
            "records_rejected": report["skipped_coordinate_count"],
            "validation_report": report,
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
            "geographic_scope": report["geographic_scope"],
            "status": "staging",
            "record_count": report["asset_count"],
            "validation_report": report,
        },
        prefer="return=representation",
    )[0]

    published = 0
    for batch in _chunks(
        _asset_rows(input_path, release["id"], artifact["id"]),
        batch_size,
    ):
        client.request(
            "POST",
            "/canonical_energy_assets?on_conflict=source_id,source_record_id",
            batch,
            prefer="resolution=merge-duplicates",
        )
        published += len(batch)
        if published % (batch_size * 10) == 0 or published == report["asset_count"]:
            client.request(
                "PATCH",
                f"/grid_ingestion_runs?id=eq.{urllib.parse.quote(run['id'])}",
                {"records_staged": published},
            )

    valid = published == report["asset_count"]
    validation = {**report, "valid": valid, "published_count": published}
    client.request(
        "PATCH",
        f"/grid_dataset_releases?id=eq.{urllib.parse.quote(release['id'])}",
        {"status": "validating" if valid else "rejected", "validation_report": validation},
    )
    client.request(
        "PATCH",
        f"/grid_ingestion_runs?id=eq.{urllib.parse.quote(run['id'])}",
        {
            "status": "validating" if valid else "rejected",
            "validation_report": validation,
        },
    )
    if not valid:
        raise RuntimeError(f"staged {published} records, expected {report['asset_count']}")
    client.request("POST", "/rpc/activate_grid_dataset_release", {"p_release_id": release["id"]})
    client.request(
        "PATCH",
        (
            f"/grid_source_artifacts?source_id=eq.{urllib.parse.quote(source_id)}"
            f"&id=neq.{urllib.parse.quote(artifact['id'])}&status=eq.active"
        ),
        {"status": "superseded"},
    )
    client.request(
        "PATCH",
        f"/grid_source_artifacts?id=eq.{urllib.parse.quote(artifact['id'])}",
        {"status": "active"},
    )
    offset = 0
    while offset < 10_000:
        try:
            refreshed = client.request(
                "POST",
                "/rpc/refresh_grid_node_asset_context_batch",
                {"p_offset": offset, "p_limit": 25},
            )
        except RuntimeError:
            # Spatial context is derived and resumable. A timeout here must not
            # misreport an already reconciled and atomically activated release.
            break
        if not refreshed:
            break
        offset += 25
    return PublishReport(release["id"], run["id"], published)
