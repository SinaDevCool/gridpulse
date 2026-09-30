from __future__ import annotations

import hashlib
import json
import math
from collections import defaultdict
from collections.abc import Iterable
from datetime import date, datetime, timedelta, timezone
from statistics import mean

from .contracts import FeatureSnapshot, Observation

MANDATORY_METRICS = ("actual_load_mw", "wind_generation_mw", "solar_generation_mw")


def build_daily_feature_snapshot(
    observations: Iterable[tuple[int, Observation]], *, issue_time: datetime, delivery_day: date,
) -> FeatureSnapshot:
    if issue_time.tzinfo is None:
        raise ValueError("issue_time must be timezone-aware")
    by_metric: dict[str, list[float]] = defaultdict(list)
    source_ids: list[int] = []
    evidence_types: set[str] = set()
    lookback_start = issue_time - timedelta(days=7)
    for source_id, observation in observations:
        # Point-in-time rule: rows retrieved or issued later than the decision time are unavailable.
        known_at = observation.issued_at if observation.evidence_type.value == "forecast" else observation.interval_end
        if known_at is None or known_at > issue_time:
            continue
        day = observation.interval_start.astimezone(timezone.utc).date()
        historical = lookback_start <= observation.interval_start <= issue_time and day < delivery_day
        day_ahead = day == delivery_day and observation.evidence_type.value == "forecast" and observation.issued_at is not None
        if not (historical or day_ahead):
            continue
        by_metric[observation.metric_key].append(observation.value)
        source_ids.append(source_id)
        evidence_types.add(observation.evidence_type.value)
    features: dict[str, float] = {}
    for metric, values in by_metric.items():
        finite = [v for v in values if math.isfinite(v)]
        if finite:
            features[f"{metric}_mean"] = mean(finite)
            features[f"{metric}_max"] = max(finite)
            features[f"{metric}_min"] = min(finite)
    if "load_forecast_mw_mean" in features:
        features["forecast_net_load_mw"] = features["load_forecast_mw_mean"] - features.get("wind_generation_mw_mean", 0) - features.get("solar_generation_mw_mean", 0)
    features["day_of_week"] = float(delivery_day.weekday())
    features["month"] = float(delivery_day.month)
    present = sum(any(key.startswith(metric) for key in features) for metric in MANDATORY_METRICS)
    completeness = present / len(MANDATORY_METRICS)
    return FeatureSnapshot(issue_time, delivery_day, features, tuple(sorted(set(source_ids))), tuple(sorted(evidence_types)), completeness)


def snapshot_hash(snapshot: FeatureSnapshot) -> str:
    payload = json.dumps({"schema": snapshot.schema_version, "issue": snapshot.issue_time.isoformat(), "delivery": snapshot.delivery_day.isoformat(), "features": snapshot.features, "sources": snapshot.source_ids}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()
