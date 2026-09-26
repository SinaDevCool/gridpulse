from __future__ import annotations

from dataclasses import replace
from datetime import date, datetime, timedelta, timezone

import pytest

from grid_data.forecasting.backtest import rolling_origin_splits
from grid_data.forecasting.contracts import EvidenceType, FeatureSnapshot, Observation
from grid_data.forecasting.features import build_daily_feature_snapshot
from grid_data.forecasting.monitoring import freshness_gate, population_stability_index
from grid_data.forecasting.sources import parse_entsoe_document
from grid_data.forecasting.targets import RedispatchEvent, aggregate_daily_targets, percentile

NOW = datetime(2026, 9, 24, 10, tzinfo=timezone.utc)


def observation(metric: str, value: float, *, retrieved: datetime = NOW, evidence: EvidenceType = EvidenceType.OBSERVED) -> Observation:
    return Observation(metric, datetime(2026, 9, 24, tzinfo=timezone.utc), datetime(2026, 9, 24, 1, tzinfo=timezone.utc), value, "MW", "smard", "https://www.smard.de/", retrieved, "a" * 64, evidence_type=evidence)


def test_feature_builder_enforces_point_in_time_and_derives_net_load() -> None:
    rows = [
        (1, observation("actual_load_mw", 60)),
        (2, replace(observation("load_forecast_mw", 70, evidence=EvidenceType.PUBLIC_FORECAST), issued_at=NOW - timedelta(hours=1))),
        (3, observation("wind_generation_mw", 10)),
        (4, observation("solar_generation_mw", 5)),
        (5, replace(observation("actual_load_mw", 999), interval_start=NOW + timedelta(hours=1), interval_end=NOW + timedelta(hours=2))),
    ]
    snapshot = build_daily_feature_snapshot(rows, issue_time=NOW, delivery_day=date(2026, 9, 25))
    assert snapshot.features["actual_load_mw_mean"] == 60
    assert snapshot.features["forecast_net_load_mw"] == 55
    assert snapshot.completeness == 1
    assert 5 not in snapshot.source_ids


def test_forbidden_synthetic_snapshot_fails_closed() -> None:
    with pytest.raises(ValueError, match="non-real evidence"):
        FeatureSnapshot(NOW, date(2026, 9, 25), {}, (), ("synthetic",), 1)


def test_redispatch_daily_energy_and_training_percentile() -> None:
    event = RedispatchEvent(NOW, NOW + timedelta(hours=2), -10, NOW - timedelta(hours=1), "one")
    result = aggregate_daily_targets([event], complete_days={NOW.date()})
    assert result[0].redispatch_mwh == 20
    assert percentile([0, 10, 20, 30, 40], 0.8) == pytest.approx(32)


def test_entsoe_parser_is_namespace_independent() -> None:
    xml = b'''<Publication_MarketDocument xmlns="urn:test"><TimeSeries><Period><timeInterval><start>2026-09-24T00:00Z</start><end>2026-09-24T02:00Z</end></timeInterval><resolution>PT60M</resolution><Point><position>1</position><quantity>12.5</quantity></Point><Point><position>2</position><quantity>14</quantity></Point></Period></TimeSeries></Publication_MarketDocument>'''
    rows = parse_entsoe_document(xml, metric_key="cross_border_flow_mw", unit="MW", source_url="https://example.test", retrieved_at=NOW)
    assert [row.value for row in rows] == [12.5, 14]
    assert rows[1].interval_start.hour == 1


def test_rolling_splits_never_train_on_test_future() -> None:
    splits = rolling_origin_splits(270, minimum_train=180, test_days=30, folds=3)
    assert len(splits) == 3
    assert all(max(train) < min(test) for train, test in splits)


def test_monitoring_gates() -> None:
    gate = freshness_gate({"smard": NOW}, now=NOW + timedelta(hours=12), mandatory=["smard", "redispatch"])
    assert gate["passed"] is False
    assert gate["staleSources"] == ["redispatch"]
    assert population_stability_index([1, 1, 2, 2], [1, 1, 2, 2]) == pytest.approx(0)
