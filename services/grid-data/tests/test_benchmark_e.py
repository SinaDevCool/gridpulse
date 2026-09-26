import json

import pytest

from grid_data.benchmark_e import SCHEMA_VERSION, _wilson_upper, build_benchmark_e_artifact


def test_benchmark_e_synthetic_prospective_rehearsal_is_not_operator_validation(tmp_path):
    output = tmp_path / "benchmark-e.json"
    report = build_benchmark_e_artifact(output)

    assert report["schema_version"] == SCHEMA_VERSION
    assert report["prospective_numerical_validation_passed"] is True
    assert report["operator_prospective_validation_passed"] is False
    assert report["benchmark_execution_passed"] is True
    assert report["metrics"]["unsafe_cases"] == []
    assert report["metrics"]["temporal_violations"] == []
    assert report["capacity_claim"] is False
    assert json.loads(output.read_text(encoding="utf-8"))["benchmark_sha256"] == report[
        "benchmark_sha256"
    ]


def test_wilson_bound_penalizes_small_zero_failure_samples():
    assert _wilson_upper(0, 4) > 0.15
    assert _wilson_upper(0, 20) < 0.15


def test_benchmark_e_requires_complete_external_bundle(tmp_path):
    with pytest.raises(ValueError, match="together"):
        build_benchmark_e_artifact(
            tmp_path / "bad.json", predictions_path=tmp_path / "predictions.json"
        )
