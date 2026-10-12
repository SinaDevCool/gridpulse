import json

import pytest

from grid_data.benchmark_d import SCHEMA_VERSION, build_benchmark_d_artifact


def test_benchmark_d_synthetic_backtest_passes_without_operator_claim(tmp_path):
    output = tmp_path / "benchmark-d.json"
    report = build_benchmark_d_artifact(output)

    assert report["schema_version"] == SCHEMA_VERSION
    assert report["numerical_outcome_backtest_passed"] is True
    assert report["operator_outcome_validation_passed"] is False
    assert report["benchmark_execution_passed"] is True
    assert report["metrics"]["unsafe_cases"] == []
    assert report["validation_class"] == "synthetic_demonstration"
    assert report["capacity_claim"] is False
    assert json.loads(output.read_text(encoding="utf-8"))["benchmark_sha256"] == report[
        "benchmark_sha256"
    ]


def test_benchmark_d_fails_on_unsafe_capacity_overstatement(tmp_path):
    predictions = [
        {
            "case_id": "case-1",
            "node_id": "node-1",
            "n0_import_mw": 10,
            "firm_import_mw": 9,
            "binding_constraint": "line_thermal_loading",
        }
    ]
    references = [
        {
            "case_id": "case-1",
            "node_id": "node-1",
            "n0_import_mw": 5,
            "firm_import_mw": 4,
            "binding_constraint": "line_thermal_loading",
        }
    ]
    evidence = {"evidence_origin": "operator_supplied"}
    paths = []
    for name, payload in (
        ("predictions", predictions),
        ("references", references),
        ("evidence", evidence),
    ):
        path = tmp_path / f"{name}.json"
        path.write_text(json.dumps(payload), encoding="utf-8")
        paths.append(path)
    report = build_benchmark_d_artifact(
        tmp_path / "result.json",
        predictions_path=paths[0],
        references_path=paths[1],
        evidence_path=paths[2],
        minimum_cases=1,
    )
    assert report["numerical_outcome_backtest_passed"] is False
    assert report["operator_outcome_validation_passed"] is False
    assert report["metrics"]["unsafe_cases"] == ["case-1::node-1"]


def test_benchmark_d_requires_complete_external_bundle(tmp_path):
    with pytest.raises(ValueError, match="together"):
        build_benchmark_d_artifact(
            tmp_path / "bad.json", predictions_path=tmp_path / "predictions.json"
        )
