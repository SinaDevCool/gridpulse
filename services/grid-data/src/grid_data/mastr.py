from __future__ import annotations

import hashlib
import json
import xml.etree.ElementTree as ElementTree
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


SOURCE_ID = "bnetza-mastr-full-export-v1"
CONNECTOR_VERSION = "mastr-full-export-v1"
PARSER_VERSION = "mastr-xml-26.1-v1"


@dataclass(frozen=True)
class MastrReport:
    asset_count: int
    skipped_count: int
    source_sha256: str
    warnings: tuple[str, ...]


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _number(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return float(value.replace(",", "."))
    except ValueError:
        return None


def _megawatts(value: str | None) -> float | None:
    number = _number(value)
    if number is None:
        return None
    return round(number / 1000, 6)


def _status(value: str | None) -> str:
    normalized = (value or "").casefold()
    if "betrieb" in normalized and "nicht" not in normalized:
        return "operational"
    if "planung" in normalized or "geplant" in normalized:
        return "planned"
    if "bau" in normalized:
        return "construction"
    if "still" in normalized or "außer" in normalized:
        return "out_of_service"
    return "unknown"


def _asset_type(member_name: str, fields: dict[str, str]) -> str:
    text = f"{member_name} {fields.get('EinheitTyp', '')} {fields.get('Technologie', '')}".casefold()
    if "speicher" in text:
        return "storage"
    if "verbrauch" in text:
        return "consumption"
    return "generation"


def _records(stream: Any) -> Iterator[dict[str, str]]:
    stack: list[ElementTree.Element] = []
    for event, element in ElementTree.iterparse(stream, events=("start", "end")):
        if event == "start":
            stack.append(element)
            continue
        children = list(element)
        if children:
            fields = {
                _local_name(child.tag): (child.text or "").strip()
                for child in children
                if child.text
            }
            if "EinheitMastrNummer" in fields:
                yield fields
                if len(stack) > 1:
                    stack[-2].remove(element)
                element.clear()
        stack.pop()


def parse_mastr_export(
    input_path: Path,
    output_path: Path,
    *,
    federal_state: str | None = None,
) -> MastrReport:
    source_hash = hashlib.sha256()
    with input_path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            source_hash.update(chunk)
    source_sha256 = source_hash.hexdigest()
    assets: list[dict[str, Any]] = []
    warnings: list[str] = []
    skipped = 0

    with zipfile.ZipFile(input_path) as archive:
        members = [
            member
            for member in archive.infolist()
            if member.filename.casefold().endswith(".xml") and not member.is_dir()
        ]
        for member in members:
            with archive.open(member) as stream:
                for fields in _records(stream):
                    state = fields.get("Bundesland") or fields.get("BundeslandName")
                    if federal_state and (state or "").casefold() != federal_state.casefold():
                        continue
                    record_id = fields["EinheitMastrNummer"]
                    latitude = _number(fields.get("Breitengrad"))
                    longitude = _number(fields.get("Laengengrad"))
                    if latitude is not None and not -90 <= latitude <= 90:
                        warnings.append(f"{record_id}: invalid latitude")
                        latitude = None
                    if longitude is not None and not -180 <= longitude <= 180:
                        warnings.append(f"{record_id}: invalid longitude")
                        longitude = None
                    if latitude is None or longitude is None:
                        skipped += 1

                    asset_type = _asset_type(member.filename, fields)
                    assets.append(
                        {
                            "source_record_id": record_id,
                            "asset_type": asset_type,
                            "technology": fields.get("Energietraeger")
                            or fields.get("Technologie")
                            or fields.get("EinheitTyp"),
                            "canonical_name": fields.get("EinheitName"),
                            "operator_name": fields.get("AnlagenbetreiberName"),
                            "grid_operator_name": fields.get("NetzbetreiberName"),
                            "net_capacity_mw": _megawatts(
                                fields.get("Nettonennleistung")
                                or fields.get("Bruttoleistung")
                                or fields.get("Nennleistung")
                            ),
                            "storage_energy_mwh": _megawatts(
                                fields.get("NutzbareSpeicherkapazitaet")
                                or fields.get("SpeicherNutzbareSpeicherkapazitaet")
                            ),
                            "operational_status": _status(fields.get("BetriebsStatus")),
                            "commissioning_date": fields.get("Inbetriebnahmedatum"),
                            "municipality": fields.get("Gemeinde"),
                            "postcode": fields.get("Postleitzahl"),
                            "federal_state": state,
                            "longitude": longitude,
                            "latitude": latitude,
                            "location_precision": (
                                "mapped"
                                if latitude is not None and longitude is not None
                                else "municipality"
                                if fields.get("Gemeinde")
                                else "withheld"
                            ),
                            "raw": fields,
                        }
                    )

    retrieved_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    payload = {
        "metadata": {
            "source_id": SOURCE_ID,
            "publisher": "Bundesnetzagentur · Marktstammdatenregister",
            "title": "MaStR public full export",
            "source_url": "https://www.marktstammdatenregister.de/MaStR/Datendownload",
            "licence": "Datenlizenz Deutschland – Namensnennung – Version 2.0",
            "attribution": "Datenquelle: Marktstammdatenregister (MaStR), Bundesnetzagentur",
            "geographic_scope": federal_state or "Germany",
            "published_at": retrieved_at,
            "source_sha256": source_sha256,
            "connector_version": CONNECTOR_VERSION,
            "parser_version": PARSER_VERSION,
            "record_count": len(assets),
            "evidence_boundary": (
                "Registered energy-asset context. Unit capacity is not available grid capacity "
                "and does not establish connection feasibility at any node."
            ),
        },
        "assets": assets,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return MastrReport(len(assets), skipped, source_sha256, tuple(warnings))
