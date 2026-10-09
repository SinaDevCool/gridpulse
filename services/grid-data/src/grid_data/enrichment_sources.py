from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .publish import SupabasePublisher, _chunks

SOURCE_CONFIG = {
    "bkg_admin": {
        "publisher": "Bundesamt für Kartographie und Geodäsie (BKG)",
        "source_url": "https://sgx.geodatenzentrum.de/wfs_vg250",
        "licence": "Datenlizenz Deutschland – Namensnennung – Version 2.0",
        "table": "administrative_areas",
    },
    "bfn_protected": {
        "publisher": "Bundesamt für Naturschutz (BfN)",
        "source_url": "https://geodienste.bfn.de/schutzgebiete",
        "licence": "See source metadata and release attribution",
        "table": "protected_areas",
    },
    "bkg_heavy_rain": {
        "publisher": "Bundesamt für Kartographie und Geodäsie (BKG)",
        "source_url": "https://www.bkg.bund.de/DE/Themen/Umwelt-und-Klimawandel/Starkregen/starkregen_cont.html",
        "licence": "See BKG source metadata and disclaimer",
        "table": "heavy_rain_areas",
    },
    "osm_context": {
        "publisher": "OpenStreetMap contributors / Geofabrik GmbH",
        "source_url": "https://download.geofabrik.de/europe/germany.html",
        "licence": "Open Database License (ODbL) 1.0",
        "table": "osm_context_features",
    },
}


@dataclass(frozen=True)
class EnrichmentSourceReport:
    source: str
    records: int
    rejected: int
    sha256: str
    valid: bool


def _record(source: str, feature: dict[str, Any], index: int) -> dict[str, Any]:
    geometry = feature.get("geometry")
    if not isinstance(geometry, dict) or geometry.get("type") not in {
        "Point", "LineString", "MultiLineString", "Polygon", "MultiPolygon"
    }:
        raise ValueError("unsupported or missing geometry")
    properties = feature.get("properties") or {}
    if not isinstance(properties, dict):
        raise TypeError("properties must be an object")
    record_id = str(feature.get("id") or properties.get("id") or properties.get("kennziffer") or index)
    if source in {"bkg_admin", "bfn_protected", "bkg_heavy_rain"}:
        if geometry["type"] == "Polygon":
            geometry = {**geometry, "type": "MultiPolygon", "coordinates": [geometry["coordinates"]]}
        if geometry["type"] != "MultiPolygon":
            raise ValueError(f"{source} requires polygon geometry")
    base = {"source_record_id": record_id, "geometry": geometry, "metadata": properties}
    if source == "bkg_admin":
        official_name = str(
            properties.get("GEN") or properties.get("gen") or properties.get("name") or ""
        ).strip()
        if not official_name:
            raise ValueError("BKG administrative feature is missing its official name")
        return {**base, "level": str(properties.get("level") or "municipality"),
                "official_name": official_name,
                "official_key": properties.get("AGS") or properties.get("ags") or properties.get("ars"),
                "federal_state_name": (
                    properties.get("federal_state")
                    or properties.get("BEZ_LAN")
                    or properties.get("bez_lan")
                ),
                "federal_state_code": properties.get("LKZ") or properties.get("lkz")}
    if source == "bfn_protected":
        return {**base, "category": str(properties.get("category") or properties.get("SGB") or "protected_area"),
                "official_name": properties.get("name") or properties.get("NAME")}
    if source == "bkg_heavy_rain":
        return {**base, "scenario": str(properties.get("scenario") or properties.get("Szenario") or "unknown"),
                "depth_m": properties.get("depth_m") or properties.get("Wassertiefe"),
                "velocity_ms": properties.get("velocity_ms") or properties.get("Fliessgeschwindigkeit")}
    return {**base, "feature_class": str(properties.get("feature_class") or properties.get("class") or "landuse"),
            "name": properties.get("name")}


def normalize_enrichment_geojson(source: str, input_path: Path, output_path: Path) -> EnrichmentSourceReport:
    if source not in SOURCE_CONFIG:
        raise ValueError(f"unsupported enrichment source: {source}")
    raw = input_path.read_bytes()
    payload = json.loads(raw)
    features = payload.get("features") if payload.get("type") == "FeatureCollection" else [payload]
    if not isinstance(features, list) or not features:
        raise ValueError("source must contain at least one GeoJSON feature")
    accepted: list[dict[str, Any]] = []
    rejected = 0
    for index, feature in enumerate(features, start=1):
        try:
            if not isinstance(feature, dict) or feature.get("type") != "Feature":
                raise ValueError("not a GeoJSON feature")
            accepted.append(_record(source, feature, index))
        except (TypeError, ValueError):
            rejected += 1
    if not accepted:
        raise ValueError("all source records were rejected")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="\n") as stream:
        for item in accepted:
            stream.write(json.dumps(item, ensure_ascii=False, separators=(",", ":")) + "\n")
    digest = hashlib.sha256(raw).hexdigest()
    manifest = {
        "source": source, **SOURCE_CONFIG[source], "source_sha256": digest,
        "record_count": len(accepted), "rejected_count": rejected,
        "valid": bool(accepted), "validation": {"non_empty": True, "geojson": True},
    }
    output_path.with_suffix(output_path.suffix + ".manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return EnrichmentSourceReport(source, len(accepted), rejected, digest, True)


def publish_enrichment_release(source: str, input_path: Path, manifest_path: Path,
                               *, batch_size: int = 250) -> dict[str, Any]:
    """Publish a normalized enrichment source through the existing governed release lifecycle."""
    if source not in SOURCE_CONFIG:
        raise ValueError(f"unsupported enrichment source: {source}")
    config = SOURCE_CONFIG[source]
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("source") != source or not manifest.get("valid"):
        raise ValueError("manifest is invalid or belongs to another source")
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    client = SupabasePublisher(url, key)
    source_id = f"{source}-v1"
    domain = {"bkg_admin": "administrative", "osm_context": "built_environment",
              "bfn_protected": "environment", "bkg_heavy_rain": "natural_hazard"}[source]
    client.request("POST", "/grid_sources?on_conflict=id", {
        "id": source_id, "publisher": config["publisher"], "title": source.replace("_", " ").title(),
        "source_url": config["source_url"], "licence": config["licence"],
        "attribution": config["publisher"], "geographic_scope": "Germany",
        "evidence_class": "official_public" if source != "osm_context" else "open_mapping",
        "refresh_cadence": "accepted source release", "dataset_domain": domain,
    }, prefer="resolution=merge-duplicates")
    artifact = client.request("POST", "/grid_source_artifacts?on_conflict=source_id,sha256&select=id", {
        "source_id": source_id, "source_url": config["source_url"], "sha256": manifest["source_sha256"],
        "content_type": "application/geo+json", "connector_version": f"{source}-connector-v1",
        "parser_version": "property-enrichment-normalizer-v1", "record_count": manifest["record_count"],
        "validation_report": manifest, "status": "validated",
    }, prefer="resolution=merge-duplicates,return=representation")[0]
    run = client.request("POST", "/grid_ingestion_runs?select=id", {
        "source_id": source_id, "source_url": config["source_url"], "artifact_sha256": manifest["source_sha256"],
        "connector_version": f"{source}-connector-v1", "parser_version": "property-enrichment-normalizer-v1",
        "geographic_scope": "Germany", "status": "validating", "records_read": manifest["record_count"] + manifest["rejected_count"],
        "records_staged": manifest["record_count"], "records_rejected": manifest["rejected_count"], "validation_report": manifest,
    }, prefer="return=representation")[0]
    release = client.request("POST", "/grid_dataset_releases?select=id", {
        "source_id": source_id, "source_artifact_id": artifact["id"], "ingestion_run_id": run["id"],
        "geographic_scope": "Germany", "status": "validating", "record_count": manifest["record_count"],
        "validation_report": manifest,
    }, prefer="return=representation")[0]
    rows = []
    for line in input_path.read_text(encoding="utf-8").splitlines():
        item = json.loads(line)
        item["dataset_release_id"] = release["id"]
        rows.append(item)
    for batch in _chunks(rows, batch_size):
        client.request("POST", f"/{config['table']}", batch)
    client.request("POST", "/rpc/activate_grid_dataset_release", {"p_release_id": release["id"]})
    client.request("PATCH", f"/grid_source_artifacts?id=eq.{artifact['id']}", {"status": "active"})
    return {"source": source, "release_id": release["id"], "records": len(rows)}
