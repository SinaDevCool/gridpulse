from __future__ import annotations

import hashlib
import json
import zipfile
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

SOURCE_ID = "bnetza-mastr-full-export-v1"
CONNECTOR_VERSION = "mastr-full-export-v1"
PARSER_VERSION = "mastr-xml-26.1-v1"


@dataclass(frozen=True)
class MastrReport:
    asset_count: int
    skipped_count: int
    source_sha256: str
    warnings: tuple[str, ...]


def _asset(member_name: str, fields: dict[str, str]) -> tuple[dict[str, Any], list[str]]:
    warnings: list[str] = []
    record_id = fields["EinheitMastrNummer"]
    latitude = _number(fields.get("Breitengrad"))
    longitude = _number(fields.get("Laengengrad"))
    if latitude is not None and not -90 <= latitude <= 90:
        warnings.append(f"{record_id}: invalid latitude")
        latitude = None
    if longitude is not None and not -180 <= longitude <= 180:
        warnings.append(f"{record_id}: invalid longitude")
        longitude = None
    asset_type = _asset_type(member_name, fields)
    return {
        "source_record_id": record_id,
        "asset_type": asset_type,
        "technology": fields.get("Energietraeger")
        or fields.get("Technologie")
        or fields.get("EinheitTyp"),
        "canonical_name": fields.get("EinheitName")
        or fields.get("NameStromerzeugungseinheit")
        or fields.get("NameStromverbrauchseinheit"),
        "operator_name": fields.get("AnlagenbetreiberName")
        or fields.get("AnlagenbetreiberMastrNummer"),
        "grid_operator_name": fields.get("NetzbetreiberName")
        or fields.get("NetzbetreiberMastrNummer"),
        "net_capacity_mw": _megawatts(
            fields.get("Nettonennleistung")
            or fields.get("Bruttoleistung")
            or fields.get("Nennleistung")
        ),
        "storage_energy_mwh": _megawatts(
            fields.get("NutzbareSpeicherkapazitaet")
            or fields.get("SpeicherNutzbareSpeicherkapazitaet")
        ),
        "operational_status": _status(
            fields.get("BetriebsStatus") or fields.get("EinheitBetriebsstatus")
        ),
        "commissioning_date": fields.get("Inbetriebnahmedatum"),
        "municipality": fields.get("Gemeinde"),
        "postcode": fields.get("Postleitzahl"),
        "federal_state": fields.get("Bundesland") or fields.get("BundeslandName"),
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
    }, warnings


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
    text = (
        f"{member_name} {fields.get('EinheitTyp', '')} {fields.get('Technologie', '')}".casefold()
    )
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


def _records_by_key(stream: Any, key: str) -> Iterator[dict[str, str]]:
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
            if key in fields:
                yield fields
                if len(stack) > 1:
                    stack[-2].remove(element)
                element.clear()
        stack.pop()


def _catalog_values(stream: Any) -> dict[str, str]:
    return {
        fields["Id"]: fields["Wert"]
        for fields in _records_by_key(stream, "Id")
        if fields.get("Wert")
    }


def _electrical_member(name: str) -> bool:
    normalized = Path(name).name.casefold()
    included = (
        "einheitensolar",
        "einheitenwind",
        "einheitenwasser",
        "einheitenbiomasse",
        "einheitenkernkraft",
        "einheitenverbrennung",
        "einheitengeothermie",
        "einheitenstromspeicher",
        "einheitenstromverbraucher",
    )
    return normalized.endswith(".xml") and normalized.startswith(included)


def _resolve_catalog_fields(fields: dict[str, str], catalog: dict[str, str]) -> dict[str, str]:
    resolved = dict(fields)
    for key in (
        "Bundesland",
        "EinheitBetriebsstatus",
        "Energietraeger",
        "Technologie",
        "Netzebene",
    ):
        value = resolved.get(key)
        if value in catalog:
            resolved[key] = catalog[value]
    return resolved


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
                    asset, asset_warnings = _asset(member.filename, fields)
                    warnings.extend(asset_warnings)
                    if asset["latitude"] is None or asset["longitude"] is None:
                        skipped += 1
                    assets.append(asset)

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
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return MastrReport(len(assets), skipped, source_sha256, tuple(warnings))


def stream_mastr_export(
    input_path: Path,
    output_path: Path,
    *,
    federal_state: str | None = None,
    exact_map_points_only: bool = False,
) -> MastrReport:
    """Write newline-delimited records without retaining the full export in memory."""
    source_hash = hashlib.sha256()
    with input_path.open("rb") as source:
        for chunk in iter(lambda: source.read(4 * 1024 * 1024), b""):
            source_hash.update(chunk)
    source_sha256 = source_hash.hexdigest()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    warnings: list[str] = []
    asset_count = 0
    skipped = 0

    metadata = {
        "record_type": "manifest",
        "source_id": SOURCE_ID,
        "publisher": "Bundesnetzagentur · Marktstammdatenregister",
        "source_url": "https://www.marktstammdatenregister.de/MaStR/Datendownload",
        "licence": "Datenlizenz Deutschland – Namensnennung – Version 2.0",
        "geographic_scope": federal_state or "Germany",
        "exact_map_points_only": exact_map_points_only,
        "source_sha256": source_sha256,
        "connector_version": CONNECTOR_VERSION,
        "parser_version": PARSER_VERSION,
        "evidence_boundary": (
            "Registered energy-asset context; never available connection capacity."
        ),
    }
    with output_path.open("w", encoding="utf-8", newline="\n") as output:
        output.write(json.dumps(metadata, ensure_ascii=False, separators=(",", ":")) + "\n")
        with zipfile.ZipFile(input_path) as archive:
            catalog: dict[str, str] = {}
            catalog_member = next(
                (
                    member
                    for member in archive.infolist()
                    if Path(member.filename).name.casefold().startswith("katalogwerte")
                    and member.filename.casefold().endswith(".xml")
                ),
                None,
            )
            if catalog_member:
                with archive.open(catalog_member) as stream:
                    catalog = _catalog_values(stream)
            members = [
                member
                for member in archive.infolist()
                if _electrical_member(member.filename) and not member.is_dir()
            ]
            for member in members:
                with archive.open(member) as stream:
                    for fields in _records(stream):
                        fields = _resolve_catalog_fields(fields, catalog)
                        state = fields.get("Bundesland") or fields.get("BundeslandName")
                        if federal_state and (state or "").casefold() != federal_state.casefold():
                            continue
                        asset, asset_warnings = _asset(member.filename, fields)
                        warnings.extend(asset_warnings)
                        if asset["latitude"] is None or asset["longitude"] is None:
                            skipped += 1
                            if exact_map_points_only:
                                continue
                        if exact_map_points_only and asset["asset_type"] == "consumption":
                            skipped += 1
                            continue
                        output.write(
                            json.dumps(
                                {"record_type": "asset", **asset},
                                ensure_ascii=False,
                                separators=(",", ":"),
                            )
                            + "\n"
                        )
                        asset_count += 1

    report_path = output_path.with_suffix(output_path.suffix + ".report.json")
    report_path.write_text(
        json.dumps(
            {
                **metadata,
                "asset_count": asset_count,
                "skipped_coordinate_count": skipped,
                "warning_count": len(warnings),
                "warnings": warnings[:1000],
                "valid": asset_count > 0,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return MastrReport(asset_count, skipped, source_sha256, tuple(warnings))
