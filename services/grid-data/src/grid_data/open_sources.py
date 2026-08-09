"""Governed adapters for free German/European context sources.

These records enrich investigation priority. They never represent nodal headroom.
"""

from __future__ import annotations

import csv
import hashlib
import io
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass(frozen=True)
class AcceptedSourceArtifact:
    source_release_id: str
    origin: str
    publisher: str
    source_url: str
    licence: str
    retrieved_at: str
    artifact_sha256: str
    parser_version: str
    geographic_scope: str
    evidence_boundary: str


def artifact_manifest(
    content: bytes,
    *,
    source_release_id: str,
    publisher: str,
    source_url: str,
    licence: str,
    parser_version: str,
    geographic_scope: str,
    evidence_boundary: str,
) -> AcceptedSourceArtifact:
    if not content or not source_url or not licence:
        raise ValueError("Source artefact, URL and licence are required before acceptance.")
    return AcceptedSourceArtifact(
        source_release_id=source_release_id,
        origin="official_open",
        publisher=publisher,
        source_url=source_url,
        licence=licence,
        retrieved_at=datetime.now(timezone.utc).isoformat(),
        artifact_sha256=hashlib.sha256(content).hexdigest(),
        parser_version=parser_version,
        geographic_scope=geographic_scope,
        evidence_boundary=evidence_boundary,
    )


def parse_entsoe_timeseries(content: bytes) -> list[dict[str, Any]]:
    """Parse ENTSO-E Publication_MarketDocument period points without guessing units."""
    root = ET.fromstring(content)
    namespace = root.tag.split("}")[0].lstrip("{") if "}" in root.tag else ""
    prefix = f"{{{namespace}}}" if namespace else ""
    rows: list[dict[str, Any]] = []
    for series in root.findall(f".//{prefix}TimeSeries"):
        series_id = series.findtext(f"{prefix}mRID")
        for period in series.findall(f"{prefix}Period"):
            start = period.findtext(f"{prefix}timeInterval/{prefix}start")
            resolution = period.findtext(f"{prefix}resolution")
            for point in period.findall(f"{prefix}Point"):
                rows.append(
                    {
                        "series_id": series_id,
                        "period_start": start,
                        "resolution": resolution,
                        "position": int(point.findtext(f"{prefix}position", "0")),
                        "quantity": float(point.findtext(f"{prefix}quantity", "nan")),
                    }
                )
    if not rows or any(row["position"] < 1 for row in rows):
        raise ValueError("ENTSO-E document contains no valid positioned observations.")
    return rows


def parse_vnbdigital_operator_csv(content: bytes) -> list[dict[str, Any]]:
    """Parse an exported/reviewed VNBdigital operator-area crosswalk.

    The adapter deliberately stores operator identity and coverage only; it does
    not infer ownership of a particular asset or connection availability.
    """
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    required = {"operator_name", "region_code", "source_url"}
    if not reader.fieldnames or not required.issubset(reader.fieldnames):
        raise ValueError("VNBdigital export is missing required operator crosswalk fields.")
    rows = []
    for raw in reader:
        if not raw["operator_name"].strip() or not raw["region_code"].strip():
            continue
        rows.append(
            {
                "operator_name": raw["operator_name"].strip(),
                "region_code": raw["region_code"].strip(),
                "source_url": raw["source_url"].strip(),
                "match_method": "published_region_crosswalk",
                "capacity_claim": False,
            }
        )
    if not rows:
        raise ValueError("VNBdigital export contains no usable operator rows.")
    return rows
