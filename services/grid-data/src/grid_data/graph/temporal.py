from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from itertools import pairwise
from typing import Any

from grid_data.p0_foundation import canonical_hash


def _utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Temporal values must include a timezone.")
    return parsed.astimezone(timezone.utc)


@dataclass(frozen=True)
class TemporalSnapshot:
    snapshot_id: str
    projection_sha256: str
    valid_from: str
    valid_to: str | None = None
    source_event_sha256: str | None = None

    def validate(self) -> None:
        start = _utc(self.valid_from)
        if self.valid_to and _utc(self.valid_to) <= start:
            raise ValueError("Snapshot valid_to must be later than valid_from.")


@dataclass(frozen=True)
class TopologyEvent:
    sequence: int
    occurred_at: str
    event_type: str
    asset_id: str
    payload: dict[str, Any]
    source_sha256: str

    def validate(self) -> None:
        if self.sequence < 1:
            raise ValueError("Event sequence must be positive.")
        _utc(self.occurred_at)
        if not re.fullmatch(r"[a-f0-9]{64}", self.source_sha256):
            raise ValueError("Event source hash must contain 64 hexadecimal characters.")


def validate_snapshot_timeline(snapshots: list[TemporalSnapshot]) -> dict[str, Any]:
    ordered = sorted(snapshots, key=lambda row: _utc(row.valid_from))
    for row in ordered:
        row.validate()
    for previous, current in pairwise(ordered):
        if previous.valid_to is None or _utc(previous.valid_to) > _utc(current.valid_from):
            raise ValueError("Snapshot validity intervals overlap or an earlier snapshot is open.")
    payload = [asdict(row) for row in ordered]
    return {"snapshots": payload, "timeline_sha256": canonical_hash(payload), "valid": True}


def snapshot_at(snapshots: list[TemporalSnapshot], at: str) -> TemporalSnapshot | None:
    instant = _utc(at)
    matches = [
        row
        for row in snapshots
        if _utc(row.valid_from) <= instant
        and (row.valid_to is None or instant < _utc(row.valid_to))
    ]
    if len(matches) > 1:
        raise ValueError("Temporal snapshot history is ambiguous.")
    return matches[0] if matches else None


def validate_event_ledger(events: list[TopologyEvent]) -> dict[str, Any]:
    ordered = sorted(events, key=lambda row: row.sequence)
    for row in ordered:
        row.validate()
    sequences = [row.sequence for row in ordered]
    if sequences != list(range(1, len(ordered) + 1)):
        raise ValueError("Topology event ledger must be contiguous and start at sequence one.")
    if len({row.source_sha256 for row in ordered}) != len(ordered):
        raise ValueError("Topology event source hashes must be unique.")
    payload = [asdict(row) for row in ordered]
    return {
        "event_count": len(ordered),
        "head_sequence": len(ordered),
        "ledger_sha256": canonical_hash(payload),
        "events": payload,
    }
