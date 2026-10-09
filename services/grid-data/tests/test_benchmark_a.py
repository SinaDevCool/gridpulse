import json

import pytest

from grid_data.benchmark_a import SCHEMA_VERSION, build_benchmark_a_artifact


def test_benchmark_a_is_reproducible_and_explicitly_not_external_validation(tmp_path):
    output = tmp_path / "benchmark-a.json"
    report = build_benchmark_a_artifact(
        output,
        codes=("1-MV-urban--0-sw",),
        contingency_limit=0,
        tolerance_mw=0.25,
        maximum_capacity_mw=10,
    )

    assert report["schema_version"] == SCHEMA_VERSION
    assert report["capacity_claim"] is False
    assert report["reference_method"]["external_solver_validated"] is False
    assert report["reference_method"]["independence"] == "alternate_algorithm_same_engine"
    assert report["summary"]["all_passed"] is True
    assert report["cases"][0]["production"]["n0_import_mw"] > 0
    assert report["cases"][0]["metrics"]["n0_absolute_capacity_error_mw"] <= 0.25
    assert json.loads(output.read_text(encoding="utf-8"))["benchmark_sha256"] == report[
        "benchmark_sha256"
    ]


def test_benchmark_a_rejects_invalid_configuration(tmp_path):
    with pytest.raises(ValueError, match="invalid"):
        build_benchmark_a_artifact(tmp_path / "bad.json", codes=())
