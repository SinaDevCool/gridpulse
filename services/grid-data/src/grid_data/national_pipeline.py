from __future__ import annotations

import json
import os
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .download import download_artifact
from .geofabrik import discover_state_manifest, verify_pbf
from .national_release import parse_pbf_to_ndjson, write_copy_files


@dataclass(frozen=True)
class PipelineResult:
    work_dir: str
    extracts: int
    records: int
    counts: dict[str, int]
    valid: bool


def _download_one(item: dict[str, Any], raw_dir: Path) -> str:
    target = raw_dir / f"{item['slug']}.osm.pbf"
    if target.exists():
        verify_pbf(target, item["expected_md5"])
        return item["slug"]
    download_artifact(item["url"], target, attempts=8, timeout_seconds=300)
    verify_pbf(target, item["expected_md5"])
    return item["slug"]


def _parse_one(item: dict[str, Any], raw_dir: Path, parsed_dir: Path) -> dict[str, Any]:
    target = parsed_dir / f"{item['slug']}.ndjson"
    report_path = target.with_suffix(target.suffix + ".report.json")
    if report_path.exists():
        existing = json.loads(report_path.read_text(encoding="utf-8"))
        if existing.get("valid") and existing.get("source_md5") == item["expected_md5"]:
            return existing
    report = parse_pbf_to_ndjson(
        raw_dir / f"{item['slug']}.osm.pbf",
        target,
        expected_md5=item["expected_md5"],
        geographic_scope=", ".join(item["federal_states"]),
    )
    if not report.valid:
        raise RuntimeError(f"{item['slug']} failed mandatory parse gates")
    return json.loads(report_path.read_text(encoding="utf-8"))


def run_national_pipeline(
    work_dir: Path,
    *,
    download_workers: int = 6,
    parse_workers: int = 3,
) -> PipelineResult:
    """Run the restartable national preparation path with bounded concurrency."""
    work_dir = work_dir.resolve()
    raw_dir = work_dir / "raw"
    parsed_dir = work_dir / "parsed"
    copy_dir = work_dir / "copy"
    for directory in (raw_dir, parsed_dir, copy_dir):
        directory.mkdir(parents=True, exist_ok=True)
    manifest_path = work_dir / "geofabrik-state-manifest.json"
    manifest = discover_state_manifest(manifest_path)
    extracts = manifest["extracts"]

    failures: list[str] = []
    with ThreadPoolExecutor(max_workers=max(1, download_workers)) as executor:
        futures = {executor.submit(_download_one, item, raw_dir): item["slug"] for item in extracts}
        for future in as_completed(futures):
            slug = futures[future]
            try:
                future.result()
                print(json.dumps({"stage": "downloaded", "extract": slug}), flush=True)
            except Exception as error:  # noqa: BLE001 - aggregate worker failures
                failures.append(f"{slug}: {error}")
    if failures:
        raise RuntimeError("download failures: " + "; ".join(failures))

    reports: list[dict[str, Any]] = []
    failures = []
    with ProcessPoolExecutor(max_workers=max(1, parse_workers)) as executor:
        futures = {
            executor.submit(_parse_one, item, raw_dir, parsed_dir): item["slug"]
            for item in extracts
        }
        for future in as_completed(futures):
            slug = futures[future]
            try:
                report = future.result()
                reports.append(report)
                print(
                    json.dumps(
                        {"stage": "parsed", "extract": slug, "records": report["records_staged"]}
                    ),
                    flush=True,
                )
            except Exception as error:  # noqa: BLE001 - aggregate worker failures
                failures.append(f"{slug}: {error}")
    if failures:
        raise RuntimeError("parse failures: " + "; ".join(failures))

    totals: dict[str, int] = {"node": 0, "line": 0, "industrial_site": 0}
    for item in extracts:
        counts = write_copy_files(parsed_dir / f"{item['slug']}.ndjson", copy_dir / item["slug"])
        for kind, count in counts.items():
            totals[kind] = totals.get(kind, 0) + count
    result = PipelineResult(
        work_dir=str(work_dir),
        extracts=len(extracts),
        records=sum(totals.values()),
        counts=totals,
        valid=len(reports) == len(extracts) and all(report.get("valid") for report in reports),
    )
    national_report = {
        "schema_version": "gridpulse-national-preparation-v1",
        "created_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        **asdict(result),
        "source_extracts": [
            {key: item[key] for key in ("slug", "federal_states", "url", "expected_md5", "last_modified")}
            for item in extracts
        ],
        "evidence_boundary": (
            "OSM records are mapped infrastructure, never available capacity. "
            "This prepared batch is not public until PostGIS release promotion succeeds."
        ),
    }
    (work_dir / "national-preparation-report.json").write_text(
        json.dumps(national_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return result


def recommended_parse_workers() -> int:
    return max(1, min(3, (os.cpu_count() or 2) // 2))
