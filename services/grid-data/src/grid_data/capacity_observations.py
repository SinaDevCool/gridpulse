"""Validation gate for externally published capacity observations.

The caller must provide explicit reuse evidence. Sources marked
``permission_required`` are rejected even if a value is technically accessible.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class PublishedCapacityObservation:
    source_key: str
    source_record_id: str
    operator_name: str
    connection_point_name: str
    longitude: float
    latitude: float
    voltage_kv: float
    direction: str
    value_mw: float | None
    band_min_mw: float | None
    band_max_mw: float | None
    published_at: str
    source_url: str
    non_binding: bool
    reuse_evidence: dict[str, Any]


def validate_published_observation(
    observation: PublishedCapacityObservation,
    *,
    reuse_status: str,
) -> dict[str, Any]:
    if reuse_status not in {"permitted", "operator_contract"}:
        raise PermissionError(f"Source {observation.source_key} is not approved for value reuse.")
    if observation.direction not in {"import", "export", "generation", "bidirectional"}:
        raise ValueError("Invalid capacity direction.")
    if not (-180 <= observation.longitude <= 180 and -90 <= observation.latitude <= 90):
        raise ValueError("Invalid observation coordinates.")
    if observation.voltage_kv <= 0 or observation.voltage_kv > 500:
        raise ValueError("Invalid voltage level.")
    values = [
        value
        for value in (observation.value_mw, observation.band_min_mw, observation.band_max_mw)
        if value is not None
    ]
    if not values or any(value < 0 for value in values):
        raise ValueError("Observation requires a non-negative exact value or band.")
    if (
        observation.band_min_mw is not None
        and observation.band_max_mw is not None
        and observation.band_min_mw > observation.band_max_mw
    ):
        raise ValueError("Capacity band minimum exceeds maximum.")
    datetime.fromisoformat(observation.published_at.replace("Z", "+00:00"))
    if not observation.reuse_evidence.get("basis"):
        raise ValueError("Reuse evidence must identify its legal or contractual basis.")
    if not observation.non_binding and not observation.reuse_evidence.get(
        "operator_confirmation_id"
    ):
        raise ValueError("Binding capacity requires operator confirmation evidence.")
    result = asdict(observation)
    result["validation_class"] = (
        "operator_confirmed" if not observation.non_binding else "public_screening"
    )
    result["capacity_state"] = (
        "published_exact" if observation.value_mw is not None else "published_band"
    )
    return result
