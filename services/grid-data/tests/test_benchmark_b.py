import json

import pytest

from grid_data.benchmark_b import SCHEMA_VERSION, build_benchmark_b_artifact


def test_benchmark_b_runs_an_external_solver_and_preserves_truth_boundary(tmp_path):
    output = tmp_path / "benchmark-b.json"
    report = build_benchmark_b_artifact(
        output,
        codes=("1-MV-urban--0-sw",),
        contingency_limit=0,
        tolerance_mw=0.1,
        maximum_capacity_mw=10,
    )

    assert report["schema_version"] == SCHEMA_VERSION
    assert report["capacity_claim"] is False
    assert report["reference_method"]["external_solver_validated"] is True
    assert report["reference_method"]["independence"].startswith("independent_solver")
    assert report["cases"][0]["reference"]["engine"] == "pypower"
    assert report["summary"]["all_passed"] is True
    assert json.loads(output.read_text(encoding="utf-8"))["benchmark_sha256"] == report[
        "benchmark_sha256"
    ]


def test_benchmark_b_rejects_invalid_configuration(tmp_path):
    with pytest.raises(ValueError, match="invalid"):
        build_benchmark_b_artifact(tmp_path / "bad.json", codes=())
