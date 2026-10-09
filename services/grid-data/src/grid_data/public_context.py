"""Normalized German public-context records for Release D.

These adapters deliberately produce context records, never connection-capacity
observations. Publisher-specific downloads can be retained in object storage and
the normalized output can be loaded idempotently by ``run_key`` and record id.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
from collections.abc import Iterable
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass(frozen=True)
class IngestionManifest:
    source_key: str
    run_key: str
    artifact_sha256: str
    record_count: int
    started_at: str
    completed_at: str
    quality_summary: dict[str, Any]


@dataclass(frozen=True)
class RedispatchEvent:
    source_record_id: str
    starts_at: str
    ends_at: str
    operator_name: str | None
    direction: str | None
    volume_mwh: float | None
    reason: str | None
    region_label: str | None
    source_url: str
    properties: dict[str, Any]


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def build_manifest(
    source_key: str,
    content: bytes,
    records: Iterable[Any],
    *,
    started_at: datetime,
    completed_at: datetime | None = None,
    quality_summary: dict[str, Any] | None = None,
) -> IngestionManifest:
    materialized = list(records)
    completed = completed_at or datetime.now(timezone.utc)
    return IngestionManifest(
        source_key=source_key,
        run_key=f"{source_key}:{sha256_bytes(content)[:16]}",
        artifact_sha256=sha256_bytes(content),
        record_count=len(materialized),
        started_at=started_at.astimezone(timezone.utc).isoformat(),
        completed_at=completed.astimezone(timezone.utc).isoformat(),
        quality_summary=quality_summary or {},
    )


def parse_redispatch_csv(content: bytes, *, source_url: str) -> list[RedispatchEvent]:
    """Parse a publisher-exported redispatch CSV using stable semantic aliases."""
    text = content.decode("utf-8-sig")
    sample = text[:4096]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","
    rows = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    events: list[RedispatchEvent] = []
    for index, raw in enumerate(rows, start=1):
        row = {str(key).strip().lower(): (value or "").strip() for key, value in raw.items()}
        starts = _required(row, "start", "starts_at", "beginn", "von")
        ends = _required(row, "end", "ends_at", "ende", "bis")
        start = _parse_timestamp(starts)
        end = _parse_timestamp(ends)
        if end <= start:
            raise ValueError(f"Redispatch row {index} ends before it starts.")
        record_id = _first(row, "id", "source_record_id", "massnahmen_id")
        volume = _optional_float(_first(row, "volume_mwh", "arbeit_mwh", "menge_mwh"))
        stable_id = (
            record_id
            or hashlib.sha256(
                f"{start.isoformat()}|{end.isoformat()}|{index}".encode()
            ).hexdigest()[:24]
        )
        events.append(
            RedispatchEvent(
                source_record_id=stable_id,
                starts_at=start.isoformat(),
                ends_at=end.isoformat(),
                operator_name=_first(row, "operator", "operator_name", "netzbetreiber") or None,
                direction=_first(row, "direction", "richtung") or None,
                volume_mwh=volume,
                reason=_first(row, "reason", "grund", "ursache") or None,
                region_label=_first(row, "region", "region_label", "gebiet") or None,
                source_url=source_url,
                properties={"source_row": index},
            )
        )
    return events


def redispatch_ndjson(events: Iterable[RedispatchEvent]) -> str:
    return "\n".join(json.dumps(asdict(event), sort_keys=True) for event in events)


def _first(row: dict[str, str], *keys: str) -> str:
    return next((row[key] for key in keys if row.get(key)), "")


def _required(row: dict[str, str], *keys: str) -> str:
    value = _first(row, *keys)
    if not value:
        raise ValueError(f"Missing required redispatch field: {'/'.join(keys)}")
    return value


def _parse_timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Redispatch timestamps must include a time zone.")
    return parsed.astimezone(timezone.utc)


def _optional_float(value: str) -> float | None:
    if not value:
        return None
    return float(value.replace(".", "").replace(",", ".") if "," in value else value)
