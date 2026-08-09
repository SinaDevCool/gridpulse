from __future__ import annotations

import hashlib
import json
import re
import urllib.parse
import urllib.request
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter"
CONNECTOR_VERSION = "osm-overpass-v1"
PARSER_VERSION = "osm-geojson-v2-voltage-units"


@dataclass(frozen=True)
class OsmBuildReport:
    feature_count: int
    raw_sha256: str
    output_sha256: str
    warnings: tuple[str, ...]


def build_overpass_query(bbox: tuple[float, float, float, float]) -> str:
    south, west, north, east = bbox
    bounds = f"{south},{west},{north},{east}"
    return f"""[out:json][timeout:120];
(
  nwr["power"="substation"]({bounds});
  way["power"~"^(line|minor_line|cable)$"]({bounds});
  way["landuse"="industrial"]({bounds});
);
out tags geom;"""


def fetch_overpass(
    bbox: tuple[float, float, float, float],
    *,
    endpoint: str = DEFAULT_OVERPASS_URL,
    timeout: int = 180,
) -> bytes:
    encoded = urllib.parse.urlencode({"data": build_overpass_query(bbox)}).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=encoded,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "GridPulse grid-data connector/0.2 (+https://gridpulseinsights.com)",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def _numbers(value: str | None) -> list[float]:
    """Parse OSM power voltage values into kV.

    OSM's power schema stores unitless voltage values in volts. Explicit V/kV
    suffixes are accepted for defensive ingestion, but ambiguous text is ignored.
    """
    if not value:
        return []
    numbers: set[float] = set()
    for token in value.replace(",", ";").split(";"):
        match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*(kv|v)?\s*", token, re.IGNORECASE)
        if not match:
            continue
        raw = float(match.group(1))
        unit = (match.group(2) or "v").lower()
        kv = raw if unit == "kv" else raw / 1000
        if kv > 0:
            numbers.add(round(kv, 3))
    return sorted(numbers, reverse=True)


def _status(tags: dict[str, str]) -> str:
    lifecycle = tags.get("construction") or tags.get("proposed")
    if tags.get("construction") or tags.get("power") == "construction":
        return "construction"
    if tags.get("proposed") or tags.get("power") == "proposed":
        return "planned"
    if lifecycle in {"substation", "line", "minor_line", "cable"}:
        return "planned"
    return "operational"


def _geometry_points(element: dict[str, Any]) -> list[list[float]]:
    return [
        [float(point["lon"]), float(point["lat"])]
        for point in element.get("geometry", [])
        if "lon" in point and "lat" in point
    ]


def _centroid(points: Iterable[list[float]]) -> list[float]:
    values = list(points)
    return [
        sum(point[0] for point in values) / len(values),
        sum(point[1] for point in values) / len(values),
    ]


def overpass_to_geojson(
    payload: dict[str, Any],
    *,
    source_url: str,
    retrieved_at: str,
    raw_sha256: str,
) -> tuple[dict[str, Any], tuple[str, ...]]:
    features: list[dict[str, Any]] = []
    warnings: list[str] = []

    for element in payload.get("elements", []):
        tags = element.get("tags") or {}
        osm_type = str(element.get("type", "unknown"))
        osm_id = str(element.get("id", ""))
        record_id = f"osm-{osm_type}-{osm_id}"
        power = tags.get("power")
        points = _geometry_points(element)
        geometry: dict[str, Any] | None = None
        kind: str | None = None

        if power == "substation":
            if osm_type == "node" and "lon" in element and "lat" in element:
                coordinates = [float(element["lon"]), float(element["lat"])]
            elif points:
                coordinates = _centroid(points)
            else:
                warnings.append(f"{record_id}: substation has no usable geometry")
                continue
            kind = "node"
            geometry = {"type": "Point", "coordinates": coordinates}
        elif power in {"line", "minor_line", "cable"}:
            if len(points) < 2:
                warnings.append(f"{record_id}: line has fewer than two points")
                continue
            kind = "line"
            geometry = {"type": "LineString", "coordinates": points}
        elif tags.get("landuse") == "industrial":
            if len(points) < 4:
                warnings.append(f"{record_id}: industrial area has insufficient geometry")
                continue
            if points[0] != points[-1]:
                points.append(points[0])
            kind = "industrial_site"
            geometry = {"type": "Polygon", "coordinates": [points]}
        else:
            continue

        features.append(
            {
                "type": "Feature",
                "id": record_id,
                "geometry": geometry,
                "properties": {
                    "kind": kind,
                    "name": tags.get("name") or f"Mapped {kind.replace('_', ' ')} {osm_id}",
                    "operator": tags.get("operator"),
                    "voltage_kv": _numbers(tags.get("voltage")),
                    "voltage_evidence_status": (
                        "accepted" if _numbers(tags.get("voltage")) else "missing"
                    ),
                    "status": _status(tags),
                    "evidence_class": "open_mapping",
                    "capacity_state": "not_established",
                    "site_kind": "industrial_land" if kind == "industrial_site" else None,
                    "planning_status": "screening_only" if kind == "industrial_site" else None,
                    "source_record_id": record_id,
                    "source_url": f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
                    "raw_tags": tags,
                },
            }
        )

    collection: dict[str, Any] = {
        "type": "FeatureCollection",
        "metadata": {
            "title": "OpenStreetMap grid and industrial screening context",
            "source_id": "openstreetmap-germany-overpass-v1",
            "publisher": "OpenStreetMap contributors",
            "licence": "Open Data Commons Open Database License (ODbL) 1.0",
            "attribution": "© OpenStreetMap contributors",
            "published_at": retrieved_at,
            "geographic_scope": "Requested German bounding box",
            "freshness": f"retrieved {retrieved_at}",
            "raw_artifact_sha256": raw_sha256,
            "source_url": source_url,
            "connector_version": CONNECTOR_VERSION,
            "parser_version": PARSER_VERSION,
            "record_count": len(features),
            "evidence_boundary": (
                "Open mapping for early screening only. Completeness, voltage, operator identity, "
                "operational state, available capacity, connection feasibility and dates require "
                "confirmation from authoritative sources and the responsible network operator."
            ),
        },
        "features": features,
    }
    return collection, tuple(warnings)


def build_osm_artifact(
    output_path: Path,
    *,
    bbox: tuple[float, float, float, float],
    raw_path: Path | None = None,
    endpoint: str = DEFAULT_OVERPASS_URL,
) -> OsmBuildReport:
    raw = raw_path.read_bytes() if raw_path else fetch_overpass(bbox, endpoint=endpoint)
    raw_sha256 = hashlib.sha256(raw).hexdigest()
    payload = json.loads(raw)
    retrieved_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    collection, warnings = overpass_to_geojson(
        payload,
        source_url=endpoint,
        retrieved_at=retrieved_at,
        raw_sha256=raw_sha256,
    )
    canonical = json.dumps(
        collection, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    output_sha256 = hashlib.sha256(canonical).hexdigest()
    collection["metadata"]["artifact_sha256"] = output_sha256
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(collection, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return OsmBuildReport(len(collection["features"]), raw_sha256, output_sha256, warnings)
