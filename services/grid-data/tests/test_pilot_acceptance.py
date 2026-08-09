from pathlib import Path

from grid_data.p0_foundation import PhysicsOutcome
from grid_data.pilot_acceptance import (
    SYNTHETIC_WATERMARK,
    build_acceptance_report,
    reduction_benchmark,
    replacement_readiness,
)
from grid_data.pilot_providers import SyntheticPilotDataProvider

FIXTURE = Path(__file__).parents[1] / "fixtures" / "synthetic-pilot"


def outcome(identifier: str, capacity: float, feasible: bool = True) -> PhysicsOutcome:
    return PhysicsOutcome(
        identifier,
        identifier * 64,
        capacity,
        5,
        feasible,
        "base",
        "line",
        "test-ac",
        "1",
        "synthetic_demonstration",
        True,
    )


def test_reduction_promotion_requires_worst_case_and_zero_false_safe() -> None:
    full = [outcome("a", 40), outcome("b", 20, False), outcome("c", 30)]
    passing = reduction_benchmark(
        full, full[:2], full_runtime_seconds=10, selected_runtime_seconds=4
    )
    assert passing["accepted_for_reduced_search"] is True
    assert passing["false_safe_rate"] == 0
    failing = reduction_benchmark(
        full, [full[0]], full_runtime_seconds=10, selected_runtime_seconds=2
    )
    assert failing["accepted_for_reduced_search"] is False
    assert failing["missed_infeasible_scenarios"] == ["b"]


def test_synthetic_package_is_replacement_ready_but_never_operator_confirmed(tmp_path) -> None:
    bundle = SyntheticPilotDataProvider(FIXTURE).load()
    readiness = replacement_readiness(bundle)
    assert readiness["synthetic_pilot_complete"] is True
    assert readiness["operator_confirmed"] is False
    report = build_acceptance_report(
        bundle,
        reduction={"accepted_for_reduced_search": True},
        output=tmp_path / "acceptance.json",
    )
    assert report["all_repository_gates_passed"] is True
    assert report["watermark"] == SYNTHETIC_WATERMARK
    assert report["capacity_claim"] is False
    assert report["display_as_capacity"] is False
