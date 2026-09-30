"""Adapters over existing canonical GridPulse source parsers (no duplicate downloads)."""

from __future__ import annotations

from datetime import datetime, timedelta

from grid_data.c2_sources import HourlySeries
from grid_data.public_context import RedispatchEvent as PublicRedispatchEvent

from .contracts import EvidenceType, Observation
from .targets import RedispatchEvent

METRIC_KEYS = {
    "actual_grid_load": "actual_load_mw",
    "load_forecast": "load_forecast_mw",
    "wind_onshore_generation": "wind_generation_mw",
    "solar_generation": "solar_generation_mw",
    "day_ahead_price": "day_ahead_price_eur_mwh",
}


def observations_from_hourly_series(series: HourlySeries, *, retrieved_at) -> list[Observation]:
    metric_key = METRIC_KEYS.get(series.metric)
    if metric_key is None:
        raise ValueError(f"hourly series metric is not registered for forecasting: {series.metric}")
    evidence = EvidenceType.PUBLIC_FORECAST if series.metric == "load_forecast" else EvidenceType.OBSERVED
    digest = str(series.provenance["artifact_sha256"])
    source_url = str(series.provenance["source_url"])
    return [Observation(metric_key, timestamp, timestamp + timedelta(hours=1), value, "EUR/MWh" if series.metric == "day_ahead_price" else "MW", series.source_key, source_url, retrieved_at, digest, source_record_id=f"{series.metric}:{timestamp.isoformat()}", evidence_type=evidence) for timestamp, value in series.values]


def targets_from_public_redispatch(events: list[PublicRedispatchEvent]) -> list[RedispatchEvent]:
    result: list[RedispatchEvent] = []
    for event in events:
        start = datetime.fromisoformat(event.starts_at)
        end = datetime.fromisoformat(event.ends_at)
        duration_hours = (end - start).total_seconds() / 3600
        if event.volume_mwh is None or duration_hours <= 0:
            continue
        result.append(RedispatchEvent(start, end, event.volume_mwh / duration_hours, start, event.source_record_id))
    return result
