"""Release 1 acceptance gates for reproducible German public-data releases."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from .c2_sources import HourlySeries


@dataclass(frozen=True)
class SourceQualityReport:
    source_key: str
    status: str
    observation_count: int
    expected_count: int
    duplicate_count: int
    missing_count: int
    coverage: float
    first_timestamp: str | None
    last_timestamp: str | None
    artifact_sha256: str
    parser_version: str
    evidence_boundary: str
    issues: tuple[str, ...]

    @property
    def accepted(self) -> bool:
        return self.status == "accepted"


def assess_hourly_series(
    series: HourlySeries,
    *,
    start: datetime,
    end_exclusive: datetime,
    parser_version: str,
    minimum_coverage: float = 0.995,
) -> SourceQualityReport:
    if start.tzinfo is None or end_exclusive.tzinfo is None:
        raise ValueError("Source-quality intervals require timezone-aware timestamps.")
    start = start.astimezone(timezone.utc)
    end_exclusive = end_exclusive.astimezone(timezone.utc)
    expected = int((end_exclusive - start).total_seconds() // 3600)
    if expected <= 0 or start + timedelta(hours=expected) != end_exclusive:
        raise ValueError("Source-quality interval must contain complete UTC hours.")
    selected = [
        item for item in series.values if start <= item[0].astimezone(timezone.utc) < end_exclusive
    ]
    timestamps = [item[0].astimezone(timezone.utc) for item in selected]
    unique = set(timestamps)
    duplicate_count = len(timestamps) - len(unique)
    missing_count = max(0, expected - len(unique))
    coverage = len(unique) / expected
    issues = []
    if duplicate_count:
        issues.append("duplicate_timestamps")
    if coverage < minimum_coverage:
        issues.append("insufficient_coverage")
    provenance_hash = series.provenance.get("artifact_sha256")
    if not provenance_hash or len(str(provenance_hash)) != 64:
        issues.append("missing_artifact_sha256")
    if not series.provenance.get("source_url") or not series.provenance.get("licence"):
        issues.append("incomplete_provenance")
    canonical = json.dumps(
        [(timestamp.isoformat(), value) for timestamp, value in selected],
        separators=(",", ":"),
    ).encode()
    return SourceQualityReport(
        source_key=series.source_key,
        status="accepted" if not issues else "rejected",
        observation_count=len(selected),
        expected_count=expected,
        duplicate_count=duplicate_count,
        missing_count=missing_count,
        coverage=round(coverage, 8),
        first_timestamp=min(unique).isoformat() if unique else None,
        last_timestamp=max(unique).isoformat() if unique else None,
        artifact_sha256=str(provenance_hash or hashlib.sha256(canonical).hexdigest()),
        parser_version=parser_version,
        evidence_boundary=str(series.provenance.get("evidence_boundary") or "Unspecified"),
        issues=tuple(issues),
    )


def accepted_release_manifest(reports: list[SourceQualityReport]) -> dict[str, Any]:
    if not reports or any(not item.accepted for item in reports):
        raise ValueError("Only fully accepted source reports can form an accepted release.")
    payload = {
        "schema_version": "gridpulse-public-source-release-v1",
        "status": "accepted",
        "sources": [asdict(item) for item in sorted(reports, key=lambda item: item.source_key)],
        "capacity_claim": False,
        "evidence_boundary": "Public German context only; not feeder loading or available capacity.",
    }
    payload["release_sha256"] = hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    return payload
