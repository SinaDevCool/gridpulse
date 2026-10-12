from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from enum import Enum
from typing import Any

FEATURE_SCHEMA_VERSION = "gridpulse-grid-stress-features-v1"
FORECAST_SCHEMA_VERSION = "gridpulse-grid-stress-public-v1"
FORBIDDEN_EVIDENCE_TYPES = frozenset({"synthetic", "scenario", "surrogate", "reconstructed_network"})


class EvidenceType(str, Enum):
    OBSERVED = "observed"
    PUBLIC_FORECAST = "forecast"
    DERIVED = "derived"


@dataclass(frozen=True)
class Observation:
    metric_key: str
    interval_start: datetime
    interval_end: datetime
    value: float
    unit: str
    source_key: str
    source_url: str
    retrieved_at: datetime
    content_hash: str
    region_code: str = "DE"
    issued_at: datetime | None = None
    source_record_id: str | None = None
    evidence_type: EvidenceType = EvidenceType.OBSERVED
    quality_flags: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.interval_end <= self.interval_start:
            raise ValueError("interval_end must follow interval_start")
        if self.retrieved_at.tzinfo is None or self.interval_start.tzinfo is None:
            raise ValueError("timestamps must be timezone-aware")
        if len(self.content_hash) != 64:
            raise ValueError("content_hash must be SHA-256")


@dataclass(frozen=True)
class FeatureSnapshot:
    issue_time: datetime
    delivery_day: date
    features: dict[str, float]
    source_ids: tuple[int, ...]
    source_evidence_types: tuple[str, ...]
    completeness: float
    region_code: str = "DE"
    schema_version: str = FEATURE_SCHEMA_VERSION

    def __post_init__(self) -> None:
        forbidden = set(self.source_evidence_types) & FORBIDDEN_EVIDENCE_TYPES
        if forbidden:
            raise ValueError(f"non-real evidence forbidden: {sorted(forbidden)}")
        if not 0 <= self.completeness <= 1:
            raise ValueError("completeness must be between 0 and 1")


@dataclass(frozen=True)
class Prediction:
    issue_time: datetime
    delivery_day: date
    high_stress_probability: float
    redispatch_mwh_p50: float
    redispatch_mwh_p90: float
    severity: str
    confidence: str
    drivers: tuple[dict[str, Any], ...]
    caveats: tuple[str, ...]
    model_name: str
    model_version: str
    region_code: str = "DE"
    source_freshness: dict[str, Any] = field(default_factory=dict)

    def as_public_dict(self) -> dict[str, Any]:
        return {
            "schemaVersion": FORECAST_SCHEMA_VERSION,
            "status": "available",
            "regionCode": self.region_code,
            "issueTime": self.issue_time.astimezone(timezone.utc).isoformat(),
            "deliveryDay": self.delivery_day.isoformat(),
            "highStressProbability": self.high_stress_probability,
            "redispatchMwhP50": self.redispatch_mwh_p50,
            "redispatchMwhP90": self.redispatch_mwh_p90,
            "severity": self.severity,
            "confidence": self.confidence,
            "drivers": list(self.drivers),
            "caveats": list(self.caveats),
            "sourceFreshness": self.source_freshness,
            "model": {"name": self.model_name, "version": self.model_version},
            "decisionBoundary": "Regional public-data forecast; not available connection capacity or an operator offer.",
        }
