from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest

from grid_data.graph import (
    TemporalSnapshot,
    TopologyEvent,
    WorkspacePolicy,
    authorize_processing,
    build_projection,
    build_projection_delta,
    evaluate_operational_quality,
    redact_export,
    snapshot_at,
    validate_delta,
    validate_event_ledger,
    validate_snapshot_timeline,
)
from grid_data.network_study import NetworkModelInput


def _model() -> NetworkModelInput:
    payload = json.loads(
        (Path(__file__).parents[1] / "fixtures/synthetic-pilot/network.json").read_text()
    )
    payload.update(
        model_version="group-d", validation_class="synthetic_demonstration", provenance={}
    )
    return NetworkModelInput(**payload)


def test_temporal_history_is_unambiguous_and_event_ledger_contiguous():
    snapshots = [
        TemporalSnapshot("a", "a" * 64, "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z"),
        TemporalSnapshot("b", "b" * 64, "2026-02-01T00:00:00Z"),
    ]
    assert validate_snapshot_timeline(snapshots)["valid"] is True
    assert snapshot_at(snapshots, "2026-02-02T00:00:00+00:00").snapshot_id == "b"
    events = [
        TopologyEvent(
            1, "2026-01-01T00:00:00Z", "switch_changed", "sw", {"closed": False}, "a" * 64
        )
    ]
    assert validate_event_ledger(events)["head_sequence"] == 1
    with pytest.raises(ValueError, match="contiguous"):
        validate_event_ledger([replace(events[0], sequence=2)])


def test_projection_delta_uses_optimistic_concurrency_and_hashes():
    before = build_projection(_model())
    after = build_projection(
        replace(
            _model(),
            model_version="group-d-2",
            loads=[{**row, "p_mw": float(row.get("p_mw", 0)) + 1} for row in _model().loads],
        )
    )
    delta = build_projection_delta(before, after)
    assert delta["node_upserts"]
    validate_delta(delta, before.projection_sha256)
    with pytest.raises(RuntimeError, match="changed"):
        validate_delta(delta, "0" * 64)


def test_quality_gate_invalidates_results_on_drift():
    passing = evaluate_operational_quality(
        parameter_completeness=1,
        orphan_ratio=0,
        voltage_errors_pu=[0.01],
        active_power_errors_mw=[1],
        observation_coverage=1,
    )
    assert passing["accepted"] is True
    failing = evaluate_operational_quality(
        parameter_completeness=0.9,
        orphan_ratio=0.1,
        voltage_errors_pu=[0.1],
        active_power_errors_mw=[5],
        observation_coverage=0.5,
    )
    assert failing["invalidate_physics_results"] is True


def test_sovereignty_policy_denies_unapproved_use_and_redacts_raw_model():
    policy = WorkspacePolicy("pilot", ("DE",), ("grid_study",), 365)
    assert authorize_processing(policy, region="DE", purpose="grid_study")["authorized"] is True
    assert authorize_processing(policy, region="US", purpose="grid_study")["authorized"] is False
    exported = redact_export({"model_id": "x", "buses": [{"id": "secret"}], "result": 1}, policy)
    assert exported["redacted"] is True
    assert "buses" not in exported["payload"]
