from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .geofabrik import verify_pbf
from .osm import _numbers, _status

PARSER_VERSION = "pyosmium-national-v1"
GERMANY_BOUNDS = (5.8, 47.2, 15.1, 55.2)


@dataclass(frozen=True)
class NationalParseReport:
    records_read: int
    records_staged: int
    records_rejected: int
    counts: dict[str, int]
    valid: bool


def _inside_germany(lon: float, lat: float) -> bool:
    west, south, east, north = GERMANY_BOUNDS
    return west <= lon <= east and south <= lat <= north


def _feature(kind: str, osm_type: str, osm_id: int, tags: dict[str, str], geometry: dict[str, Any]):
    source_record_id = f"osm-{osm_type}-{osm_id}"
    return {
        "kind": kind,
        "source_record_id": source_record_id,
        "name": tags.get("name"),
        "operator": tags.get("operator"),
        "voltage_kv": _numbers(tags.get("voltage")),
        "status": _status(tags),
        "geometry": geometry,
        "metadata": {
            "source_url": f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
            "evidence_class": "open_mapping",
            "capacity_state": "not_established",
            "power": tags.get("power"),
        },
    }


def parse_pbf_to_ndjson(
    input_path: Path, output_path: Path, *, expected_md5: str, geographic_scope: str
) -> NationalParseReport:
    """Stream one verified PBF into canonical NDJSON using pyosmium.

    Locations are retained for referenced way nodes by pyosmium's on-disk index;
    relation areas include assembled multipolygons. Invalid records are reported,
    never silently promoted.
    """
    verify_pbf(input_path, expected_md5)
    try:
        import osmium  # type: ignore[import-not-found]
    except ImportError as error:
        raise RuntimeError("Install grid-data[production] with pyosmium to parse PBF extracts") from error

    output_path.parent.mkdir(parents=True, exist_ok=True)
    rejected_path = output_path.with_suffix(output_path.suffix + ".rejected.ndjson")
    counts: Counter[str] = Counter()
    seen: set[str] = set()
    rejected = 0
    read = 0

    def write_item(item: dict[str, Any], output_stream: Any, rejected_stream: Any) -> None:
        nonlocal rejected, read
        read += 1
        record_id = item["source_record_id"]
        if record_id in seen:
            rejected += 1
            rejected_stream.write(
                json.dumps({"source_record_id": record_id, "reason": "duplicate_source_id"})
                + "\n"
            )
            return
        seen.add(record_id)
        counts[item["kind"]] += 1
        output_stream.write(json.dumps(item, ensure_ascii=False, separators=(",", ":")) + "\n")

    accepted_tags = osmium.filter.TagFilter(
        ("power", "substation"),
        ("power", "line"),
        ("power", "minor_line"),
        ("power", "cable"),
        ("power", "construction"),
        ("power", "proposed"),
        ("construction", "substation"),
        ("construction", "line"),
        ("construction", "minor_line"),
        ("construction", "cable"),
        ("proposed", "substation"),
        ("proposed", "line"),
        ("proposed", "minor_line"),
        ("proposed", "cable"),
        ("landuse", "industrial"),
    )
    area_tags = osmium.filter.TagFilter(("landuse", "industrial"))
    processor = (
        osmium.FileProcessor(str(input_path))
        .with_locations("sparse_file_array")
        .with_areas(area_tags)
        .with_filter(accepted_tags)
    )

    with output_path.open("w", encoding="utf-8") as output_stream, rejected_path.open(
        "w", encoding="utf-8"
    ) as rejected_stream:
        for entity in processor:
            if isinstance(entity, osmium.osm.Node):
                node = entity
                tags = dict(node.tags)
                power = tags.get("power")
                lifecycle = tags.get("construction") or tags.get("proposed")
                if power != "substation" and lifecycle != "substation":
                    continue
                if not node.location.valid() or not _inside_germany(
                    node.location.lon, node.location.lat
                ):
                    continue
                write_item(
                    _feature(
                        "node",
                        "node",
                        node.id,
                        tags,
                        {"type": "Point", "coordinates": [node.location.lon, node.location.lat]},
                    ),
                    output_stream,
                    rejected_stream,
                )
            elif isinstance(entity, osmium.osm.Way):
                way = entity
                tags = dict(way.tags)
                power = tags.get("power")
                lifecycle = tags.get("construction") or tags.get("proposed")
                effective = lifecycle if power in {"construction", "proposed"} else power
                points = [[node.lon, node.lat] for node in way.nodes if node.location.valid()]
                item = None
                if effective == "substation" and len(points) >= 4:
                    lon = sum(point[0] for point in points) / len(points)
                    lat = sum(point[1] for point in points) / len(points)
                    if _inside_germany(lon, lat):
                        item = _feature(
                            "node",
                            "way",
                            way.id,
                            tags,
                            {"type": "Point", "coordinates": [lon, lat]},
                        )
                elif effective in {"line", "minor_line", "cable"} and len(points) >= 2:
                    item = _feature(
                        "line",
                        "way",
                        way.id,
                        tags,
                        {"type": "MultiLineString", "coordinates": [points]},
                    )
                elif tags.get("landuse") == "industrial" and len(points) >= 4:
                    if points[0] != points[-1]:
                        points.append(points[0])
                    item = _feature(
                        "industrial_site",
                        "way",
                        way.id,
                        tags,
                        {"type": "MultiPolygon", "coordinates": [[points]]},
                    )
                if item:
                    write_item(item, output_stream, rejected_stream)
            elif isinstance(entity, osmium.osm.Area) and not entity.from_way():
                tags = dict(entity.tags)
                try:
                    geometry = json.loads(
                        osmium.geom.GeoJSONFactory().create_multipolygon(entity)
                    )
                except (RuntimeError, ValueError):
                    continue
                write_item(
                    _feature("industrial_site", "relation", entity.orig_id(), tags, geometry),
                    output_stream,
                    rejected_stream,
                )
    staged = sum(counts.values())
    valid = staged > 0 and rejected == 0
    report = {
        "schema_version": "gridpulse-osm-state-release-v1",
        "source_id": "geofabrik-germany-osm-pbf-v1",
        "geographic_scope": geographic_scope,
        "source_md5": expected_md5.lower(),
        "parser_version": PARSER_VERSION,
        "parsed_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "records_read": read,
        "records_staged": staged,
        "records_rejected": rejected,
        "counts": dict(counts),
        "valid": valid,
        "mandatory_gates": {"checksum": True, "non_empty": staged > 0, "duplicate_source_ids": rejected == 0},
    }
    output_path.with_suffix(output_path.suffix + ".report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return NationalParseReport(read, staged, rejected, dict(counts), valid)


def combine_state_releases(inputs: Iterable[Path], output_path: Path) -> dict[str, Any]:
    """Combine only accepted state reports into an idempotent national manifest."""
    states = []
    ids: dict[str, str] = {}
    totals: Counter[str] = Counter()
    duplicate_count = 0
    aggregate_path = output_path.with_suffix(".ndjson")
    aggregate_path.parent.mkdir(parents=True, exist_ok=True)
    aggregate = aggregate_path.open("w", encoding="utf-8")
    try:
        for path in sorted(inputs):
            report = json.loads(
                path.with_suffix(path.suffix + ".report.json").read_text(encoding="utf-8")
            )
            if not report.get("valid"):
                raise ValueError(f"state release is not accepted: {path}")
            with path.open(encoding="utf-8") as stream:
                for line in stream:
                    item = json.loads(line)
                    record_id = item["source_record_id"]
                    digest = hashlib.sha256(
                        json.dumps(
                            item, ensure_ascii=False, sort_keys=True, separators=(",", ":")
                        ).encode("utf-8")
                    ).hexdigest()
                    existing = ids.get(record_id)
                    if existing:
                        if existing != digest:
                            raise ValueError(
                                f"conflicting duplicate source ID across state releases: {record_id}"
                            )
                        duplicate_count += 1
                        continue
                    ids[record_id] = digest
                    totals[item["kind"]] += 1
                    aggregate.write(line)
            states.append(
                {
                    "scope": report["geographic_scope"],
                    "source_md5": report["source_md5"],
                    "records": report["records_staged"],
                }
            )
    finally:
        aggregate.close()
    manifest = {
        "schema_version": "gridpulse-osm-national-release-v1",
        "geographic_scope": "Germany",
        "state_releases": states,
        "counts": dict(totals),
        "record_count": sum(totals.values()),
        "duplicate_records_deduplicated": duplicate_count,
        "aggregate_path": str(aggregate_path),
        "valid": len(states) > 0,
    }
    output_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def write_copy_files(input_path: Path, output_dir: Path) -> dict[str, int]:
    """Create PostgreSQL COPY-ready files; no per-feature INSERT migration."""
    output_dir.mkdir(parents=True, exist_ok=True)
    handles = {kind: (output_dir / f"{kind}.tsv").open("w", encoding="utf-8", newline="") for kind in ("node", "line", "industrial_site")}
    writers = {kind: csv.writer(handle, delimiter="\t", lineterminator="\n", quoting=csv.QUOTE_MINIMAL) for kind, handle in handles.items()}
    counts: Counter[str] = Counter()
    try:
        with input_path.open(encoding="utf-8") as stream:
            for line in stream:
                item = json.loads(line)
                kind = item["kind"]
                writers[kind].writerow([item["source_record_id"], item.get("name") or "", item.get("operator") or "", json.dumps(item.get("voltage_kv", [])), item["status"], json.dumps(item["geometry"], separators=(",", ":")), json.dumps(item["metadata"], separators=(",", ":"))])
                counts[kind] += 1
    finally:
        for handle in handles.values():
            handle.close()
    return dict(counts)
